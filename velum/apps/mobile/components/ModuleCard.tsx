/**
 * Carte de module (Vin, Pièces, Tableaux, Timbres) — grille de capture
 * et choix des modules à l'onboarding.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VCard, VText, velumColors, velumSpacing } from '@velum/ui';
import type { VelumDomain } from '@velum/core';

export const DOMAIN_ICONS: Record<VelumDomain, keyof typeof Ionicons.glyphMap> = {
  wine: 'wine',
  coin: 'server',
  art: 'color-palette',
  stamp: 'mail',
};

export interface ModuleCardProps {
  domain: VelumDomain;
  title: string;
  subtitle: string;
  onPress: () => void;
  selected?: boolean;
}

export function ModuleCard({ domain, title, subtitle, onPress, selected }: ModuleCardProps) {
  return (
    <View style={styles.wrapper}>
      <VCard onPress={onPress} style={selected ? styles.selected : undefined}>
        <View
          accessible
          accessibilityLabel={`${title} — ${subtitle}`}
          accessibilityRole="button"
          style={styles.content}
        >
          <Ionicons
            name={DOMAIN_ICONS[domain]}
            size={28}
            color={selected ? velumColors.gold.soft : velumColors.parchment.dim}
          />
          <VText variant="heading">{title}</VText>
          <VText variant="caption" tone="dim">
            {subtitle}
          </VText>
        </View>
      </VCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '48%' },
  content: { gap: velumSpacing.xs, minHeight: 96 },
  selected: { borderColor: velumColors.gold.DEFAULT, borderWidth: 1 },
});
