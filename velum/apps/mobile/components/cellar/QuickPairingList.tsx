/**
 * Suggestions RAPIDES (appariement local, sans IA) : vin, pertinence honnête,
 * raison courte, POSITION en cave. Utilisé par le sommelier de cave (liste
 * complète) et le sommelier d'événement (forme compacte, par plat).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LocalPairingSuggestion } from '@velum/core';
import { ConfidenceBadge, VCard, VText, velumSpacing } from '@velum/ui';

import { localSuggestionReason, positionLabel } from '../../lib/cellarPeak';

export interface QuickPairingListProps {
  suggestions: readonly LocalPairingSuggestion[];
  onOpenItem: (itemId: string) => void;
  /** Forme compacte (sans raison détaillée) pour le menu d'événement. */
  compact?: boolean;
}

export function QuickPairingList({ suggestions, onOpenItem, compact = false }: QuickPairingListProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {suggestions.map((suggestion) => {
        const position = positionLabel(suggestion.storageLocation, t);
        const label = suggestion.label.length > 0 ? suggestion.label : t('common.unknown');
        return (
          <VCard
            key={suggestion.itemId}
            onPress={() => onOpenItem(suggestion.itemId)}
            accessibilityLabel={t('cellar.quick.openItemA11y', { label })}
            accessibilityHint={t('cellar.quick.openItem')}
            style={compact ? styles.compactCard : styles.card}
          >
            <View style={styles.header}>
              <VText variant={compact ? 'body' : 'heading'} tone="gold" style={styles.flex}>
                {label}
              </VText>
              <ConfidenceBadge value={suggestion.score} />
            </View>
            {position ? (
              <VText variant="body" tone="gold">
                {t('cellar.location', { location: position })}
              </VText>
            ) : null}
            {compact ? null : (
              <VText variant="caption">{localSuggestionReason(suggestion, t)}</VText>
            )}
            {!compact && suggestion.quantity !== undefined ? (
              <VText variant="caption" tone="dim">
                {t('cellar.quantity', { count: suggestion.quantity })}
              </VText>
            ) : null}
          </VCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: velumSpacing.sm },
  card: { gap: velumSpacing.xs },
  compactCard: { gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  flex: { flex: 1 },
});
