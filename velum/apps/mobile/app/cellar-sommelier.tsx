/**
 * Sommelier de cave (Gold+) — sens 1 de l'intelligence transversale :
 * « ce soir je cuisine tel plat → quel vin DÉJÀ DANS MA CAVE ? ».
 * Appelle l'Edge Function cellar-pairing (anti-hallucination côté serveur) ;
 * affiche l'emplacement physique de la bouteille recommandée s'il est saisi.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VButton,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import { isVelumError, type PairingResult } from '@velum/core';

import { Screen } from '../components/Screen';
import { getVelumClient } from '../lib/client';
import { showToast } from '../stores/toastStore';

export default function CellarSommelier() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const [dish, setDish] = useState('');
  const [planBlocked, setPlanBlocked] = useState(false);

  // Items vin : croisement itemId → emplacement physique de la bouteille.
  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    staleTime: 60 * 1000,
  });
  const locationById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of itemsQuery.data ?? []) {
      if (item.storageLocation) map.set(item.id, item.storageLocation);
    }
    return map;
  }, [itemsQuery.data]);

  const pairing = useMutation<PairingResult, unknown, string>({
    mutationFn: (d) => client.edge.cellarPairing(d),
    onError: (err) => {
      if (isVelumError(err) && err.code === 'PLAN_REQUIRED') {
        setPlanBlocked(true);
        return;
      }
      showToast(isVelumError(err) ? t(`errors.${err.code}`) : t('errors.generic'), 'danger');
    },
  });

  if (planBlocked) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('cellar.sommelierTitle')}
            message={t('cellar.planRequired')}
            action={{ label: t('cellar.seeOffers'), onPress: () => router.push('/paywall') }}
          />
        </View>
      </Screen>
    );
  }

  const result = pairing.data;

  return (
    <Screen>
      <VText variant="title">{t('cellar.sommelierTitle')}</VText>

      <VTextInput
        label={t('cellar.dishLabel')}
        value={dish}
        onChangeText={setDish}
        placeholder={t('cellar.dishPlaceholder')}
        autoCapitalize="none"
      />
      <VButton
        label={t('cellar.search')}
        onPress={() => {
          const trimmed = dish.trim();
          if (trimmed.length > 0) pairing.mutate(trimmed);
        }}
        disabled={dish.trim().length === 0 || pairing.isPending}
        loading={pairing.isPending}
        accessibilityHint={t('cellar.dishLabel')}
      />

      {pairing.isPending ? (
        <View style={styles.searching}>
          <VSpinner />
          <VText variant="body" tone="dim" center>
            {t('cellar.searching')}
          </VText>
        </View>
      ) : null}

      {result ? (
        <>
          {result.recommendations.length === 0 && !result.fallbackAdvice ? (
            <VText variant="body" tone="dim" style={styles.block}>
              {t('cellar.noResult')}
            </VText>
          ) : null}

          {result.recommendations.map((reco) => {
            const location = locationById.get(reco.itemId);
            return (
              <VCard
                key={reco.itemId}
                style={styles.block}
                onPress={() => router.push(`/item/${reco.itemId}`)}
              >
                <View style={styles.recoHeader}>
                  <VText variant="heading" tone="gold">
                    {reco.label}
                  </VText>
                  <ConfidenceBadge value={reco.score} />
                </View>
                <VText variant="body">{reco.reasoning}</VText>
                {reco.serveAt ? (
                  <VText variant="caption" tone="dim">
                    {t('cellar.serveAt', { advice: reco.serveAt })}
                  </VText>
                ) : null}
                {location ? (
                  <VText variant="caption" tone="gold">
                    {t('cellar.location', { location })}
                  </VText>
                ) : null}
              </VCard>
            );
          })}

          {result.fallbackAdvice ? (
            <VCard style={styles.block}>
              <VText variant="heading" tone="gold">
                {t('cellar.fallbackTitle')}
              </VText>
              <VText variant="body">{result.fallbackAdvice}</VText>
            </VCard>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  searching: { marginTop: velumSpacing.lg, gap: velumSpacing.sm, alignItems: 'center' },
  block: { marginTop: velumSpacing.md, gap: velumSpacing.xs },
  recoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
});
