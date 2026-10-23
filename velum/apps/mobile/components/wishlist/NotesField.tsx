/**
 * Champ de notes multiligne (« pourquoi je l'ai aimé ») — même apparence que
 * VTextInput : libellé toujours visible, erreur annoncée, cible ≥ 44/56 pt.
 */
import { StyleSheet, TextInput, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  VText,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumOnInk,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

export interface NotesFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
}

export function NotesField({ label, value, onChangeText, placeholder, error, maxLength }: NotesFieldProps) {
  const { senior, scale } = useSeniorMode();
  return (
    <View style={styles.container}>
      <VText variant="caption" tone="dim" accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </VText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={velumColors.parchment.faint}
        multiline
        maxLength={maxLength}
        textAlignVertical="top"
        accessibilityLabel={label}
        accessibilityHint={error}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        selectionColor={velumColors.gold.DEFAULT}
        style={[
          styles.input,
          {
            minHeight: touchTargetSize(senior) * 2,
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
  container: { gap: velumSpacing.xs },
  input: {
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderRadius: velumRadius.field,
    paddingHorizontal: velumSpacing.lg,
    paddingVertical: velumSpacing.md,
    color: velumColors.parchment.DEFAULT,
  },
});
