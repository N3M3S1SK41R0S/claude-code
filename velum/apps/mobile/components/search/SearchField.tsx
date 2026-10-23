/**
 * Zone de recherche VELUM : loupe, saisie, bouton « effacer » (≥ 44 pt),
 * libellé accessible toujours présent. Réutilisée par la collection, le
 * carnet, la liste d'envies et le catalogue de la communauté.
 */
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  useSeniorMode,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Libellé accessible (défaut : « Rechercher »). */
  label?: string;
  placeholder?: string;
  /** Validation clavier (recherche serveur différée, par ex.). */
  onSubmit?: () => void;
}

export function SearchField({ value, onChangeText, label, placeholder, onSubmit }: SearchFieldProps) {
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const minHeight = senior ? 56 : 44;
  const accessibleLabel = label ?? t('common.search');
  return (
    <View style={[styles.box, { minHeight }]}>
      <Ionicons name="search" size={scale(18)} color={velumColors.parchment.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? accessibleLabel}
        placeholderTextColor={velumColors.parchment.faint}
        accessibilityLabel={accessibleLabel}
        accessibilityRole="search"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        selectionColor={velumColors.gold.DEFAULT}
        style={[styles.input, { minHeight, fontSize: scale(16) }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('search.clear')}
          hitSlop={10}
          style={[styles.clear, { minHeight, minWidth: minHeight }]}
        >
          <Ionicons name="close-circle" size={scale(20)} color={velumColors.parchment.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.sm,
    paddingLeft: velumSpacing.md,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
    borderRadius: velumRadius.field,
  },
  input: { flex: 1, color: velumColors.parchment.DEFAULT },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
