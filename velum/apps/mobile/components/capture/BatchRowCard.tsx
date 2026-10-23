/**
 * Ligne du mode classeur : vignette, statut, meilleur candidat (confiance,
 * fourchette indicative), autres propositions, et les actions de la ligne —
 * Enregistrer / Corriger (champs principaux en ligne) / Ignorer, Réessayer
 * pour un échec, Rétablir pour une ligne ignorée, Voir la fiche une fois
 * enregistrée.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import {
  ConfidenceBadge,
  VBadge,
  VButton,
  VCard,
  VText,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumSpacing,
  type VBadgeTone,
} from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { effectiveCandidate, type BatchRow, type BatchRowStatus } from '../../lib/batchQueue';
import { IdentityCorrectionForm, type CorrectionDraft } from './IdentityCorrectionForm';
import { QuickFacts } from './QuickFacts';

const STATUS_TONE: Record<BatchRowStatus, VBadgeTone> = {
  pending: 'neutral',
  running: 'gold',
  identified: 'success',
  uncertain: 'warning',
  failed: 'danger',
  saving: 'gold',
  saved: 'success',
  skipped: 'neutral',
};

export interface BatchRowCardProps {
  row: BatchRow;
  domain: VelumDomain;
  /** Numéro affiché (ordre de prise). */
  number: number;
  editing: boolean;
  /** Message d'erreur déjà traduit (échec de reconnaissance ou d'enregistrement). */
  errorText?: string;
  onSave: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (draft: CorrectionDraft) => void;
  onChoose: (index: number) => void;
  onSkip: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onOpen: () => void;
}

export function BatchRowCard({
  row,
  domain,
  number,
  editing,
  errorText,
  onSave,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onChoose,
  onSkip,
  onRestore,
  onRetry,
  onRemove,
  onOpen,
}: BatchRowCardProps) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const candidate = effectiveCandidate(row);
  const recognized = row.status === 'identified' || row.status === 'uncertain';
  const thumbSize = scale(56);
  const title =
    row.source === 'sheet'
      ? t('batch.sheetPhoto')
      : (candidate?.label ?? (recognized ? t('batch.noCandidate') : t('batch.waitingLabel')));

  return (
    <VCard style={styles.card}>
      <View style={styles.header}>
        {row.thumbnailUri ? (
          <Image
            source={{ uri: row.thumbnailUri }}
            style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
            contentFit="cover"
            accessibilityLabel={t('batch.thumbnailLabel', { n: number })}
          />
        ) : null}
        <View style={styles.titles}>
          <View style={styles.badges}>
            <VBadge label={t(`batch.status.${row.status}`)} tone={STATUS_TONE[row.status]} />
            {row.position ? (
              <VText variant="caption" tone="dim">
                {row.position}
              </VText>
            ) : null}
          </View>
          <VText variant="body" numberOfLines={2}>
            {`${number}. ${title}`}
          </VText>
        </View>
        {candidate && recognized ? <ConfidenceBadge value={candidate.confidence} /> : null}
      </View>

      {candidate && row.status !== 'skipped' ? (
        <QuickFacts classification={candidate.classification} quickEstimate={candidate.quickEstimate} />
      ) : null}

      {errorText ? (
        <VText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {errorText}
        </VText>
      ) : null}

      {/* Autres propositions : un appui suffit pour changer de candidat. */}
      {recognized && !editing && row.edited === undefined && row.candidates.length > 1 ? (
        <View style={styles.alternatives}>
          {row.candidates.map((alt, index) =>
            index === row.chosenIndex ? null : (
              <Pressable
                key={alt.id}
                onPress={() => onChoose(index)}
                accessibilityRole="button"
                accessibilityLabel={t('batch.chooseAlternative', { label: alt.label })}
                style={({ pressed }) => [
                  styles.alternative,
                  { minHeight: touchTargetSize(senior) },
                  pressed && styles.pressed,
                ]}
              >
                <VText variant="caption" tone="gold" numberOfLines={1}>
                  {t('batch.alternative', { label: alt.label, percent: Math.round(alt.confidence * 100) })}
                </VText>
              </Pressable>
            ),
          )}
        </View>
      ) : null}

      {editing ? (
        <IdentityCorrectionForm
          domain={domain}
          base={candidate}
          title={t('batch.correctTitle')}
          primaryOnly
          actions={[{ label: t('batch.validate'), onSubmit: onSubmitEdit }]}
          onCancel={onCancelEdit}
        />
      ) : (
        <View style={styles.actions}>
          {recognized ? (
            <>
              {candidate ? (
                <View style={styles.cell}>
                  <VButton label={t('batch.save')} onPress={onSave} />
                </View>
              ) : null}
              <View style={styles.cell}>
                <VButton label={t('batch.correct')} variant="secondary" onPress={onEdit} />
              </View>
              <View style={styles.cell}>
                <VButton label={t('batch.skip')} variant="ghost" onPress={onSkip} />
              </View>
            </>
          ) : null}
          {row.status === 'failed' ? (
            <>
              <View style={styles.cell}>
                <VButton label={t('common.retry')} onPress={onRetry} />
              </View>
              <View style={styles.cell}>
                <VButton label={t('batch.remove')} variant="ghost" onPress={onRemove} />
              </View>
            </>
          ) : null}
          {row.status === 'skipped' ? (
            <>
              <View style={styles.cell}>
                <VButton label={t('batch.restore')} variant="secondary" onPress={onRestore} />
              </View>
              <View style={styles.cell}>
                <VButton label={t('batch.remove')} variant="ghost" onPress={onRemove} />
              </View>
            </>
          ) : null}
          {row.status === 'saved' ? (
            <View style={styles.cell}>
              <VButton label={t('batch.open')} variant="ghost" onPress={onOpen} />
            </View>
          ) : null}
          {row.status === 'saving' ? (
            <View style={styles.cell}>
              <VButton label={t('batch.status.saving')} onPress={onSave} loading disabled />
            </View>
          ) : null}
        </View>
      )}
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.md },
  thumb: { borderRadius: 8, backgroundColor: velumColors.ink.raised },
  titles: { flex: 1, gap: velumSpacing.xs },
  badges: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm, flexWrap: 'wrap' },
  alternatives: { gap: velumSpacing.xs },
  alternative: {
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm },
  cell: { flexGrow: 1, flexBasis: 110 },
});
