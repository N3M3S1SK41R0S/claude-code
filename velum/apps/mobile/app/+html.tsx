/**
 * Enveloppe HTML de la PWA (web uniquement — expo-router `+html`).
 * Fournit `<title>` (WCAG 2.4.2) et `lang="fr"` (WCAG 3.1.1) à chaque page
 * exportée, plus le viewport responsive et le reset de scroll RNW.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta
          name="description"
          content="VELUM — identifiez, analysez et estimez vos vins, pièces, tableaux et timbres."
        />
        <meta name="theme-color" content="#1a0d10" />
        {/* PWA installable — « Ajouter à l'écran d'accueil » (iOS + Android).
            iOS ignore les icônes du manifest : c'est apple-touch-icon qui fait
            foi. Les fichiers viennent de apps/mobile/public/ (copié tel quel). */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VELUM" />
        <meta name="application-name" content="VELUM" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Lissage des polices (rendu net sur écrans macOS/Retina) — la cave
            sombre gagne en finesse typographique côté PWA. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}',
          }}
        />
        {/* Le <title> est fourni par le navigateur expo-router (options.title
            de chaque écran) — ne pas le dupliquer ici (deux <title> ⇒ le vide
            l'emporte et échoue à WCAG 2.4.2). */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
