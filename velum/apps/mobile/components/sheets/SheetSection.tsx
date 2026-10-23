/**
 * Section de fiche : titre doré + carte de contenu. Partagé par les sheets de
 * domaine, la fiche objet et l'arbitre.
 *
 * Repliable à la demande (`collapsible`, `defaultOpen`) : l'en-tête devient un
 * bouton accessible (rôle button, état `expanded` annoncé, cible ≥ 44 pt,
 * 56 en mode senior). `SheetSectionDefaults` fixe le comportement par défaut
 * d'un groupe de sections (ex. fiche complète repliée) ; les props explicites
 * d'une section l'emportent toujours.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VCard, VText, touchTargetSize, useSeniorMode, velumColors, velumSpacing } from '@velum/ui';

import { resolveSectionBehavior, type SectionBehavior } from '../../lib/itemSheet';

const SheetSectionDefaultsContext = createContext<SectionBehavior>({});

/** Comportement par défaut (repliable, ouvert ou non) des sections enfants. */
export function SheetSectionDefaults({
  collapsible,
  defaultOpen,
  children,
}: SectionBehavior & { children: ReactNode }) {
  return (
    <SheetSectionDefaultsContext.Provider value={{ collapsible, defaultOpen }}>
      {children}
    </SheetSectionDefaultsContext.Provider>
  );
}

export interface SheetSectionProps {
  title: string;
  children: ReactNode;
  /** Section repliable (défaut : celui du groupe, sinon non repliable). */
  collapsible?: boolean;
  /** Ouverte à l'affichage (défaut : celui du groupe, sinon ouverte). */
  defaultOpen?: boolean;
  /** Élément non interactif à droite du titre (badge, compteur…). */
  headerRight?: ReactNode;
}

export function SheetSection({ title, children, collapsible, defaultOpen, headerRight }: SheetSectionProps) {
  const defaults = useContext(SheetSectionDefaultsContext);
  const behavior = resolveSectionBehavior({ collapsible, defaultOpen }, defaults);
  const [open, setOpen] = useState(behavior.initiallyOpen);
  const { t } = useTranslation();
  const { senior, scale } = useSeniorMode();
  const expanded = !behavior.collapsible || open;

  return (
    <View style={styles.section}>
      {behavior.collapsible ? (
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={title}
          // accessibilityState pour le natif, aria-* pour le web (react-native-web).
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          accessibilityHint={open ? t('item.section.collapseHint') : t('item.section.expandHint')}
          hitSlop={velumSpacing.xs}
          style={({ pressed }) => [
            styles.header,
            { minHeight: touchTargetSize(senior) },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.headerTitle}>
            <VText variant="heading" tone="gold">
              {title}
            </VText>
          </View>
          {headerRight}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={scale(22)}
            color={velumColors.gold.soft}
          />
        </Pressable>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <VText variant="heading" tone="gold" accessibilityRole="header">
              {title}
            </VText>
          </View>
          {headerRight}
        </View>
      )}
      {expanded ? (
        <VCard>
          <View style={styles.body}>{children}</View>
        </VCard>
      ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.sm },
  headerTitle: { flex: 1 },
  pressed: { opacity: 0.7 },
  body: { gap: velumSpacing.sm },
  kv: { gap: 2 },
  bullets: { gap: velumSpacing.xs },
});
