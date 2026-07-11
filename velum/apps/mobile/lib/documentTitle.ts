/**
 * Titre de document par route (WCAG 2.4.2). Sur l'export web statique,
 * expo-router ne propage pas `options.title` au runtime ; on pose donc
 * `document.title` nous-mêmes depuis le pathname. Helper pur, testé.
 */
const BASE = 'VELUM — analyse & valorisation';

const BY_PREFIX: { prefix: string; title: string }[] = [
  { prefix: '/onboarding', title: 'Bienvenue' },
  { prefix: '/sign-in', title: 'Connexion' },
  { prefix: '/sign-up', title: 'Créer un compte' },
  { prefix: '/collection', title: 'Ma collection' },
  { prefix: '/carnet', title: 'Mon carnet' },
  { prefix: '/cellar-sommelier', title: 'Sommelier de cave' },
  { prefix: '/capture', title: 'Capturer' },
  { prefix: '/item', title: 'Fiche' },
  { prefix: '/market', title: 'Marché' },
  { prefix: '/profile', title: 'Profil' },
  { prefix: '/paywall', title: 'Formules' },
  { prefix: '/privacy', title: 'Confidentialité' },
];

/** Titre de document pour un pathname (toujours non vide, suffixé « — VELUM »). */
export function documentTitleFor(pathname: string): string {
  const match = BY_PREFIX.find((e) => pathname === e.prefix || pathname.startsWith(`${e.prefix}/`));
  return match ? `${match.title} — VELUM` : BASE;
}
