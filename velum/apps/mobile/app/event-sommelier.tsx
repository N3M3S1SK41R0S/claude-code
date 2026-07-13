/**
 * Sommelier d'événement (Gold+) — composez un MENU complet (entrée, plat,
 * dessert) et obtenez, pour chaque plat, le meilleur accord DANS VOTRE CAVE.
 * Réutilise l'Edge Function cellar-pairing (anti-hallucination serveur), une
 * requête par plat renseigné. Même garde d'abonnement que le sommelier simple.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
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

type CourseKey = 'starter' | 'main' | 'dessert';
const COURSES: CourseKey[] = ['starter', 'main', 'dessert'];

interface CourseResult {
  course: CourseKey;
  dish: string;
  result: PairingResult;
}

export default function EventSommelier() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();
  const [dishes, setDishes] = useState<Record<CourseKey, string>>({
    starter: '',
    main: '',
    dessert: '',
  });
  const [planBlocked, setPlanBlocked] = useState(false);

  const pairing = useMutation<CourseResult[], unknown, { course: CourseKey; dish: string }[]>({
    mutationFn: async (courses) => {
      const out: CourseResult[] = [];
      for (const { course, dish } of courses) {
        const result = await client.edge.cellarPairing(dish);
        out.push({ course, dish, result });
      }
      return out;
    },
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
            title={t('event.title')}
            message={t('cellar.planRequired')}
            action={{ label: t('cellar.seeOffers'), onPress: () => router.push('/paywall') }}
          />
        </View>
      </Screen>
    );
  }

  const submit = () => {
    const courses = COURSES.filter((c) => dishes[c].trim().length > 0).map((c) => ({
      course: c,
      dish: dishes[c].trim(),
    }));
    if (courses.length > 0) pairing.mutate(courses);
  };

  const anyDish = COURSES.some((c) => dishes[c].trim().length > 0);

  return (
    <Screen>
      <VText variant="title">{t('event.title')}</VText>
      <VText variant="body" tone="dim">
        {t('event.intro')}
      </VText>

      {COURSES.map((course) => (
        <VTextInput
          key={course}
          label={t(`event.${course}`)}
          value={dishes[course]}
          onChangeText={(v) => setDishes((d) => ({ ...d, [course]: v }))}
          placeholder={t(`event.${course}Placeholder`)}
          autoCapitalize="none"
        />
      ))}

      <VButton
        label={t('event.compose')}
        onPress={submit}
        disabled={!anyDish || pairing.isPending}
        loading={pairing.isPending}
      />

      {pairing.isPending ? (
        <View style={styles.searching}>
          <VSpinner />
          <VText variant="body" tone="dim" center>
            {t('event.composing')}
          </VText>
        </View>
      ) : null}

      {pairing.data?.map(({ course, dish, result }) => (
        <VCard key={course} style={styles.courseCard}>
          <VText variant="heading" tone="gold">
            {t(`event.${course}`)}
          </VText>
          <VText variant="caption" tone="dim">
            {dish}
          </VText>
          {result.recommendations.length === 0 && !result.fallbackAdvice ? (
            <VText variant="body" tone="dim">
              {t('cellar.noResult')}
            </VText>
          ) : null}
          {result.recommendations.map((reco) => (
            <View key={reco.itemId} style={styles.reco}>
              <View style={styles.recoHeader}>
                <VText variant="body" tone="gold">
                  {reco.label}
                </VText>
                <ConfidenceBadge value={reco.score} />
              </View>
              <VText variant="caption">{reco.reasoning}</VText>
            </View>
          ))}
          {result.fallbackAdvice ? (
            <VText variant="caption" tone="dim">
              {result.fallbackAdvice}
            </VText>
          ) : null}
        </VCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  searching: { marginTop: velumSpacing.lg, gap: velumSpacing.sm, alignItems: 'center' },
  courseCard: { marginTop: velumSpacing.md, gap: velumSpacing.xs },
  reco: { marginTop: velumSpacing.xs, gap: 2 },
  recoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
});
