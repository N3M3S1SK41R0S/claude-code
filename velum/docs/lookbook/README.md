# Lookbook produit VELUM

Une page HTML **autonome** (self-contained) qui présente l'application dans son
écrin velours & or : le sceau VE, la vidéo de lancement et les captures d'écran
réelles du build de démonstration, organisées en chapitres.

Elle sert de vitrine à partager (investisseurs, partenaires, stores) sans aucune
dépendance externe : tout est embarqué en `data:` URI (CSP-safe).

## Régénérer

Prérequis : **ffmpeg** dans le `PATH` (ré-encodage de la vidéo + redimensionnement
des images).

```bash
# 1) (optionnel) régénérer les captures d'écran d'abord
pnpm --filter velum-mobile build:web        # build normal
node e2e/store-screens.mjs                   # écrans publics (01–05)
node e2e/auth-screens.mjs                    # écrans connectés (06–21)
node e2e/senior-screens.mjs && node e2e/offline.mjs

# 2) construire la page
node docs/lookbook/generate.mjs
# → écrit docs/lookbook/velum-lookbook.html (gitignoré)
```

## Publier

Ouvrir `docs/lookbook/velum-lookbook.html` dans un navigateur, ou la publier
comme page / artifact. La page :

- s'adapte au thème clair (« mur de galerie » parchemin) et sombre (écrin velours),
- respecte `prefers-reduced-motion`,
- ne fait **aucune** requête réseau (polices système, médias inline).

## Contenu

Les écrans et leurs légendes sont décrits dans le tableau `CHAPTERS` de
`generate.mjs` — modifier cette liste pour ajouter/retirer/réordonner une plaque.
Les fichiers référencés vivent dans `docs/screenshots/`. Le sceau, la vidéo et
l'affiche viennent de `apps/mobile/assets/brand/`.

> La page générée (`velum-lookbook.html`, ~4 Mo car médias embarqués) est un
> **livrable**, pas une source : elle est gitignorée. On versionne le générateur
> et les captures, pas le HTML produit.
