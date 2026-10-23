/**
 * Sommelier de cave — sens 1 de l'intelligence transversale : « ce soir je
 * cuisine tel plat → quel vin DÉJÀ DANS MA CAVE ? ».
 *  1. « Suggestion rapide » dès la saisie : appariement local déterministe
 *     (sans IA, gratuit, hors-ligne), avec l'emplacement de chaque bouteille ;
 *     si rien ne convient : styles / appellations à acheter, ajout aux envies.
 *  2. « Affiner avec le sommelier IA » : Edge Function cellar-pairing (offre
 *     Gold+, garde-fous serveur inchangés, anti-hallucination).
 * Paramètre de route `dish` : pré-remplit le plat (ex. depuis « Mes vins à
 * leur apogée » → « Accord pour ce soir »).
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VBadge,
  VButton,
  VCard,
  VSpinner,
  VText,
  VTextInput,
  velumSpacing,
} from '@velum/ui';
import { isVelumError, type PairingResult } from '@velum/core';

import { QuickPairingList } from '../components/cellar/QuickPairingList';
import { Screen } from '../components/Screen';
import { positionLabel, wishlistIdeaTitle } from '../lib/cellarPeak';
import { getVelumClient } from '../lib/client';
import { localPairingForItems } from '../lib/drinkNow';
import { errorMessage } from '../lib/errors';
import { routes } from '../lib/routes';
import { showToast } from '../stores/toastStore';

/** Longueur minimale du plat avant la suggestion instantanée. */
const MIN_DISH_LENGTH = 3;

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.slice(0, 200) : '';
}

export default function CellarSommelier() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const params = useLocalSearchParams<{ dish?: string | string[] }>();
  const initialDish = firstParam(params.dish);
  const [dish, setDish] = useState(initialDish);
  const [planBlocked, setPlanBlocked] = useState(false);
  const [wishSaved, setWishSaved] = useState<string | null>(null);

  // Lien profond reçu alors que l'écran est déjà monté : on reprend le plat.
  useEffect(() => {
    if (initialDish.length > 0) setDish(initialDish);
  }, [initialDish]);

  // Items vin : suggestion locale + croisement itemId → emplacement.
  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    staleTime: 60 * 1000,
  });
  const wines = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  // Recalcul après chaque lecture réussie (objets éventuellement modifiés en place).
  const updatedAt = itemsQuery.dataUpdatedAt;
  const locationById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of wines) {
      if (item.storageLocation) map.set(item.id, item.storageLocation);
    }
    return map;
  }, [wines, updatedAt]);

  const trimmedDish = dish.trim();
  const year = new Date().getFullYear();
  const quick = useMemo(
    () => (trimmedDish.length >= MIN_DISH_LENGTH ? localPairingForItems(trimmedDish, wines, year) : null),
    [trimmedDish, wines, year, updatedAt],
  );

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

  const addWish = useMutation({
    mutationFn: async (input: { dish: string; ideas: string[] }) =>
      client.wishlist.add({
        domain: 'wine',
        kind: 'idea',
        title: wishlistIdeaTitle(input.ideas, t('cellar.quick.wishTitleFallback', { dish: input.dish })),
        notes: t('cellar.quick.wishNotes', { dish: input.dish }),
        attributes: { pairingDish: input.dish, styles: input.ideas },
        source: 'manual',
      }),
    onSuccess: (_entry, input) => {
      setWishSaved(input.dish);
      showToast(t('cellar.quick.wishAdded'), 'success');
    },
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  const refine = () => {
    if (trimmedDish.length === 0 || pairing.isPending) return;
    setPlanBlocked(false);
    pairing.mutate(trimmedDish);
  };

  // Le résultat IA affiché correspond toujours au plat saisi.
  const aiResult = pairing.data && pairing.variables === trimmedDish ? pairing.data : null;
  const openItem = (itemId: string) => router.push(routes.item(itemId) as Href);

  return (
    <Screen title={t('cellar.sommelierTitle')} backFallback={routes.collection()}>
      <VText variant="title" accessibilityRole="header">
        {t('cellar.sommelierTitle')}
      </VText>
      <VText variant="caption" tone="dim">
        {t('cellar.sommelierIntro')}
      </VText>

      <VTextInput
        label={t('cellar.dishLabel')}
        value={dish}
        onChangeText={(value) => {
          setDish(value);
          setWishSaved(null);
        }}
        placeholder={t('cellar.dishPlaceholder')}
        autoCapitalize="none"
      />

      {/* 1. Suggestion rapide, locale et instantanée. */}
      <View style={styles.section}>
        <VText variant="heading" tone="gold" accessibilityRole="header">
          {t('cellar.search')}
        </VText>
        <View style={styles.inline}>
          <VBadge label={t('cellar.quick.title')} tone="gold" />
          <VText variant="caption" tone="dim" style={styles.flex}>
            {t('cellar.quick.hint')}
          </VText>
        </View>

        {trimmedDish.length < MIN_DISH_LENGTH ? (
          <VText variant="body" tone="dim">
            {t('cellar.quick.typeMore')}
          </VText>
        ) : itemsQuery.isLoading ? (
          <View style={styles.inline}>
            <VSpinner />
            <VText variant="body" tone="dim">
              {t('cellar.quick.loading')}
            </VText>
          </View>
        ) : itemsQuery.isError && itemsQuery.data === undefined ? (
          <View style={styles.inline}>
            <VText variant="body" tone="danger" style={styles.flex}>
              {`${t('cellar.quick.loadError')} ${errorMessage(itemsQuery.error, t)}`}
            </VText>
            <VButton label={t('common.retry')} variant="ghost" onPress={() => void itemsQuery.refetch()} />
          </View>
        ) : wines.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('cellar.quick.emptyCellar')}
          </VText>
        ) : quick && quick.suggestions.length > 0 ? (
          <QuickPairingList suggestions={quick.suggestions} onOpenItem={openItem} />
        ) : quick && quick.categories.length === 0 ? (
          <VText variant="body" tone="dim">
            {t('cellar.quick.unrecognized')}
          </VText>
        ) : quick ? (
          <VCard style={styles.card}>
            <VText variant="body">{t('cellar.quick.nothingSuitable')}</VText>
            <VText variant="heading" tone="gold">
              {t('cellar.quick.buyTitle')}
            </VText>
            <VText variant="body">{quick.purchaseIdeas.join(' · ')}</VText>
            <VButton
              label={t('cellar.quick.addWish')}
              variant="secondary"
              onPress={() => addWish.mutate({ dish: trimmedDish, ideas: quick.purchaseIdeas })}
              disabled={wishSaved === trimmedDish}
              loading={addWish.isPending}
              accessibilityHint={t('cellar.quick.addWishHint')}
            />
            {wishSaved === trimmedDish ? (
              <VText variant="caption" tone="gold">
                {t('cellar.quick.wishAdded')}
              </VText>
            ) : null}
          </VCard>
        ) : null}
      </View>

      {/* 2. Affinage par le sommelier IA (Gold+, à la demande). */}
      <View style={styles.section}>
        <VText variant="heading" tone="gold" accessibilityRole="header">
          {t('cellar.refine.title')}
        </VText>
        <VText variant="caption" tone="dim">
          {t('cellar.refine.hint')}
        </VText>
        <VButton
          label={t('cellar.refine.button')}
          variant="secondary"
          onPress={refine}
          disabled={trimmedDish.length === 0 || pairing.isPending}
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

        {planBlocked ? (
          <VCard style={styles.card}>
            <VText variant="body">{t('cellar.refine.planRequired')}</VText>
            <VButton label={t('cellar.seeOffers')} variant="ghost" onPress={() => router.push(routes.paywall() as Href)} />
          </VCard>
        ) : null}

        {aiResult ? (
          <>
            {aiResult.recommendations.length === 0 && !aiResult.fallbackAdvice ? (
              <VText variant="body" tone="dim" style={styles.card}>
                {t('cellar.noResult')}
              </VText>
            ) : null}

            {aiResult.recommendations.map((reco) => {
              const location = positionLabel(locationById.get(reco.itemId), t);
              return (
                <VCard key={reco.itemId} style={styles.card} onPress={() => openItem(reco.itemId)}>
                  <View style={styles.recoHeader}>
                    <VText variant="heading" tone="gold" style={styles.flex}>
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

            {aiResult.fallbackAdvice ? (
              <VCard style={styles.card}>
                <VText variant="heading" tone="gold">
                  {t('cellar.fallbackTitle')}
                </VText>
                <VText variant="body">{aiResult.fallbackAdvice}</VText>
              </VCard>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: velumSpacing.lg, gap: velumSpacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  searching: { marginTop: velumSpacing.md, gap: velumSpacing.sm, alignItems: 'center' },
  card: { gap: velumSpacing.xs },
  recoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  flex: { flex: 1 },
});
