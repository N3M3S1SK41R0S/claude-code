/**
 * Lecture CANONIQUE des attributs d'un objet — source unique pour extraire une
 * valeur qui peut vivre soit en attribut direct (`attributes[key]`), soit dans
 * la fiche d'analyse (`attributes.analysis.identification[key]`). Fonctions
 * pures, sans dépendance React Native : réutilisées par les statistiques de
 * cave, la détection de trous de série et les exports (fin de la duplication).
 */
import type { VelumItem } from '@velum/core';

/** Bloc `attributes.analysis` s'il s'agit bien d'un objet, sinon null. */
export function itemAnalysis(item: VelumItem): Record<string, unknown> | null {
  const raw = item.attributes['analysis'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/** Bloc `analysis.identification`, sinon null. */
export function itemIdentification(item: VelumItem): Record<string, unknown> | null {
  const raw = itemAnalysis(item)?.['identification'];
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/** Chaîne non vide depuis `attributes[key]` puis `identification[key]`, sinon null. */
export function itemString(item: VelumItem, key: string): string | null {
  const direct = item.attributes[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const nested = itemIdentification(item)?.[key];
  return typeof nested === 'string' && nested.trim().length > 0 ? nested.trim() : null;
}

/** Nombre fini depuis `attributes[key]` puis `identification[key]`, sinon null. */
export function itemNumber(item: VelumItem, key: string): number | null {
  const direct = item.attributes[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const nested = itemIdentification(item)?.[key];
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : null;
}

/** Fenêtre d'apogée `{from,to}` lue dans `analysis.tasting.drinkWindow`, sinon null. */
export function itemDrinkWindow(item: VelumItem): { from: number; to: number } | null {
  const tasting = itemAnalysis(item)?.['tasting'];
  const window =
    tasting && typeof tasting === 'object'
      ? (tasting as Record<string, unknown>)['drinkWindow']
      : null;
  if (!window || typeof window !== 'object') return null;
  const from = (window as Record<string, unknown>)['from'];
  const to = (window as Record<string, unknown>)['to'];
  return typeof from === 'number' &&
    typeof to === 'number' &&
    Number.isFinite(from) &&
    Number.isFinite(to)
    ? { from, to }
    : null;
}
