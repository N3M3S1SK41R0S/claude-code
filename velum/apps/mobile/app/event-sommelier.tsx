/**
 * Sommelier d'événement — composez un MENU complet (entrée, plat, dessert) :
 *  - suggestion RAPIDE instantanée sous chaque plat (appariement local, sans
 *    IA, hors-ligne), avec l'emplacement de la bouteille ;
 *  - accords affinés par l'IA (Gold+) : Edge Function cellar-pairing
 *    (anti-hallucination serveur), une requête par plat renseigné.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
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
import { displayWineLabel, positionLabel } from '../lib/cellarPeak';
import { getVelumClient } from '../lib/client';
import { isOfflineWithoutData } from '../lib/collectionView';
import { localPairingForItems } from '../lib/drinkNow';
import { routes } from '../lib/routes';
import { showToast } from '../stores/toastStore';

/** Longueur minimale d'un plat avant la suggestion instantanée. */
const MIN_DISH_LENGTH = 3;

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

  // Cave (même cache que le sommelier simple) pour la suggestion instantanée.
  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    staleTime: 60 * 1000,
  });
  const wines = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  // Recalcul après chaque lecture réussie (objets éventuellement modifiés en place).
  const updatedAt = itemsQuery.dataUpdatedAt;
  const year = new Date().getFullYear();
  const quickByCourse = useMemo(() => {
    const out: Partial<Record<CourseKey, ReturnType<typeof localPairingForItems>>> = {};
    for (const course of COURSES) {
      const dish = dishes[course].trim();
      if (dish.length >= MIN_DISH_LENGTH) out[course] = localPairingForItems(dish, wines, year, { limit: 2 });
    }
    return out;
  }, [dishes, wines, year, updatedAt]);
  const cellarUnreadable = itemsQuery.isError && itemsQuery.data === undefined;
  const locationById = useMemo(
    () => new Map(wines.map((item) => [item.id, item.storageLocation] as const)),
    [wines, updatedAt],
  );

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

  const submit = () => {
    const courses = COURSES.filter((c) => dishes[c].trim().length > 0).map((c) => ({
      course: c,
      dish: dishes[c].trim(),
    }));
    if (courses.length > 0) pairing.mutate(courses);
  };

  const anyDish = COURSES.some((c) => dishes[c].trim().length > 0);

  return (
    <Screen title={t('event.title')} backFallback={routes.collection()}>
      <VText variant="title" accessibilityRole="header">
        {t('event.title')}
      </VText>
      <VText variant="body" tone="dim">
        {t('event.intro')}
      </VText>

      {COURSES.map((course) => {
        const quick = quickByCourse[course];
        return (
          <View key={course} style={styles.course}>
            <VTextInput
              label={t(`event.${course}`)}
              value={dishes[course]}
              onChangeText={(v) => setDishes((d) => ({ ...d, [course]: v }))}
              placeholder={t(`event.${course}Placeholder`)}
              autoCapitalize="none"
            />
            {quick ? (
              <View style={styles.quick}>
                <VText variant="caption" tone="gold">
                  {t('event.quickTitle')}
                </VText>
                {itemsQuery.isLoading ? (
                  <VSpinner />
                ) : isOfflineWithoutData(itemsQuery) ? (
                  <VText variant="caption" tone="dim">
                    {t('event.quickOffline')}
                  </VText>
                ) : cellarUnreadable ? (
                  <View style={styles.inline}>
                    <VText variant="caption" tone="danger" style={styles.flex}>
                      {t('event.quickLoadError')}
                    </VText>
                    <VButton label={t('common.retry')} variant="ghost" onPress={() => void itemsQuery.refetch()} />
                  </View>
                ) : quick.suggestions.length > 0 ? (
                  <QuickPairingList
                    compact
                    suggestions={quick.suggestions}
                    onOpenItem={(id) => router.push(routes.item(id) as Href)}
                  />
                ) : (
                  <VText variant="caption" tone="dim">
                    {quick.categories.length === 0 ? t('event.quickUnrecognized') : t('event.quickNone')}
                  </VText>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      <VText variant="caption" tone="dim">
        {t('event.aiHint')}
      </VText>
      <VButton
        label={t('event.compose')}
        onPress={() => {
          setPlanBlocked(false);
          submit();
        }}
        disabled={!anyDish || pairing.isPending}
        loading={pairing.isPending}
      />

      {planBlocked ? (
        <VCard style={styles.courseCard}>
          <VText variant="body">{t('cellar.refine.planRequired')}</VText>
          <VButton
            label={t('cellar.seeOffers')}
            variant="ghost"
            onPress={() => router.push(routes.paywall() as Href)}
          />
        </VCard>
      ) : null}

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
                  {displayWineLabel(reco.label, t)}
                </VText>
                <ConfidenceBadge value={reco.score} />
              </View>
              <VText variant="caption">{reco.reasoning}</VText>
              {positionLabel(locationById.get(reco.itemId), t) ? (
                <VText variant="caption" tone="gold">
                  {t('cellar.location', { location: positionLabel(locationById.get(reco.itemId), t) })}
                </VText>
              ) : null}
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
  course: { gap: velumSpacing.xs },
  quick: { gap: velumSpacing.xs, marginBottom: velumSpacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  flex: { flex: 1 },
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
