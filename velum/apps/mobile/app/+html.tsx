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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta
          name="description"
          content="VELUM — identifiez, analysez et estimez vos vins, pièces, tableaux et timbres."
        />
        <meta name="theme-color" content="#1a0d10" />
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
