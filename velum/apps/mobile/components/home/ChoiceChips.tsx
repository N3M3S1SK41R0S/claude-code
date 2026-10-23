/**
 * Puces de choix exclusif (ex. tri de la collection) : groupe de boutons
 * radio accessible, cibles ≥ 44 pt (56 en mode senior), défilement
 * horizontal si l'écran est étroit.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Nom accessible s'il diffère du libellé visible (ex. « Valeur ↓ »). */
  accessibilityLabel?: string;
}

export interface ChoiceChipsProps<T extends string> {
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Nom du groupe lu par les lecteurs d'écran. */
  accessibilityLabel: string;
}

export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: ChoiceChipsProps<T>) {
  const { senior, scale } = useSeniorMode();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, checked: selected }}
            // RN-web ne dérive pas aria-checked de accessibilityState : attribut
            // explicite, requis pour le rôle « radio » (axe aria-required-attr).
            aria-checked={selected}
            style={({ pressed }) => [
              styles.chip,
              { minHeight: touchTargetSize(senior) },
              selected ? styles.chipSelected : null,
              pressed && styles.pressed,
            ]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.label, { fontSize: scale(14) }, selected ? styles.labelSelected : null]}
            >
              {option.label}
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
  pressed: { opacity: 0.8 },
});
