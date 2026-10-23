/**
 * Puces de choix unique (groupe radio accessible) — filtres couleur de la cave,
 * moment du rappel. Cibles ≥ 44 pt (56 en mode senior), retour à la ligne
 * plutôt que défilement horizontal pour tout voir d'un coup d'œil.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
}

export interface ChoiceChipsProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé accessible du groupe. */
  label: string;
}

export function ChoiceChips<T extends string>({ options, value, onChange, label }: ChoiceChipsProps<T>) {
  const { senior, scale } = useSeniorMode();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            hitSlop={4}
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
              style={[styles.text, { fontSize: scale(14) }, selected ? styles.textSelected : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.sm, paddingVertical: velumSpacing.xs },
  chip: {
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.lg,
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    backgroundColor: velumColors.ink.soft,
  },
  chipSelected: { borderColor: velumColors.gold.DEFAULT, backgroundColor: velumColors.ink.raised },
  pressed: { opacity: 0.7 },
  text: { color: velumColors.parchment.dim, fontWeight: '600' },
  textSelected: { color: velumColors.gold.soft },
});
