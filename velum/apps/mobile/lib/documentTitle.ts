/**
 * Titre de document par route (WCAG 2.4.2). Sur l'export web statique,
 * expo-router ne propage pas `options.title` au runtime ; on pose donc
 * `document.title` nous-mêmes depuis le pathname et la langue active.
 */
export type DocumentTitleLocale = 'fr' | 'en';

const BASE: Record<DocumentTitleLocale, string> = {
  fr: 'VELUM — analyse & valorisation',
  en: 'VELUM — analysis & valuation',
};

const BY_PREFIX: {
  prefix: string;
  title: Record<DocumentTitleLocale, string>;
}[] = [
  { prefix: '/accueil', title: { fr: 'Accueil', en: 'Home' } },
  { prefix: '/onboarding', title: { fr: 'Bienvenue', en: 'Welcome' } },
  { prefix: '/sign-in', title: { fr: 'Connexion', en: 'Sign in' } },
  { prefix: '/sign-up', title: { fr: 'Créer un compte', en: 'Create account' } },
  { prefix: '/collection', title: { fr: 'Ma collection', en: 'My collection' } },
  { prefix: '/carnet', title: { fr: 'Mon carnet', en: 'My collection book' } },
  { prefix: '/cellar-sommelier', title: { fr: 'Sommelier de cave', en: 'Cellar sommelier' } },
  { prefix: '/blind-tasting', title: { fr: 'Dégustation à l’aveugle', en: 'Blind tasting' } },
  { prefix: '/event-sommelier', title: { fr: 'Sommelier d’événement', en: 'Event sommelier' } },
  { prefix: '/community', title: { fr: 'Communauté', en: 'Community' } },
  { prefix: '/arbiter', title: { fr: 'Arbitre patrimonial', en: 'Collection arbiter' } },
  { prefix: '/capture', title: { fr: 'Capturer', en: 'Capture' } },
  { prefix: '/item', title: { fr: 'Fiche', en: 'Object sheet' } },
  { prefix: '/market', title: { fr: 'Marché', en: 'Market' } },
  { prefix: '/profile', title: { fr: 'Profil', en: 'Profile' } },
  { prefix: '/paywall', title: { fr: 'Formules', en: 'Plans' } },
  { prefix: '/privacy', title: { fr: 'Confidentialité', en: 'Privacy' } },
];

/** Réduit toute variante i18n supportée (`en-US`, `fr-FR`) à FR ou EN. */
export function documentTitleLocale(language: string | undefined): DocumentTitleLocale {
  return language?.trim().toLowerCase().startsWith('en') ? 'en' : 'fr';
}

/** Titre de document pour un pathname (toujours non vide, suffixé « — VELUM »). */
export function documentTitleFor(pathname: string, language: string = 'fr'): string {
  const locale = documentTitleLocale(language);
  const match = BY_PREFIX.find((entry) =>
    pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  return match ? `${match.title[locale]} — VELUM` : BASE[locale];
}
