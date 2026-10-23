/**
 * Ligne de « Mes vins à leur apogée » : urgence, libellé, POSITION bien
 * visible (ou invitation à la saisir), quantité, fenêtre, plats suggérés et
 * deux actions directes : « Accord pour ce soir » et « Voir la fiche ».
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { CellarPeakEntry } from '@velum/core';
import { VBadge, VButton, VCard, VText, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import { displayWineLabel, peakStatusTone, positionLabel, vintageToShow } from '../../lib/cellarPeak';

export interface PeakWineCardProps {
  entry: CellarPeakEntry;
  onPairTonight: (dish: string | undefined) => void;
  onOpenItem: () => void;
  onEditPosition: () => void;
}

export function PeakWineCard({ entry, onPairTonight, onOpenItem, onEditPosition }: PeakWineCardProps) {
  const { t } = useTranslation();
  const { scale } = useSeniorMode();
  const position = positionLabel(entry.storageLocation, t);
  const vintage = vintageToShow(entry);
  const details = [
    vintage !== null ? t('cellarPeak.vintage', { vintage }) : null,
    entry.quantity !== undefined ? t('cellar.quantity', { count: entry.quantity }) : null,
    t('cellarPeak.window', { from: entry.windowFrom, to: entry.windowTo }),
  ].filter((part): part is string => part !== null);

  return (
    <VCard style={styles.card}>
      <View style={styles.header}>
        <VBadge label={t(`cellarPeak.status.${entry.status}`)} tone={peakStatusTone(entry.status)} />
        <VText variant="caption" tone="dim" style={styles.flex}>
          {t(`cellarPeak.statusHint.${entry.status}`)}
        </VText>
      </View>

      <VText variant="heading">{displayWineLabel(entry.label, t)}</VText>

      {position ? (
        <View
          style={styles.position}
          accessible
          accessibilityLabel={t('cellarPeak.positionA11y', { position })}
        >
          <Ionicons name="location" size={scale(20)} color={velumColors.gold.DEFAULT} />
          <VText variant="heading" tone="gold" style={styles.flex}>
            {position}
          </VText>
        </View>
      ) : (
        <View style={styles.position}>
          <Ionicons name="help-circle-outline" size={scale(20)} color={velumColors.parchment.faint} />
          <VText variant="body" tone="dim" style={styles.flex}>
            {t('cellarPeak.positionMissing')}
          </VText>
        </View>
      )}

      <VText variant="caption" tone="dim">
        {details.join(' · ')}
      </VText>
      {entry.suggestedDishes.length > 0 ? (
        <VText variant="body">{t('cellarPeak.dishes', { dishes: entry.suggestedDishes.join(', ') })}</VText>
      ) : null}

      <View style={styles.actions}>
        <VButton
          label={t('cellarPeak.pairTonight')}
          variant="secondary"
          onPress={() => onPairTonight(entry.suggestedDishes[0])}
          accessibilityHint={t('cellarPeak.pairTonightHint')}
        />
        <VButton label={t('cellarPeak.openItem')} variant="ghost" onPress={onOpenItem} />
        <VButton
          label={position ? t('cellarPeak.editPosition') : t('cellarPeak.setPosition')}
          variant="ghost"
          onPress={onEditPosition}
        />
      </View>
    </VCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: velumSpacing.xs, marginTop: velumSpacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  flex: { flex: 1 },
  position: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm, marginVertical: velumSpacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm, marginTop: velumSpacing.xs },
});
