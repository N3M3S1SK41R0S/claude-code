/**
 * Rangée de liste VELUM (inventaire, sources de prix…) — titre + sous-titre
 * + zone droite libre, cible tactile ≥ 44/56 pt si pressable.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { touchTargetSize } from '../a11y';
import { useSeniorMode } from '../senior';
import { velumColors, velumSpacing } from '../tokens';
import { VText } from './VText';

export interface VListRowProps {
  title: string;
  subtitle?: string;
  /** Contenu libre côté droit (badge, chevron, prix…). */
  right?: ReactNode;
  onPress?: () => void;
}

export function VListRow({ title, subtitle, right, onPress }: VListRowProps) {
  const { senior } = useSeniorMode();

  const content = (
    <>
      <View style={styles.textColumn}>
        <VText variant="body">{title}</VText>
        {subtitle ? (
          <VText variant="caption" tone="dim">
            {subtitle}
          </VText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        style={({ pressed }) => [styles.row, { minHeight: touchTargetSize(senior) }, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, { minHeight: touchTargetSize(senior) }]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.md,
    paddingVertical: velumSpacing.sm,
    paddingHorizontal: velumSpacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: velumColors.ink.border,
  },
  textColumn: {
    flex: 1,
    gap: velumSpacing.xs / 2,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.85,
  },
});
