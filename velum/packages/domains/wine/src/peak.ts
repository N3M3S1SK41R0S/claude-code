/**
 * « Mes vins à leur apogée » — calcul PUR et déterministe (aucun réseau, année
 * injectée) partagé par l'app (écran à la demande, rappels locaux) et les Edge
 * Functions (alerte `drink_window` du cron, sommelier IA).
 *
 * Statuts d'urgence pour l'année Y et une fenêtre [from, to] :
 *  - 'past'    : Y > to — fenêtre dépassée, à boire au plus vite ;
 *  - 'closing' : Y = to — dernière année de la fenêtre ;
 *  - 'peak'    : from ≤ Y < to — dans la fenêtre ;
 *  - 'soon'    : Y + 1 = from — entre dans la fenêtre l'an prochain ;
 *  - 'young'   : from ≥ Y + 2 — encore en garde ;
 *  - 'unknown' : fenêtre absente ou incohérente — on ne devine jamais.
 */
import type {
  CellarPeakEntry,
  CellarPeakReport,
  CellarWineEntry,
  DrinkWindowPhase,
  PeakStatus,
} from '@velum/core';

/** Ordre d'urgence (plus petit = plus urgent). */
const URGENCY: Record<PeakStatus, number> = { past: 0, closing: 1, peak: 2, soon: 3 };

/** Statuts « à boire maintenant » (hors 'soon', qui n'est pas encore prêt). */
export const DRINKABLE_STATUSES: readonly PeakStatus[] = ['past', 'closing', 'peak'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Fenêtre valide (bornes finies et ordonnées), sinon null. */
export function validDrinkWindow(
  window: { from?: unknown; to?: unknown } | null | undefined,
): { from: number; to: number } | null {
  if (!window || typeof window !== 'object') return null;
  const { from, to } = window;
  if (!isFiniteNumber(from) || !isFiniteNumber(to) || from > to) return null;
  return { from, to };
}

/** Situation d'un vin vis-à-vis de sa fenêtre pour l'année `year`. */
export function peakStatus(
  window: { from?: unknown; to?: unknown } | null | undefined,
  year: number,
): DrinkWindowPhase {
  const valid = validDrinkWindow(window);
  if (!valid || !Number.isFinite(year)) return 'unknown';
  if (year > valid.to) return 'past';
  if (year >= valid.from) return year === valid.to ? 'closing' : 'peak';
  return valid.from === year + 1 ? 'soon' : 'young';
}

/** true si la situation fait partie des statuts listés « à l'apogée ». */
export function isPeakStatus(phase: DrinkWindowPhase): phase is PeakStatus {
  return phase === 'past' || phase === 'closing' || phase === 'peak' || phase === 'soon';
}

/** Compare deux lignes : urgence, fin de fenêtre, puis libellé (stable). */
export function comparePeakEntries(a: CellarPeakEntry, b: CellarPeakEntry): number {
  return (
    URGENCY[a.status] - URGENCY[b.status] ||
    a.windowTo - b.windowTo ||
    a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }) ||
    a.itemId.localeCompare(b.itemId)
  );
}

export interface CellarAtPeakOptions {
  /** Inclure les vins qui entrent dans leur fenêtre l'an prochain (défaut : true). */
  includeSoon?: boolean;
  /** Nombre maximal de plats suggérés par vin (défaut : 3). */
  maxDishes?: number;
}

/** Plats suggérés : chaînes non vides, dédupliquées, bornées. */
function suggestedDishesOf(pairings: readonly unknown[] | undefined, max: number): string[] {
  if (!Array.isArray(pairings)) return [];
  const out: string[] = [];
  for (const raw of pairings) {
    if (typeof raw !== 'string') continue;
    const dish = raw.trim();
    if (dish.length === 0 || out.includes(dish)) continue;
    out.push(dish);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Tous les vins de la cave à boire (ou bientôt), triés par urgence puis fin
 * de fenêtre, avec position et plats suggérés. Les vins sans fenêtre fiable
 * sont comptés à part (jamais présentés « à l'apogée » par défaut).
 */
export function cellarAtPeak(
  cellar: readonly CellarWineEntry[],
  year: number,
  options: CellarAtPeakOptions = {},
): CellarPeakReport {
  const includeSoon = options.includeSoon ?? true;
  const maxDishes = Math.max(0, options.maxDishes ?? 3);
  const entries: CellarPeakEntry[] = [];
  const unknownWindowItemIds: string[] = [];
  let youngCount = 0;

  for (const wine of cellar) {
    const window = validDrinkWindow(wine.drinkWindow);
    const status = peakStatus(window, year);
    if (status === 'unknown' || window === null) {
      unknownWindowItemIds.push(wine.itemId);
      continue;
    }
    if (status === 'young') {
      youngCount += 1;
      continue;
    }
    if (status === 'soon' && !includeSoon) continue;
    const location = wine.storageLocation?.trim();
    entries.push({
      itemId: wine.itemId,
      label: wine.label,
      ...(wine.vintage !== undefined ? { vintage: wine.vintage } : {}),
      ...(wine.color ? { color: wine.color } : {}),
      ...(location ? { storageLocation: location } : {}),
      ...(isFiniteNumber(wine.quantity) && wine.quantity > 0 ? { quantity: wine.quantity } : {}),
      windowFrom: window.from,
      windowTo: window.to,
      status,
      suggestedDishes: suggestedDishesOf(wine.foodPairings, maxDishes),
    });
  }

  return { year, entries: entries.sort(comparePeakEntries), youngCount, unknownWindowItemIds };
}

/** Le vin le plus urgent à boire maintenant (hors 'soon'), ou null. */
export function mostUrgentPeakWine(entries: readonly CellarPeakEntry[]): CellarPeakEntry | null {
  let best: CellarPeakEntry | null = null;
  for (const entry of entries) {
    if (entry.status === 'soon') continue;
    if (best === null || comparePeakEntries(entry, best) < 0) best = entry;
  }
  return best;
}

/** Décompte par statut (affichage du résumé). */
export function countByPeakStatus(entries: readonly CellarPeakEntry[]): Record<PeakStatus, number> {
  const counts: Record<PeakStatus, number> = { past: 0, closing: 0, peak: 0, soon: 0 };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

/* ------------------------------------------------------------------ */
/* Emplacement de cave — format canonique produit par le carnet :       */
/* « Rangée 3 · Colonne 4 · Place 2 » (segments dans n'importe quel     */
/* ordre). Version serveur/notification, en français.                  */
/* ------------------------------------------------------------------ */

/** Position structurée (rangée / colonne / place), tout optionnel. */
export interface CellarSlotParts {
  row?: number;
  column?: number;
  place?: number;
}

const SLOT_SEGMENT_KEYS: Record<string, keyof CellarSlotParts> = {
  rangée: 'row',
  rangee: 'row',
  colonne: 'column',
  place: 'place',
};

/** Parse le format canonique ; null si absent ou non conforme. */
export function parseCellarSlotText(location: string | null | undefined): CellarSlotParts | null {
  if (typeof location !== 'string') return null;
  const trimmed = location.trim();
  if (trimmed.length === 0) return null;
  const slot: CellarSlotParts = {};
  for (const segment of trimmed.split('·')) {
    const match = /^\s*([A-Za-zÀ-ÿ]+)\s+(\d+)\s*$/.exec(segment);
    if (!match || match[1] === undefined || match[2] === undefined) return null;
    const key = SLOT_SEGMENT_KEYS[match[1].toLowerCase()];
    if (key === undefined || slot[key] !== undefined) return null;
    slot[key] = Number.parseInt(match[2], 10);
  }
  return slot;
}

const MAX_FREE_LOCATION = 40;

/**
 * Emplacement compact pour une notification : « Rangée 2 · Col. 4 · Pl. 1 »
 * pour le format canonique, sinon texte libre tronqué ; undefined si vide.
 */
export function formatCellarLocationShort(location: string | null | undefined): string | undefined {
  if (typeof location !== 'string') return undefined;
  const trimmed = location.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return undefined;
  const slot = parseCellarSlotText(trimmed);
  if (slot) {
    const parts: string[] = [];
    if (slot.row !== undefined) parts.push(`Rangée ${slot.row}`);
    if (slot.column !== undefined) parts.push(`Col. ${slot.column}`);
    if (slot.place !== undefined) parts.push(`Pl. ${slot.place}`);
    return parts.join(' · ');
  }
  return trimmed.length > MAX_FREE_LOCATION
    ? `${trimmed.slice(0, MAX_FREE_LOCATION - 1).trimEnd()}…`
    : trimmed;
}
