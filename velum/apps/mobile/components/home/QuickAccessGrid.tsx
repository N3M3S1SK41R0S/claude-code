/**
 * Grille d'accès rapide (2 colonnes) : icône + libellé, légende facultative.
 * Chaque tuile est UN bouton (aucun interactif imbriqué), cible ≥ 52 pt
 * (64 pt en mode senior), libellé visible = nom accessible, aide lue après.
 * Partagée par l'onglet Collection et l'accueil.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  VText,
  touchTargetSize,
  useSeniorMode,
  velumColors,
  velumElevation,
  velumHairline,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import type { QuickAccessIcon } from '../../lib/collectionViewQuickAccess';

export interface QuickAccessTile {
  key: string;
  label: string;
  /** Aide d'accessibilité (conséquence du geste), si la légende ne suffit pas. */
  hint?: string;
  icon: QuickAccessIcon;
  onPress: () => void;
  /** Légende visible sous le libellé (accueil). */
  caption?: string;
  /** Liseré doré : action principale. */
  gilded?: boolean;
}

export interface QuickAccessGridProps {
  tiles: readonly QuickAccessTile[];
}

export function QuickAccessGrid({ tiles }: QuickAccessGridProps) {
  const { senior, scale } = useSeniorMode();
  const minHeight = touchTargetSize(senior) + velumSpacing.sm;
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          onPress={tile.onPress}
          accessibilityRole="button"
          accessibilityLabel={tile.caption ? `${tile.label}, ${tile.caption}` : tile.label}
          accessibilityHint={tile.hint}
          style={({ pressed }) => [
            styles.tile,
            tile.gilded ? styles.gilded : null,
            { minHeight },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.head}>
            <Ionicons
              name={tile.icon}
              size={scale(22)}
              color={tile.gilded ? velumColors.gold.DEFAULT : velumColors.gold.soft}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <VText
              variant="body"
              tone={tile.gilded ? 'gold' : 'default'}
              style={styles.label}
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            >
              {tile.label}
            </VText>
          </View>
          {tile.caption ? (
            <VText variant="caption" tone="dim" numberOfLines={2}>
              {tile.caption}
            </VText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: velumSpacing.sm,
  },
  tile: {
    // Deux colonnes : base 46 % + croissance, plafonnée à la moitié (une
    // tuile seule en dernière ligne garde la largeur d'une colonne).
    flexBasis: '46%',
    flexGrow: 1,
    maxWidth: '50%',
    justifyContent: 'center',
    gap: velumSpacing.xs,
    paddingHorizontal: velumSpacing.md,
    paddingVertical: velumSpacing.sm,
    backgroundColor: velumColors.ink.raised,
    borderWidth: 1,
    borderColor: velumHairline.warm,
    borderRadius: velumRadius.card,
    ...velumElevation.card,
  },
  gilded: { borderColor: velumHairline.gilded },
  head: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  label: { flex: 1, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
