/**
 * Groupe de puces à choix unique (segments, tri, type, priorité) — même
 * apparence que DomainFilterChips : groupe radio accessible, cibles ≥ 44 pt
 * (56 en mode senior), défilement horizontal si l'écran est étroit.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  useSeniorMode,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Indication lue par le lecteur d'écran (facultative). */
  hint?: string;
}

export interface ChoiceChipsProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé accessible du groupe (ex. « Trier par »). */
  label: string;
}

export function ChoiceChips<T extends string>({ options, value, onChange, label }: ChoiceChipsProps<T>) {
  const { senior, scale } = useSeniorMode();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            accessibilityState={{ selected, checked: selected }}
            // react-native-web n'émet pas `checked` depuis accessibilityState :
            // aria-checked est OBLIGATOIRE pour role="radio" (axe : aria-required-attr).
            aria-checked={selected}
            style={({ pressed }) => [
              styles.chip,
              { minHeight: senior ? 56 : 44 },
              selected ? styles.chipSelected : null,
              pressed ? styles.pressed : null,
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
  pressed: { opacity: 0.85 },
  label: { color: velumColors.parchment.dim, fontWeight: '600' },
  labelSelected: { color: velumColors.gold.soft },
});
