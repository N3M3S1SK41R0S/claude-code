/**
 * Carte d'un candidat du scan éclair : libellé + confiance, classement et
 * fourchette indicative, puis les actions — l'action principale en premier
 * (Enregistrer tout de suite, ou avec la fiche complète en saisie complète),
 * les autres en dessous (Corriger, Ajouter à mes envies, autre enregistrement).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ConfidenceBadge, VButton, VCard, VText, velumSpacing } from '@velum/ui';
import type { Candidate } from '@velum/core';

import type { CaptureMode } from '../../stores/captureStore';
import { QuickFacts } from './QuickFacts';

export interface CandidateCardProps {
  candidate: Candidate;
  mode: CaptureMode;
  /** Mise en avant du candidat le plus probable. */
  highlighted?: boolean;
  /** Une action est en cours sur CE candidat (spinner sur le bon bouton). */
  busy?: 'quick' | 'full' | 'wish' | null;
  /** Une action est en cours ailleurs : boutons inactifs. */
  disabled?: boolean;
  onSave: () => void;
  onSaveFull: () => void;
  onCorrect: () => void;
  onWish: () => void;
}

export function CandidateCard({
  candidate,
  mode,
  highlighted = false,
  busy = null,
  disabled = false,
  onSave,
  onSaveFull,
  onCorrect,
  onWish,
}: CandidateCardProps) {
  const { t } = useTranslation();
  const inactive = disabled || busy !== null;
  const quick = (
    <VButton
      key="quick"
      label={t('candidates.save')}
      accessibilityHint={t('candidates.saveHint')}
      variant={mode === 'quick' ? 'primary' : 'secondary'}
      onPress={onSave}
      loading={busy === 'quick'}
      disabled={inactive}
    />
  );
  const full = (
    <VButton
      key="full"
      label={t('candidates.saveFull')}
      accessibilityHint={t('candidates.saveFullHint')}
      variant={mode === 'full' ? 'primary' : 'ghost'}
      onPress={onSaveFull}
      loading={busy === 'full'}
      disabled={inactive}
    />
  );

  return (
    <VCard tone={highlighted ? 'gilded' : 'default'} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <VText variant="heading">{candidate.label}</VText>
        </View>
        <ConfidenceBadge value={candidate.confidence} />
      </View>
      <QuickFacts
        classification={candidate.classification}
        quickEstimate={candidate.quickEstimate}
        withHint={highlighted}
      />
      <View style={styles.actions}>
        {mode === 'quick' ? quick : full}
        <View style={styles.secondary}>
          <View style={styles.cell}>
            <VButton label={t('candidates.correct')} variant="secondary" onPress={onCorrect} disabled={inactive} />
          </View>
          <View style={styles.cell}>
            <VButton
              label={t('candidates.addWish')}
              accessibilityHint={t('candidates.addWishHint')}
              variant="ghost"
              onPress={onWish}
              loading={busy === 'wish'}
              disabled={inactive}
            />
          </View>
        </View>
        {mode === 'quick' ? full : quick}
      </View>
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: velumSpacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: velumSpacing.sm,
  },
  title: { flex: 1 },
  actions: { gap: velumSpacing.sm, marginTop: velumSpacing.md },
  secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  cell: { flexGrow: 1, flexBasis: 140 },
});
