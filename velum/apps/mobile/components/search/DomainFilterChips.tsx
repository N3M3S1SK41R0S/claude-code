/**
 * Puces de filtre par catégorie (« Toutes » + domaines actifs). Groupe de
 * boutons radio accessible ; défilement horizontal si l'écran est étroit.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { VelumDomain } from '@velum/core';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  useSeniorMode,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import { getActiveDomains } from '../../lib/features';

export interface DomainFilterChipsProps {
  /** null = toutes les catégories. */
  value: VelumDomain | null;
  onChange: (domain: VelumDomain | null) => void;
  /** Domaines proposés (défaut : domaines actifs selon les flags). */
  domains?: readonly VelumDomain[];
  /** Masque la puce « Toutes ». */
  hideAll?: boolean;
}

export function DomainFilterChips({ value, onChange, domains, hideAll = false }: DomainFilterChipsProps) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const options: (VelumDomain | null)[] = [
    ...(hideAll ? [] : [null]),
    ...(domains ?? getActiveDomains()),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('search.categoryFilter')}
    >
      {options.map((domain) => {
        const selected = value === domain;
        const label = domain === null ? t('search.allCategories') : t(`domains.${domain}.name`);
        return (
          <Pressable
            key={domain ?? 'all'}
            onPress={() => onChange(domain)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected, checked: selected }}
            style={[
              styles.chip,
              { minHeight: senior ? 56 : 44 },
              selected ? styles.chipSelected : null,
            ]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[
                styles.label,
                { fontSize: scale(14) },
                selected ? styles.labelSelected : null,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: velumSpacing.sm, paddingVertical: velumSpacing.xs },
  chip: {
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.lg,
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  chipSelected: { borderColor: velumColors.gold.DEFAULT, backgroundColor: velumColors.ink.raised },
  label: { color: velumColors.parchment.dim, fontWeight: '600' },
  labelSelected: { color: velumColors.gold.soft },
});
