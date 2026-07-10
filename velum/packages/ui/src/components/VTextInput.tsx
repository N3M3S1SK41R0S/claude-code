/**
 * Champ de saisie VELUM — label toujours visible (jamais un simple
 * placeholder), erreur annoncée aux lecteurs d'écran, cible ≥ 44/56 pt.
 */
import { StyleSheet, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';

import { touchTargetSize } from '../a11y';
import { useSeniorMode } from '../senior';
import { velumColors, velumOnInk, velumRadius, velumSpacing } from '../tokens';
import { MAX_FONT_SIZE_MULTIPLIER, VText } from './VText';

export interface VTextInputProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Message d'erreur de validation (affiché sous le champ, tone danger). */
  error?: string;
}

export function VTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
}: VTextInputProps) {
  const { senior, scale } = useSeniorMode();

  return (
    <View style={styles.container}>
      <VText variant="caption" tone="dim" accessibilityElementsHidden={true} importantForAccessibility="no">
        {label}
      </VText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={velumColors.parchment.faint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        accessibilityHint={error}
        allowFontScaling={true}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        selectionColor={velumColors.gold.DEFAULT}
        style={[
          styles.input,
          {
            minHeight: touchTargetSize(senior),
            fontSize: scale(16),
            borderColor: error ? velumOnInk.danger : velumColors.ink.border,
          },
        ]}
      />
      {error ? (
        <VText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </VText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: velumSpacing.xs,
  },
  input: {
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderRadius: velumRadius.field,
    paddingHorizontal: velumSpacing.lg,
    paddingVertical: velumSpacing.md,
    color: velumColors.parchment.DEFAULT,
  },
});
