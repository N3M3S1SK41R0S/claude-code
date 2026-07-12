/**
 * Helpers PURS pour la section « Histoire & rareté » et la liste des dernières
 * ventes. Le formatage i18n est délégué à une fonction `t` injectée — testable
 * sans monter React.
 */
import type { HeritageProfile } from '@velum/core';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** Vrai si le profil patrimonial porte au moins une information affichable. */
export function hasHeritage(h: HeritageProfile | null | undefined): boolean {
  return !!h && (!!h.history || !!h.rarity || !!h.editionSize);
}

/** Groupe les milliers avec une espace (« 20 000 ») — déterministe, hors Intl. */
export function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Libellé de rareté : niveau traduit + note éventuelle. */
export function rarityLabel(rarity: NonNullable<HeritageProfile['rarity']>, t: Translate): string {
  const level = t(`rarity.${rarity.level}`);
  return rarity.note ? `${level} · ${rarity.note}` : level;
}

/** Libellé du nombre d'exemplaires : « 20 000 exemplaires · tirage ». */
export function editionLabel(edition: NonNullable<HeritageProfile['editionSize']>, t: Translate): string {
  const unit = t(`edition.unit.${edition.unit}`);
  const head = typeof edition.count === 'number' ? `${groupDigits(edition.count)} ${unit}` : unit;
  return edition.note ? `${head} · ${edition.note}` : head;
}

/** Ancienneté d'une observation en langage courant (« il y a 3 mois »). */
export function relativeAge(ageDays: number, t: Translate): string {
  const d = Math.max(0, Math.round(ageDays));
  if (d <= 1) return t('time.today');
  if (d < 30) return t('time.daysAgo', { count: d });
  if (d < 365) return t('time.monthsAgo', { count: Math.round(d / 30) });
  return t('time.yearsAgo', { count: Math.round(d / 365) });
}
