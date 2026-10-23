/**
 * Ligne de la liste d'envies : titre, extrait des notes, prix cible, badge de
 * priorité, origine. Une seule cible tactile (≥ 44/56 pt) qui ouvre l'envie ;
 * le libellé accessible reprend toutes les informations visibles.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { WishlistEntry } from '@velum/core';
import { VBadge, VText, touchTargetSize, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import { formatDate } from '../../lib/i18n';
import { PRIORITY_BADGE_KEY, PRIORITY_TONE, formatTargetPrice, notesExcerpt } from '../../lib/wishlist';

export interface WishlistRowProps {
  entry: WishlistEntry;
  onPress: () => void;
  /** Affiche la catégorie (vue « Toutes » non groupée, résultats de recherche). */
  showDomain?: boolean;
}

export function WishlistRow({ entry, onPress, showDomain = false }: WishlistRowProps) {
  const { t, i18n } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const excerpt = notesExcerpt(entry.notes);
  const priorityLabel = t(PRIORITY_BADGE_KEY[entry.priority]);
  const meta = [
    entry.acquired && entry.acquiredAt
      ? t('wishlist.row.acquiredOn', { date: formatDate(entry.acquiredAt) })
      : null,
    entry.targetPrice !== null
      ? t('wishlist.row.targetPrice', { price: formatTargetPrice(entry.targetPrice, i18n.language) })
      : null,
    showDomain ? t(`domains.${entry.domain}.name`) : null,
    t(`wishlist.source.${entry.source}`),
  ].filter((part): part is string => part !== null);

  const accessibilityLabel = [
    entry.title,
    entry.kind === 'idea' ? t('wishlist.kind.idea') : null,
    priorityLabel,
    ...meta,
    excerpt,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t('wishlist.row.openHint')}
      style={({ pressed }) => [styles.row, { minHeight: touchTargetSize(senior) }, pressed && styles.pressed]}
    >
      <View style={styles.text} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <VText variant="body" numberOfLines={2}>
          {entry.title}
        </VText>
        {excerpt ? (
          <VText variant="caption" tone="dim" numberOfLines={1}>
            {excerpt}
          </VText>
        ) : null}
        <VText variant="caption" tone="dim" tabularNums>
          {meta.join(' · ')}
        </VText>
      </View>
      <View style={styles.right} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {!entry.acquired ? (
          <VBadge label={t(`wishlist.priority.${entry.priority}`)} tone={PRIORITY_TONE[entry.priority]} />
        ) : null}
        <Ionicons name="chevron-forward" size={scale(18)} color={velumColors.parchment.faint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.md,
    paddingVertical: velumSpacing.sm,
    paddingHorizontal: velumSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: velumColors.ink.border,
  },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.xs },
});
