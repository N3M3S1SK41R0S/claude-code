/**
 * Tuile de l'onglet Capturer : un domaine et ses trois façons d'enregistrer —
 * Scan éclair, Mode classeur, Saisie complète. Le classeur est mis en avant
 * pour les timbres et les pièces (on y range des séries entières).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  VBadge,
  VButton,
  VCard,
  VText,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumSpacing,
} from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { ModuleGlyph } from '../ModuleGlyph';

export interface CaptureDomainCardProps {
  domain: VelumDomain;
  title: string;
  subtitle: string;
  /** Classeur en action principale (timbres, pièces). */
  binderFirst: boolean;
  onQuick: () => void;
  onBatch: () => void;
  onFull: () => void;
}

export function CaptureDomainCard({
  domain,
  title,
  subtitle,
  binderFirst,
  onQuick,
  onBatch,
  onFull,
}: CaptureDomainCardProps) {
  const { t } = useTranslation();
  const { senior } = useSeniorMode();
  const primary = binderFirst ? onBatch : onQuick;

  const quick = (
    <VButton
      key="quick"
      label={t('capture.modeQuick')}
      accessibilityHint={t('capture.modeQuickHint')}
      variant={binderFirst ? 'secondary' : 'primary'}
      onPress={onQuick}
    />
  );
  const batch = (
    <VButton
      key="batch"
      label={t('capture.modeBatch')}
      accessibilityHint={t('capture.modeBatchHint')}
      variant={binderFirst ? 'primary' : 'secondary'}
      onPress={onBatch}
    />
  );

  return (
    <VCard style={styles.card}>
      {/* L'en-tête lance l'action principale du domaine (comme avant : un appui suffit). */}
      <Pressable
        onPress={primary}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${binderFirst ? t('capture.modeBatch') : t('capture.modeQuick')}`}
        accessibilityHint={subtitle}
        style={({ pressed }) => [styles.header, { minHeight: touchTargetSize(senior) }, pressed && styles.pressed]}
      >
        <ModuleGlyph domain={domain} size={36} color={velumColors.gold.soft} />
        <View style={styles.titles}>
          <VText variant="heading">{title}</VText>
          <VText variant="caption" tone="dim">
            {subtitle}
          </VText>
        </View>
        {binderFirst ? <VBadge label={t('capture.binderBadge')} tone="gold" /> : null}
      </Pressable>
      <View style={styles.actions}>
        <View style={styles.cell}>{binderFirst ? batch : quick}</View>
        <View style={styles.cell}>{binderFirst ? quick : batch}</View>
      </View>
      <VButton
        label={t('capture.modeFull')}
        accessibilityHint={t('capture.modeFullHint')}
        variant="ghost"
        onPress={onFull}
      />
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.md },
  titles: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm, marginTop: velumSpacing.xs },
  cell: { flexGrow: 1, flexBasis: 140 },
});
