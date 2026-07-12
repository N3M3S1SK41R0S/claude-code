/**
 * Section de fiche : titre doré + carte de contenu. Partagé par les 4 sheets.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { VCard, VText, velumSpacing } from '@velum/ui';

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <VText variant="heading" tone="gold">
        {title}
      </VText>
      <VCard>
        <View style={styles.body}>{children}</View>
      </VCard>
    </View>
  );
}

/** Rangée libellé / valeur. */
export function KV({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string;
  /** Chiffres à chasse fixe : à activer pour les valeurs numériques (prix, IC…). */
  tabular?: boolean;
}) {
  return (
    <View style={styles.kv}>
      <VText variant="caption" tone="dim">
        {label}
      </VText>
      <VText variant="body" tabularNums={tabular}>
        {value}
      </VText>
    </View>
  );
}

/** Liste à puces simple. */
export function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((item, i) => (
        <VText key={`${i}-${item}`} variant="body">
          {`• ${item}`}
        </VText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: velumSpacing.sm, marginTop: velumSpacing.lg },
  body: { gap: velumSpacing.sm },
  kv: { gap: 2 },
  bullets: { gap: velumSpacing.xs },
});
