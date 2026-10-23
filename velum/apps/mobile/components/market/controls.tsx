/**
 * Petites briques d'interface des écrans « Échanges & ventes » : sélecteur
 * segmenté (groupe radio), case à cocher, encart d'information, lignes de
 * décomposition et bloc asynchrone (chargement / erreur avec Réessayer /
 * vide). Cibles tactiles ≥ 44 pt (56 en mode senior), rôles accessibles.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  VButton,
  VCard,
  VSpinner,
  VText,
  useSeniorMode,
  velumColors,
  velumRadius,
  velumSpacing,
} from '@velum/ui';

import { errorMessage } from '../../lib/errors';
import { isNotYetAvailable } from '../../lib/marketState';

// ── Sélecteur segmenté ───────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Pastille numérique (ex. éléments à traiter). */
  badge?: number;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  accessibilityLabel: string;
}

export function Segmented<T extends string>({ value, options, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { senior, scale } = useSeniorMode();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const badge = option.badge !== undefined && option.badge > 0 ? option.badge : null;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={badge !== null ? `${option.label} (${badge})` : option.label}
            accessibilityState={{ selected, checked: selected }}
            // aria-checked explicite : requis par le rôle radio sur le web (WCAG 4.1.2).
            aria-checked={selected}
            style={[styles.segment, { minHeight: senior ? 56 : 44 }, selected ? styles.segmentSelected : null]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              numberOfLines={2}
              style={[styles.segmentLabel, { fontSize: scale(14) }, selected ? styles.segmentLabelSelected : null]}
            >
              {option.label}
            </Text>
            {badge !== null ? (
              <View style={styles.pill}>
                <Text allowFontScaling maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[styles.pillText, { fontSize: scale(12) }]}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Choix dans une liste fermée (puces) ──────────────────────────────────────

export interface ChoiceChipsProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  accessibilityLabel: string;
}

/** Groupe radio en puces qui passent à la ligne (listes plus longues qu'un sélecteur segmenté). */
export function ChoiceChips<T extends string>({ value, options, onChange, accessibilityLabel }: ChoiceChipsProps<T>) {
  const { senior, scale } = useSeniorMode();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            aria-checked={selected}
            style={[styles.chip, { minHeight: senior ? 56 : 44 }, selected ? styles.segmentSelected : null]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.segmentLabel, { fontSize: scale(14) }, selected ? styles.segmentLabelSelected : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Case à cocher ────────────────────────────────────────────────────────────

export interface CheckRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Explication sous le libellé. */
  hint?: string;
  disabled?: boolean;
}

export function CheckRow({ label, checked, onChange, hint, disabled = false }: CheckRowProps) {
  const { senior, scale } = useSeniorMode();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      style={[styles.check, { minHeight: senior ? 56 : 44 }, disabled ? styles.disabled : null]}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={scale(24)}
        color={checked ? velumColors.gold.DEFAULT : velumColors.parchment.dim}
      />
      <View style={styles.flex}>
        <VText variant="body">{label}</VText>
        {hint ? (
          <VText variant="caption" tone="dim">
            {hint}
          </VText>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Encart d'information ─────────────────────────────────────────────────────

export type NoticeTone = 'info' | 'warning' | 'success';

const NOTICE_ICON: Record<NoticeTone, keyof typeof Ionicons.glyphMap> = {
  info: 'shield-checkmark-outline',
  warning: 'alert-circle-outline',
  success: 'ribbon-outline',
};

const NOTICE_COLOR: Record<NoticeTone, string> = {
  info: velumColors.gold.soft,
  warning: velumColors.warning,
  success: velumColors.success,
};

export function Notice({ tone = 'info', title, children }: { tone?: NoticeTone; title?: string; children: ReactNode }) {
  const { scale } = useSeniorMode();
  return (
    <View style={[styles.notice, { borderLeftColor: NOTICE_COLOR[tone] }]}>
      <Ionicons name={NOTICE_ICON[tone]} size={scale(20)} color={NOTICE_COLOR[tone]} accessibilityElementsHidden />
      <View style={styles.flex}>
        {title ? <VText variant="body" style={styles.bold}>{title}</VText> : null}
        {typeof children === 'string' ? (
          <VText variant="caption" tone="dim">
            {children}
          </VText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ── Lignes de décomposition ──────────────────────────────────────────────────

export interface AmountRow {
  label: string;
  value: string;
  /** Ligne mise en avant (net, total). */
  emphasis?: boolean;
  /** Précision sous le libellé (taux, barème…). */
  detail?: string;
}

export function AmountRows({ rows }: { rows: readonly AmountRow[] }) {
  return (
    <View style={styles.rows}>
      {rows.map((row) => (
        <View
          key={row.label}
          style={[styles.row, row.emphasis ? styles.rowEmphasis : null]}
          accessible
          accessibilityLabel={`${row.label} : ${row.value}${row.detail ? `, ${row.detail}` : ''}`}
        >
          <View style={styles.flex}>
            <VText variant="body" tone={row.emphasis ? 'gold' : 'default'}>
              {row.label}
            </VText>
            {row.detail ? (
              <VText variant="caption" tone="dim">
                {row.detail}
              </VText>
            ) : null}
          </View>
          <VText variant={row.emphasis ? 'heading' : 'body'} tone={row.emphasis ? 'gold' : 'default'} tabularNums>
            {row.value}
          </VText>
        </View>
      ))}
    </View>
  );
}

// ── Bloc asynchrone ──────────────────────────────────────────────────────────

/** Sous-ensemble d'un résultat React Query. */
export interface AsyncSource<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface AsyncBlockProps<T> {
  source: AsyncSource<T>;
  /** Vide → message `emptyText` (jamais confondu avec une panne). */
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  children: (data: T) => ReactNode;
}

/**
 * Chargement / erreur (avec Réessayer) / vide / contenu. Une fonction serveur
 * pas encore câblée est annoncée comme telle (« bientôt disponible »).
 */
export function AsyncBlock<T>({ source, isEmpty, emptyText, children }: AsyncBlockProps<T>) {
  const { t } = useTranslation();
  if (source.isError) {
    const notYet = isNotYetAvailable(source.error);
    return (
      <VCard style={styles.errorCard}>
        <VText variant="body" tone="dim">
          {notYet ? t('community.notYetAvailable') : errorMessage(source.error, t)}
        </VText>
        <VButton label={t('common.retry')} variant="secondary" onPress={() => void source.refetch()} />
      </VCard>
    );
  }
  if (source.isPending || source.data === undefined) {
    return (
      <View style={styles.loading} accessibilityLabel={t('common.loading')}>
        <VSpinner />
      </View>
    );
  }
  if (isEmpty?.(source.data)) {
    return (
      <VText variant="body" tone="dim">
        {emptyText ?? ''}
      </VText>
    );
  }
  return <>{children(source.data)}</>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  segmented: {
    flexDirection: 'row',
    gap: velumSpacing.xs,
    padding: velumSpacing.xs,
    borderRadius: velumRadius.field,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: velumSpacing.xs,
    paddingHorizontal: velumSpacing.sm,
    borderRadius: velumRadius.field - 4,
  },
  segmentSelected: { backgroundColor: velumColors.ink.raised, borderWidth: 1, borderColor: velumColors.gold.DEFAULT },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: velumSpacing.xs },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: velumSpacing.md,
    borderRadius: velumRadius.field,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  segmentLabel: { color: velumColors.parchment.dim, fontWeight: '600', textAlign: 'center' },
  segmentLabelSelected: { color: velumColors.gold.soft },
  pill: {
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: velumRadius.seal,
    backgroundColor: velumColors.bordeaux.DEFAULT,
    alignItems: 'center',
  },
  pillText: { color: velumColors.parchment.DEFAULT, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: velumSpacing.md, paddingVertical: velumSpacing.xs },
  notice: {
    flexDirection: 'row',
    gap: velumSpacing.sm,
    padding: velumSpacing.md,
    borderRadius: velumRadius.field,
    backgroundColor: velumColors.ink.soft,
    borderLeftWidth: 3,
  },
  rows: { gap: velumSpacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: velumSpacing.md,
    paddingVertical: velumSpacing.xs,
  },
  rowEmphasis: {
    borderTopWidth: 1,
    borderTopColor: velumColors.ink.border,
    paddingTop: velumSpacing.sm,
    marginTop: velumSpacing.xs,
  },
  errorCard: { gap: velumSpacing.sm, alignItems: 'flex-start' },
  loading: { paddingVertical: velumSpacing.lg },
});
