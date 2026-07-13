/**
 * Carte de module (Vin, Pièces, Tableaux, Timbres) — grille de capture
 * et choix des modules à l'onboarding.
 */
import { StyleSheet, View } from 'react-native';
import { VCard, VText, velumColors, velumSpacing } from '@velum/ui';
import type { VelumDomain } from '@velum/core';

import { ModuleGlyph } from './ModuleGlyph';

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
      <VCard
        onPress={onPress}
        accessibilityLabel={`${title} — ${subtitle}`}
        style={selected ? styles.selected : undefined}
      >
        {/* Contenu non interactif : le rôle bouton est porté par la carte. */}
        <View style={styles.content}>
          <ModuleGlyph
            domain={domain}
            size={40}
            color={selected ? velumColors.gold.DEFAULT : velumColors.gold.soft}
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
