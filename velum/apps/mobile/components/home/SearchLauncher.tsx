/**
 * Accès à « Rechercher partout » :
 *  - `SearchLauncher` : barre d'apparence champ (loupe + invite), qui ouvre
 *    l'écran de recherche (accueil) ;
 *  - `SearchIconButton` : loupe seule, cible ≥ 44 pt (56 en mode senior),
 *    pour les en-têtes d'écran (onglet Collection).
 * Ce sont des BOUTONS (pas des champs) : la saisie se fait sur /search.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

export interface SearchLauncherProps {
  /**
   * Texte visible, qui est AUSSI le nom accessible (WCAG 2.5.3, « label in
   * name ») — ex. « Rechercher partout : objet, envie, annonce… ».
   */
  placeholder: string;
  hint: string;
  onPress: () => void;
}

export function SearchLauncher({ placeholder, hint, onPress }: SearchLauncherProps) {
  const { senior, scale } = useSeniorMode();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.bar,
        { minHeight: touchTargetSize(senior) + velumSpacing.xs },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="search"
        size={scale(20)}
        color={velumColors.gold.soft}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text
        style={[styles.placeholder, { fontSize: scale(16) }]}
        numberOfLines={1}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      >
        {placeholder}
      </Text>
    </Pressable>
  );
}

export interface SearchIconButtonProps {
  label: string;
  hint: string;
  onPress: () => void;
}

export function SearchIconButton({ label, hint, onPress }: SearchIconButtonProps) {
  const { senior, scale } = useSeniorMode();
  const size = touchTargetSize(senior);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={velumSpacing.xs}
      style={({ pressed }) => [
        styles.icon,
        { minHeight: size, minWidth: size },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="search"
        size={scale(24)}
        color={velumColors.gold.soft}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.sm,
    paddingHorizontal: velumSpacing.lg,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumHairline.gilded,
    borderRadius: velumRadius.field,
  },
  placeholder: { flex: 1, color: velumColors.parchment.dim },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: velumRadius.seal,
    borderWidth: 1,
    borderColor: velumHairline.warm,
    backgroundColor: velumColors.ink.soft,
  },
  pressed: { opacity: 0.75 },
});
