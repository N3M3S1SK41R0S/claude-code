/**
 * « Pourquoi cette fourchette ? » — Pari #1 (confiance auditable).
 *
 * Panneau dépliable qui rend VISIBLE la rigueur du moteur §7 sur une
 * valorisation déjà calculée : sources retenues, mélange de sources,
 * dispersion, décomposition du score de fiabilité. Calcul PUR côté client
 * via `explainFromResult` (aucun taux de change requis).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VText, velumColors, velumRadius, velumSpacing } from '@velum/ui';
import type { ValuationRecord } from '@velum/core';
import { explainFromResult } from '@velum/valuation';

export interface ValuationExplanationProps {
  valuation: ValuationRecord;
  /** Libellé du bouton (i18n). */
  label: string;
}

export function ValuationExplanation({ valuation, label }: ValuationExplanationProps) {
  const [open, setOpen] = useState(false);

  const explanation = explainFromResult({
    central: valuation.central,
    ci80: [valuation.ci80Low, valuation.ci80High],
    ci95: [valuation.ci95Low, valuation.ci95High],
    reliability: valuation.reliability,
    observations: valuation.sources,
    nSources: 0,
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        hitSlop={8}
        style={styles.toggle}
      >
        <VText variant="caption" tone="gold">
{open ? '▾' : '▸'}  {label}
        </VText>
      </Pressable>
      {open ? (
        <View style={styles.body}>
{explanation.notes.map((note, i) => (
  <VText key={i} variant="caption" tone="dim" style={styles.note}>
    •  {note}
  </VText>
))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.xs },
  toggle: { paddingVertical: velumSpacing.xs },
  body: {
    gap: velumSpacing.xs,
    padding: velumSpacing.md,
    borderRadius: velumRadius.field,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  note: { lineHeight: 18 },
});
