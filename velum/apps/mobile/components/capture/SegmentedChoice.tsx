/**
 * Choix exclusif compact (onglets) — modes de capture, sous-modes du
 * classeur. Cibles ≥ 44 pt (56 en mode senior), état sélectionné annoncé.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { VText, touchTargetSize, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Lu par le lecteur d'écran (conséquence du choix). */
  hint?: string;
}

export interface SegmentedChoiceProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom du groupe pour le lecteur d'écran. */
  accessibilityLabel: string;
  disabled?: boolean;
}

export function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: SegmentedChoiceProps<T>) {
  const { senior } = useSeniorMode();
  return (
    <View
      style={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!disabled && !selected) onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            accessibilityState={{ selected, disabled }}
            style={[styles.option, { minHeight: touchTargetSize(senior) }, selected && styles.selected]}
          >
            <VText variant="body" tone={selected ? 'gold' : 'dim'} center>
              {option.label}
            </VText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: velumColors.ink.raised,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: velumSpacing.xs,
    paddingHorizontal: velumSpacing.sm,
    borderRadius: 9,
  },
  selected: {
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.gold.faint,
  },
});
