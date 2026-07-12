/**
 * i18n VELUM : i18next + react-i18next, français par défaut, anglais complet.
 * Toutes les chaînes visibles passent par t() ; devises et dates via Intl.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import fr from '../locales/fr.json';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: {
    // React échappe déjà — pas de double échappement.
    escapeValue: false,
  },
  returnNull: false,
});

export function setLocale(locale: SupportedLocale): void {
  void i18n.changeLanguage(locale);
}

/** Formate un montant en EUR selon la locale active. */
export function formatEUR(value: number, locale: string = i18n.language): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formate un prix DANS SA DEVISE D'ORIGINE (observations de sources : PCGS,
 * Heritage… renvoient souvent des USD) — ne jamais étiqueter € un montant $.
 */
export function formatMoney(
  value: number,
  currency: string,
  locale: string = i18n.language,
): string {
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Code devise inconnu → repli lisible sans étiquette trompeuse.
    return `${Math.round(value)} ${currency}`;
  }
}

/** Formate une date ISO selon la locale active. */
export function formatDate(iso: string, locale: string = i18n.language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default i18n;
