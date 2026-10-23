/**
 * « Mes vins à leur apogée » — logique d'affichage PURE (testée sous Vitest,
 * sans React Native) : lecture de la position de cave, libellés localisés,
 * filtres couleur / statut / recherche, et saisie de position.
 */
import type { CellarPeakEntry, DrinkWindowPhase, LocalPairingSuggestion, PeakStatus } from '@velum/core';
import { countByPeakStatus } from '@velum/domain-wine';

import { formatCellarSlot, parseCellarSlot, type CellarSlot } from './carnet';
import { searchEntries } from './search';

/** Fonction de traduction minimale (compatible TFunction i18next). */
export type Translate = (key: string, opts?: Record<string, unknown>) => string;

/* ------------------------------------------------------------------ */
/* Position de la bouteille                                            */
/* ------------------------------------------------------------------ */

/** Position lisible : structurée (rangée / colonne / place), texte libre ou absente. */
export type CellarPositionView =
  | { kind: 'slot'; slot: CellarSlot }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

/** Lit l'emplacement saisi (format canonique du carnet, sinon texte libre). */
export function describePosition(location: string | null | undefined): CellarPositionView {
  const trimmed = typeof location === 'string' ? location.trim() : '';
  if (trimmed.length === 0) return { kind: 'none' };
  const slot = parseCellarSlot(trimmed);
  if (slot && (slot.row !== undefined || slot.column !== undefined || slot.place !== undefined)) {
    return { kind: 'slot', slot };
  }
  return { kind: 'text', text: trimmed };
}

/**
 * Position localisée : « Rangée 2 · Colonne 4 · Place 1 » (ou abrégée
 * « Rangée 2 · Col. 4 · Pl. 1 » pour une notification), texte libre tel quel,
 * null si la position n'est pas renseignée.
 */
export function formatPosition(
  view: CellarPositionView,
  t: Translate,
  options: { short?: boolean } = {},
): string | null {
  if (view.kind === 'none') return null;
  if (view.kind === 'text') return view.text;
  const ns = options.short ? 'cellarPeak.slotShort' : 'cellarPeak.slot';
  const parts: string[] = [];
  if (view.slot.row !== undefined) parts.push(t(`${ns}.row`, { n: view.slot.row }));
  if (view.slot.column !== undefined) parts.push(t(`${ns}.column`, { n: view.slot.column }));
  if (view.slot.place !== undefined) parts.push(t(`${ns}.place`, { n: view.slot.place }));
  return parts.join(' · ');
}

/** Raccourci : emplacement brut → libellé localisé (ou null). */
export function positionLabel(
  location: string | null | undefined,
  t: Translate,
  options?: { short?: boolean },
): string | null {
  return formatPosition(describePosition(location), t, options);
}

/* ------------------------------------------------------------------ */
/* Saisie de la position (éditeur rangée / colonne / place)            */
/* ------------------------------------------------------------------ */

export interface PositionForm {
  mode: 'slot' | 'text';
  row: string;
  column: string;
  place: string;
  text: string;
}

/** Pré-remplissage : format structuré → mode « Position », sinon texte libre. */
export function positionFormFrom(location: string | null | undefined): PositionForm {
  const raw = typeof location === 'string' ? location.trim() : '';
  const slot = raw.length > 0 ? parseCellarSlot(raw) : null;
  return {
    mode: slot !== null || raw.length === 0 ? 'slot' : 'text',
    row: slot?.row !== undefined ? String(slot.row) : '',
    column: slot?.column !== undefined ? String(slot.column) : '',
    place: slot?.place !== undefined ? String(slot.place) : '',
    text: slot === null ? raw : '',
  };
}

/** Entier strictement positif saisi, sinon undefined (champ ignoré). */
function positiveInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return undefined;
  const n = Number.parseInt(trimmed, 10);
  return n > 0 ? n : undefined;
}

/** true si un champ rangée/colonne/place est rempli mais invalide. */
export function positionFormError(form: PositionForm): boolean {
  if (form.mode !== 'slot') return false;
  return [form.row, form.column, form.place].some((raw) => raw.trim().length > 0 && positiveInt(raw) === undefined);
}

/** Emplacement à enregistrer (format canonique du carnet), null = effacer. */
export function positionFormToLocation(form: PositionForm): string | null {
  if (form.mode === 'text') {
    const trimmed = form.text.replace(/\s+/g, ' ').trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
  }
  return formatCellarSlot({
    row: positiveInt(form.row),
    column: positiveInt(form.column),
    place: positiveInt(form.place),
  });
}

/* ------------------------------------------------------------------ */
/* Statuts, couleurs et filtres                                        */
/* ------------------------------------------------------------------ */

export type BadgeTone = 'gold' | 'success' | 'warning' | 'danger' | 'neutral';

/** Teinte du badge d'urgence. */
export function peakStatusTone(status: DrinkWindowPhase): BadgeTone {
  switch (status) {
    case 'past':
      return 'danger';
    case 'closing':
      return 'warning';
    case 'peak':
      return 'success';
    default:
      return 'neutral';
  }
}

/** Groupe de couleur pour les filtres. */
export type ColorGroup = 'red' | 'white' | 'rose' | 'sparkling' | 'sweet' | 'other';

export const COLOR_GROUP_ORDER: readonly ColorGroup[] = ['red', 'white', 'rose', 'sparkling', 'sweet', 'other'];

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Couleur saisie (FR ou EN) → groupe ; inconnue → 'other'. */
export function colorGroupOf(color: string | null | undefined): ColorGroup {
  const c = typeof color === 'string' ? fold(color) : '';
  if (c.length === 0) return 'other';
  if (/^(rouge|red)/.test(c)) return 'red';
  if (/^(blanc|white)/.test(c)) return 'white';
  if (/^(rose)/.test(c)) return 'rose';
  if (/^(effervescent|sparkling|petillant|mousseux|champagne)/.test(c)) return 'sparkling';
  if (/^(liquoreux|moelleux|doux|sweet|vdn)/.test(c)) return 'sweet';
  return 'other';
}

/** Groupes de couleur présents (puces de filtre utiles uniquement). */
export function availableColorGroups(entries: readonly CellarPeakEntry[]): ColorGroup[] {
  const present = new Set(entries.map((entry) => colorGroupOf(entry.color)));
  return COLOR_GROUP_ORDER.filter((group) => present.has(group));
}

export interface PeakFilters {
  query: string;
  color: ColorGroup | null;
  /** Afficher aussi les vins qui entrent dans leur fenêtre l'an prochain. */
  includeSoon: boolean;
}

/** Applique statut « l'an prochain », couleur puis recherche texte (classée). */
export function filterPeakEntries(entries: readonly CellarPeakEntry[], filters: PeakFilters): CellarPeakEntry[] {
  const scoped = entries.filter(
    (entry) =>
      (filters.includeSoon || entry.status !== 'soon') &&
      (filters.color === null || colorGroupOf(entry.color) === filters.color),
  );
  return searchEntries(scoped, filters.query, (entry) => ({
    title: entry.label,
    fields: [entry.vintage, entry.storageLocation, entry.suggestedDishes, entry.color],
  }));
}

/** Nombre de vins par statut, pour le résumé en tête d'écran. */
export function peakSummary(entries: readonly CellarPeakEntry[]): Record<PeakStatus, number> {
  return countByPeakStatus(entries);
}

/** Millésime à afficher seulement s'il n'apparaît pas déjà dans le libellé. */
export function vintageToShow(entry: Pick<CellarPeakEntry, 'label' | 'vintage'>): number | null {
  if (entry.vintage === undefined || !Number.isFinite(entry.vintage)) return null;
  return entry.label.includes(String(entry.vintage)) ? null : entry.vintage;
}

/* ------------------------------------------------------------------ */
/* Raison localisée d'une suggestion locale (FR/EN)                    */
/* ------------------------------------------------------------------ */

/** Raison courte localisée à partir des éléments structurés de la suggestion. */
export function localSuggestionReason(suggestion: LocalPairingSuggestion, t: Translate): string {
  const parts: string[] = [];
  if (suggestion.family && suggestion.dishCategory) {
    parts.push(
      t('cellar.quick.reasonFamilyDish', {
        family: t(`cellar.family.${suggestion.family}`),
        dish: t(`cellar.dishCategory.${suggestion.dishCategory}`),
      }),
    );
  } else if (suggestion.family) {
    parts.push(t(`cellar.family.${suggestion.family}`));
  } else {
    parts.push(t('cellar.quick.reasonUnknownStyle'));
  }
  if (suggestion.matchedPairing) {
    parts.push(t('cellar.quick.reasonZappa', { pairing: suggestion.matchedPairing }));
  }
  if (suggestion.peakStatus !== 'unknown') {
    parts.push(t(`cellar.peakReason.${suggestion.peakStatus}`));
  }
  return parts.join(' · ');
}

/**
 * Libellé accessible d'une suggestion rapide (carte pressable) : le lecteur
 * d'écran ne lit QUE ce libellé, il doit donc porter tout ce que la carte
 * montre — vin, emplacement, pertinence, raison et quantité (forme complète).
 * `score` : pertinence déjà formatée (formatConfidence).
 */
export function quickSuggestionA11yLabel(
  suggestion: LocalPairingSuggestion,
  t: Translate,
  options: { label: string; score: string; compact?: boolean },
): string {
  const position = positionLabel(suggestion.storageLocation, t);
  const parts = [
    options.label,
    position ? t('cellar.location', { location: position }) : null,
    t('cellar.quick.scoreA11y', { score: options.score }),
    options.compact ? null : localSuggestionReason(suggestion, t),
    !options.compact && suggestion.quantity !== undefined ? t('cellar.quantity', { count: suggestion.quantity }) : null,
  ];
  return parts.filter((part): part is string => part !== null && part.length > 0).join('. ');
}

/** Titre d'une idée d'envie à partir des styles à acheter (borné). */
export function wishlistIdeaTitle(purchaseIdeas: readonly string[], fallback: string): string {
  const title = purchaseIdeas.slice(0, 3).join(' · ');
  const chosen = title.length > 0 ? title : fallback;
  return chosen.length > 120 ? `${chosen.slice(0, 119).trimEnd()}…` : chosen;
}
