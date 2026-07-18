# 🎨 Brief visuel — « Le Donjon du Savoir »

> **À remettre tel quel à ChatGPT (avec son outil de génération d'images).**
> Objectif : produire un jeu d'illustrations original et cohérent qui remplace
> les emojis / SVG actuels et hisse l'application au niveau « vrai jeu de
> plateau ». ChatGPT n'a pas accès au dépôt : il **produit des fichiers PNG
> nommés** ; l'intégration (portraits, cases, icônes, fonds, inlining) est faite
> ensuite côté code. Livre les images en PNG téléchargeables, un par asset,
> **avec les noms de fichiers exacts indiqués**.

---

## 1. Le projet en deux phrases

« Le Donjon du Savoir » est un **jeu de plateau de culture générale** en
français (façon Mario Party), 1 à 20 joueurs sur un seul écran, PWA installable
et **hors-ligne**. Ton : **chaleureux, malicieux, tout public**, univers de
donjon médiéval-fantastique **bon enfant** (jamais effrayant). Un narrateur
mascotte, **Le Grand Héraut du Donjon** 📯, commente la partie.

## 2. Contraintes ABSOLUES (non négociables)

1. **100 % original.** Aucune marque, aucun logo, **aucun personnage ni élément
   sous licence** (pas de Mario, Naheulbeuk, Kaamelott, Astérix, Zelda, D&D,
   Pokémon, etc.), aucune ressemblance avec une personne réelle existante.
2. **Tout public / familial.** Rien d'effrayant, de gore, de violent ou de
   sombre à l'excès. Le « Trou Noir » et le « Coup dur » restent **rigolos**,
   pas angoissants.
3. **Style unique et cohérent** sur TOUS les assets (même patte, même palette,
   mêmes contours, même lumière).
4. **Lisibilité mobile** : formes simples, contrastées, lisibles à petite
   taille sur un téléphone. Grosses silhouettes, détails minimaux.
5. **Fonds transparents** (PNG alpha) pour tout ce qui se pose sur le plateau
   (portraits, jetons de case, décor). Fonds pleins autorisés seulement pour les
   bannières/fonds de plateau.
6. **Poids maîtrisé** : le jeu s'assemble aussi en **un seul fichier HTML**
   (images encodées en data-URI). Vise des PNG **nets mais légers** (voir §7).

## 3. Charte graphique

- **Style** : cartoon plat (flat), contours doux, aplats + légers dégradés,
  petites touches de lumière dorée. Pensez « livre de contes de donjon », chaud
  et accueillant. Pas de photoréalisme, pas de 3D lourde.
- **Palette** (couleurs exactes de l'app — à respecter) :
  - Fond nuit : `#1a1230` · Pierre : `#2a1f4a` · Carte : `#342a58`
  - Encre claire : `#f4ecd8` · Doux/mauve : `#b3a8d4`
  - **Or (accent roi)** : `#e0b04a` · Or sombre : `#221a10`
  - Vert « bien » : `#58c98b` · Rouge « raté » : `#e06a6a`
- **Accent signature** : l'**or `#e0b04a`** (liserés, éclats, étoiles).
- Ambiance lumière : chaude, comme des torches ; ombres portées douces.

## 4. Les assets à produire

Livre chaque groupe complet. **Respecte les noms de fichiers.**

### A. Icônes de l'application (PWA) — priorité haute

Un blason / écusson du Donjon, or sur nuit violette, avec une touche de « savoir »
(livre, plume ou étoile). Doit rester lisible en tout petit.

| Fichier | Taille | Fond | Notes |
|---|---|---|---|
| `icon-192.png` | 192×192 | opaque `#1a1230` | icône appli |
| `icon-512.png` | 512×512 | opaque `#1a1230` | icône appli HD |
| `maskable-512.png` | 512×512 | opaque | **zone de sécurité** : garder le motif dans le cercle central à 80 % (les bords sont rognés) |
| `apple-touch-icon.png` | 180×180 | opaque | coins non arrondis (iOS arrondit) |

### B. Les 6 compagnons — portraits « médaillon » — priorité haute

Format **256×256 PNG transparent**, cadrage buste dans un médaillon rond (le
cercle peut faire partie de l'image). Personnages **originaux**, expressifs,
souriants. Respecte l'identité de chacun :

| Fichier | Personnage | Description à illustrer | Couleur dominante |
|---|---|---|---|
| `portrait-cageot.png` | **Sire Cageot** | Chevalier bricolo : casserole en guise de heaume, plastron **en carton** scotché, air brave et gentil | `#c2703e` |
| `portrait-etincelle.png` | **Dame Étincelle** | Magicienne facétieuse, chapeau pointu violet, **étincelles dorées** autour d'elle | `#8e5cc2` |
| `portrait-gobelin.png` | **Gobelin Comptable** | Petit gobelin **vert** sympathique, lunettes rondes, tient une **pièce d'or**, œil malin | `#3ec27a` |
| `portrait-nebulia.png` | **Nébulia** | Sorcière cosmique, capuche bleu nuit **étoilée**, petite galaxie/spirale | `#3e6ec2` |
| `portrait-boumbastien.png` | **Boumbastien** | Inventeur farfelu, **cheveux en pétard** légèrement roussis, lunettes d'atelier | `#c2b23e` |
| `portrait-duchesse.png` | **La Duchesse Anecdote** | Érudite excentrique, chignon + **diadème** doré, **face-à-main** (monocle à manche) devant un œil | `#c23e6b` |

### C. La mascotte narrateur — priorité moyenne

| Fichier | Taille | Sujet |
|---|---|---|
| `heraut.png` | 512×512 transparent | **Le Grand Héraut du Donjon** : personnage original chaleureux qui souffle dans une **trompette d'annonce** (cor) ornée d'un fanion doré. C'est le maître de cérémonie du jeu. |

### D. Les 12 jetons de case — priorité haute

Format **128×128 PNG transparent**, style « jeton / pastille » bombé, lisible.
Un par type de case (aujourd'hui de simples emojis) :

| Fichier | Case | Idée visuelle |
|---|---|---|
| `case-question.png` | Question | gros **point d'interrogation** doré sur pastille bleue |
| `case-chance.png` | Chance | **trèfle** / fer à cheval, pastille verte |
| `case-evenement.png` | Événement collectif | **tente de fête** / chapiteau, pastille orange |
| `case-malus.png` | Coup dur (rigolo) | **peau de banane** ou petit nuage grognon, pastille rouge — drôle, pas méchant |
| `case-pieces.png` | Pièces | **pile de pièces d'or** |
| `case-joker.png` | Joker | **carte joker** / étoile filante, pastille violette |
| `case-gambit.png` | Gambit | **deux dés** ou point d'interrogation ×2, pastille turquoise |
| `case-trounoir.png` | Trou Noir (rigolo) | **spirale / trou** mystérieux mais amusant, pastille très sombre |
| `case-boutique.png` | Boutique | **panier / échoppe** de marchand, pastille rose |
| `case-insolite.png` | Savoir insolite | **ampoule** ou animal rigolo (flamant), pastille magenta |
| `case-expression.png` | Défi d'expression | **masques de théâtre** (comédie), pastille terracotta |
| `case-tresor.png` | Trésor / Étoile | **coffre au trésor** rayonnant + **étoile** dorée |

### E. Décor d'ambiance du plateau — priorité basse (optionnel)

Petits éléments **PNG transparents** (~128×128) posés autour du chemin :
`decor-chateau.png`, `decor-arbre.png`, `decor-champignon.png`,
`decor-cristal.png`, `decor-torche.png`, `decor-volcan.png`,
`decor-toile.png` (toile d'araignée), `decor-os.png`. Mignons, jamais glauques.

### F. Bannière d'accueil / titre — priorité moyenne (optionnel)

| Fichier | Taille | Sujet |
|---|---|---|
| `hero-accueil.png` | 1200×675 (16:9) opaque | Illustration d'accueil : une porte de donjon accueillante, chemin de plateau qui serpente, quelques compagnons, ambiance dorée. Laisser une zone calme en haut pour le titre texte. |

### G. Fonds de plateau par donjon — priorité basse (optionnel)

Cinq **textures/fonds tileables ou plein-cadre** (1024×1024, opaques) qui
teintent chacun des 5 plateaux, **sans surcharger** (le chemin et les jetons se
posent dessus, ils doivent rester lisibles) :
`fond-crypte.png`, `fond-donjon.png`, `fond-tour.png`, `fond-catacombes.png`,
`fond-labyrinthe.png`. Ambiances respectives : crypte douce aux chandelles /
grand donjon classique / tour vertigineuse / catacombes joueuses / labyrinthe
doré à trésors.

## 5. Livraison

- Un PNG **par asset**, nommé **exactement** comme ci-dessus.
- Idéalement regroupés par lot (A, B, C, D…) ; un ZIP est parfait.
- Si un rendu ne convient pas, on itère asset par asset.
- **Commence par les lots A, B et D** (icônes, portraits, cases) : ce sont eux
  qui transforment le plus l'app.

## 6. Budget poids (important pour la version « un seul fichier »)

- Portraits `256²` et cases `128²` : **PNG optimisés**, viser < 40 Ko pièce.
- Fonds/bannières : < 250 Ko pièce (ou fournir aussi une version JPG/WebP).
- Le fichier unique actuel pèse ~0,5 Mo ; on veut rester **sous ~2,5 Mo** une
  fois toutes les images intégrées. Si besoin, on gardera les gros fonds (E, F,
  G) uniquement pour la version installée (PWA) et pas dans le fichier unique.

## 7. Ce qui sera fait côté code après livraison (pour info)

Rien à faire pour ChatGPT ici — juste pour situer :

- **Icônes PWA** → remplacement direct de `icons/*.png` + `manifest.webmanifest`.
- **Portraits** → `js/portraits.js` : les médaillons SVG deviennent des `<img>`
  (ou data-URI) ; `portraitEl()` inchangé côté appelants.
- **Jetons de case** → `js/board.js` (`CASE_TYPES`, rendu) + `css/style.css` :
  l'emoji est remplacé/complété par l'image.
- **Fond/bannière/héros** → `css/style.css` + `index.html`.
- **Version un seul fichier** → `tools/build-standalone.mjs` encode les images
  en **data-URI** ; le service worker (`sw.js`) précache les nouveaux fichiers
  (bump de version). Un repli emoji reste en place si une image manque.

## 8. Rappel du style en une image mentale

> Un **livre de contes de donjon** chaleureux : aplats colorés, contours doux,
> éclats dorés, personnages rondouillards et souriants. On doit avoir envie d'y
> jouer en famille. Zéro peur, zéro marque, 100 % maison.

---

### Annexe — état actuel (pour référence de style)

- Palette exacte : voir §3.
- Les 6 personnages existent déjà en **médaillons SVG** (mêmes descriptions
  qu'au §4.B) — les nouvelles illustrations doivent **garder la même identité**.
- Les cases sont aujourd'hui de simples **emojis** (❓🍀🎪💀🪙🃏🎲🕳️🛒🦩🎭🏆⭐) :
  les jetons du §4.D les remplacent en gardant le **même sens** et la **même
  couleur de pastille**.
