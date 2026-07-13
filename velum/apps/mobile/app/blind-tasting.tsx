/**
 * Dégustation à l'aveugle (cave) — « pour s'amuser avec des amis ».
 * Tire des bouteilles DE SA CAVE dans un ordre aléatoire (seedé, donc
 * reproductible tant qu'on ne relance pas), sert des cartes anonymes
 * « Vin n°X » avec un déroulé guidé (robe, premier/second nez, attaque,
 * évolution, finale, garde, devinettes), et cache les réponses jusqu'au
 * dévoilement. Export d'une feuille imprimable (cartes + page réponses).
 * 100 % local : aucun appel réseau, aucun coût — pas de gating serveur.
 */
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  MIN_TOUCH_TARGET,
  VBadge,
  VButton,
  VCard,
  VEmptyState,
  VSpinner,
  VText,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';
import type { VelumItem, WineAnalysisPayload } from '@velum/core';
import {
  buildBlindTastingSession,
  type BlindTastingSession,
  type BlindTastingWine,
} from '@velum/domain-wine';

import { Screen } from '../components/Screen';
import { getVelumClient } from '../lib/client';
import { buildBlindTastingHtml } from '../lib/exporters';
import { showToast } from '../stores/toastStore';

/** Nombre de bouteilles proposé par défaut (raisonnable pour une soirée). */
const DEFAULT_COUNT = 6;
const MIN_BOTTLES = 2;

/** Items vin → bouteilles candidates (payload d'analyse conservé s'il existe). */
function toBlindWines(items: VelumItem[]): BlindTastingWine[] {
  const out: BlindTastingWine[] = [];
  for (const item of items) {
    if (item.domain !== 'wine') continue;
    const attrs = item.attributes as { analysis?: unknown; vintage?: unknown };
    const analysis =
      attrs.analysis && typeof attrs.analysis === 'object'
        ? (attrs.analysis as WineAnalysisPayload)
        : undefined;
    out.push({
      itemId: item.id,
      label: item.title ?? '',
      ...(typeof attrs.vintage === 'number' ? { vintage: attrs.vintage } : {}),
      ...(analysis ? { payload: analysis } : {}),
    });
  }
  return out;
}

export default function BlindTasting() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = getVelumClient();

  const [count, setCount] = useState(DEFAULT_COUNT);
  const [seed, setSeed] = useState(1);
  const [showAnswers, setShowAnswers] = useState(false);
  const [exporting, setExporting] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ['items', 'wine'],
    queryFn: () => client.items.list('wine'),
    staleTime: 60 * 1000,
  });

  const wines = useMemo(() => toBlindWines(itemsQuery.data ?? []), [itemsQuery.data]);
  const maxBottles = wines.length;
  const effectiveCount = Math.min(count, maxBottles);

  const session: BlindTastingSession | null = useMemo(() => {
    if (wines.length < MIN_BOTTLES) return null;
    return buildBlindTastingSession(wines, { count: effectiveCount, seed });
  }, [wines, effectiveCount, seed]);

  const regenerate = () => {
    setSeed((s) => s + 1);
    setShowAnswers(false);
  };

  const changeCount = (delta: number) => {
    setCount((c) => Math.max(MIN_BOTTLES, Math.min(maxBottles, c + delta)));
    setShowAnswers(false);
  };

  const exportSheet = async () => {
    if (!session || exporting) return;
    setExporting(true);
    try {
      const html = buildBlindTastingHtml(session, t);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } else if (Platform.OS === 'web') {
        showToast(t('blind.exportWebHint'), 'info');
      }
    } catch {
      showToast(t('blind.exportError'), 'danger');
    } finally {
      setExporting(false);
    }
  };

  if (itemsQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VSpinner />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <VEmptyState
            title={t('blind.title')}
            message={t('blind.needsMore', { min: MIN_BOTTLES })}
            action={{ label: t('blind.goToCapture'), onPress: () => router.push('/(tabs)/capture') }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <VText variant="title">{t('blind.title')}</VText>
      <VText variant="body" tone="dim">
        {t('blind.intro')}
      </VText>

      {/* Nombre de bouteilles : − / valeur / + (cibles ≥ 44 pt). */}
      <VCard style={styles.controls}>
        <VText variant="caption" tone="dim">
          {t('blind.countLabel')}
        </VText>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => changeCount(-1)}
            disabled={effectiveCount <= MIN_BOTTLES}
            accessibilityRole="button"
            accessibilityLabel={t('blind.countMinus')}
            style={({ pressed }) => [
              styles.stepBtn,
              pressed && styles.pressed,
              effectiveCount <= MIN_BOTTLES && styles.stepDisabled,
            ]}
          >
            <VText variant="heading">−</VText>
          </Pressable>
          <VText variant="heading" tone="gold">
            {effectiveCount}
          </VText>
          <Pressable
            onPress={() => changeCount(1)}
            disabled={effectiveCount >= maxBottles}
            accessibilityRole="button"
            accessibilityLabel={t('blind.countPlus')}
            style={({ pressed }) => [
              styles.stepBtn,
              pressed && styles.pressed,
              effectiveCount >= maxBottles && styles.stepDisabled,
            ]}
          >
            <VText variant="heading">+</VText>
          </Pressable>
        </View>
        <VText variant="caption" tone="dim">
          {t('blind.available', { count: maxBottles })}
        </VText>
        <VButton label={t('blind.regenerate')} variant="secondary" onPress={regenerate} />
      </VCard>

      {/* Cartes anonymes servies aux joueurs. */}
      {session.cards.map((card) => (
        <VCard key={card.number} style={styles.card}>
          <VText variant="heading" tone="gold">
            {t('blind.wineNumber', { number: card.number })}
          </VText>
          {card.steps.map((step) => (
            <View key={step.key} style={styles.stepRow}>
              <VText variant="body" style={styles.stepLabel}>
                {t(`blind.steps.${step.key}`)}
              </VText>
              {step.kind === 'guess' ? <VBadge tone="warning" label={t('blind.guessTag')} /> : null}
            </View>
          ))}
        </VCard>
      ))}

      {/* Réponses : masquées par défaut, dévoilées à la demande. */}
      <VButton
        label={showAnswers ? t('blind.hideAnswers') : t('blind.revealAnswers')}
        onPress={() => setShowAnswers((v) => !v)}
      />
      {showAnswers ? (
        <VCard style={styles.card}>
          <VText variant="heading">{t('blind.answersTitle')}</VText>
          {session.answers.map((answer) => (
            <View key={answer.number} style={styles.answerRow}>
              <VText variant="body" tone="gold">
                {`${answer.number}. ${answer.label}${answer.vintage !== undefined ? ` ${answer.vintage}` : ''}`}
              </VText>
              {answer.hints.length > 0 ? (
                <VText variant="caption" tone="dim">
                  {`${t('blind.hintsLabel')} ${answer.hints.join(' · ')}`}
                </VText>
              ) : null}
            </View>
          ))}
        </VCard>
      ) : null}

      <VButton
        label={t('blind.printSheet')}
        variant="secondary"
        onPress={exportSheet}
        loading={exporting}
        disabled={exporting}
        accessibilityHint={t('blind.printHint')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  controls: { gap: velumSpacing.sm, alignItems: 'flex-start' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.lg,
  },
  stepBtn: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  stepDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  card: { gap: velumSpacing.xs, marginTop: velumSpacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  stepLabel: { flex: 1 },
  answerRow: { gap: 2, marginTop: velumSpacing.xs },
});
