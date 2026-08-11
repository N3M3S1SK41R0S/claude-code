# 🎨 Brief visuel #2 — « Le Donjon du Savoir » (lots C, E, F, G)

> **À remettre tel quel à ChatGPT (outil de génération d'images).**
> Suite du premier brief : les icônes (A), portraits (B) et jetons de case (D)
> sont **déjà produits et intégrés**. Ce lot complète l'habillage : mascotte
> narrateur, décor de plateau, bannière d'accueil, fonds de donjon.
> ChatGPT n'a pas accès au dépôt : il **produit des fichiers PNG nommés**
> (l'intégration est faite ensuite côté code). Livre un PNG par asset, **avec
> les noms de fichiers exacts** ci-dessous.

---

## 0. RÈGLE D'OR : continuité de style

Ces nouveaux visuels doivent être **indiscernables, en style**, de ceux déjà
livrés (portraits des compagnons + jetons de case). Reprends **exactement** la
même patte :

- **Peinture cartoon plate**, contours doux et épais, aplats + dégradés
  chaleureux, petites lumières dorées, ombres portées douces.
- Univers **donjon médiéval-fantastique BON ENFANT**, jamais effrayant.
- **Accent or `#e0b04a`** partout (liserés, éclats, cadres).
- Rendu « livre de contes de donjon », accueillant, familial.

Si tu as encore les portraits/jetons du premier lot, **inspire-t'en directement**
pour la cohérence des couleurs, du trait et de la lumière.

## 1. Contraintes ABSOLUES (non négociables — rappel)

1. **100 % original.** Aucune marque, aucun logo, **aucun personnage ni élément
   sous licence** (pas de Mario, Naheulbeuk, Kaamelott, Astérix, Zelda, D&D,
   Pokémon…), aucune ressemblance avec une personne réelle.
2. **Tout public / familial.** Rien d'effrayant, gore, violent ou glauque. Le
   trou noir, les catacombes, le volcan restent **rigolos et féeriques**.
3. **Cohérence totale** avec le lot déjà livré (voir §0).
4. **Lisibilité** : formes simples et contrastées.
5. **Transparence (PNG alpha)** pour la mascotte et le décor ; fonds pleins
   seulement pour la bannière et les fonds de donjon.
6. **Poids maîtrisé** (voir §7) : le jeu s'assemble aussi en un seul fichier.

## 2. Charte graphique (rappel — couleurs exactes de l'app)

- Fond nuit : `#1a1230` · Pierre : `#2a1f4a` · Carte : `#342a58`
- Encre claire : `#f4ecd8` · Doux/mauve : `#b3a8d4`
- **Or (signature)** : `#e0b04a` · Or sombre : `#221a10`
- Vert « bien » : `#58c98b` · Rouge « raté » : `#e06a6a`

---

## 3. LOT C — La mascotte narrateur « Le Grand Héraut du Donjon » 🎺

Le maître de cérémonie du jeu, présent à chaque commentaire. Personnage
**100 % original**, chaleureux et bonhomme.

| Fichier | Taille | Fond | Description |
|---|---|---|---|
| `heraut.png` | 512×512 | **transparent** | Buste d'un joyeux héraut de donjon qui **souffle dans une trompette d'annonce (cor)** ornée d'un **fanion doré**. Tenue de crieur public médiéval-fantastique aux tons violet/or, sourire avenant, joues gonflées. Cadrage buste, **centré**, pensé pour être vu aussi en petit (jusqu'à ~48 px). |
| `heraut-medaillon.png` | 256×256 | **transparent** | La **même tête/buste**, recadrée dans un **médaillon rond cerclé d'or**, EXACTEMENT dans le style des 6 portraits de compagnons déjà livrés (pour l'afficher à côté de ses répliques). |

Cohérence : le médaillon doit ressembler à un « 7ᵉ compagnon » de la même
galerie que Sire Cageot, Dame Étincelle, etc.

## 4. LOT E — Décor d'ambiance du plateau

Petits éléments **PNG transparents**, ~**160×160**, posés autour du chemin.
Ils remplacent les emojis de décor actuels : garde le **même sens** pour chacun,
en version peinte, mignonne et féerique. Livre les **12** :

| Fichier | Élément | Note |
|---|---|---|
| `decor-chateau.png` | Château de donjon | tours, fanions dorés, accueillant |
| `decor-arbre.png` | Arbre / sapin | feuillage stylisé |
| `decor-bougie.png` | Chandelle / bougeoir | petite flamme chaude |
| `decor-champignon.png` | Champignon | à pois, féerique |
| `decor-chauvesouris.png` | Chauve-souris | rigolote, pas effrayante |
| `decor-toile.png` | Toile d'araignée | coin décoratif, mignonne |
| `decor-cristal.png` | Cristal / gemme | violet ou doré, brillant |
| `decor-statue.png` | Statue de pierre | tête sculptée sympathique |
| `decor-volcan.png` | Petit volcan | fumerolle joyeuse, pas menaçant |
| `decor-os.png` | Petit os | comique, cartoon |
| `decor-etoile.png` | Étoile scintillante | dorée, éclats |
| `decor-flamme.png` | Flammèche / torche | feu chaleureux |

Chaque élément est **isolé sur fond transparent**, sans cadre, sans texte.

## 5. LOT F — Bannière d'accueil

| Fichier | Taille | Fond | Description |
|---|---|---|---|
| `hero-accueil.png` | **1600×900** (16:9) | opaque | Illustration d'accueil : une **porte de donjon accueillante**, un **chemin de plateau qui serpente** vers le fond, quelques compagnons de dos ou de trois-quarts, éclats dorés, ambiance chaude et féerique. **Laisser une zone calme et sombre en haut-centre** (pour poser le titre texte « LE DONJON DU SAVOIR » par-dessus). Pas de texte dans l'image. |

Livre-la aussi, si possible, en **version compressée** (`hero-accueil.webp` ou
`.jpg`, < 250 Ko) pour l'usage web léger.

## 6. LOT G — Fonds de donjon (un par plateau)

Cinq **fonds plein-cadre**, **1600×1600**, **opaques**, qui teintent l'ambiance
de chacun des 5 plateaux. **IMPORTANT** : ils restent en **arrière-plan** — le
chemin, les jetons et les pions se posent dessus. Donc **peu contrastés, peu
chargés au centre**, détails surtout sur les **bords**, pas de gros motif au
milieu. Palette sombre dominante (base `#1a1230`) pour que le texte reste
lisible.

| Fichier | Plateau | Ambiance |
|---|---|---|
| `fond-crypte.png` | La Crypte d'Initiation | douce, chandelles, voûtes claires — la plus clémente |
| `fond-donjon.png` | Le Grand Donjon | classique : pierres, torches, bannières dorées |
| `fond-tour.png` | La Tour du Vertige | hauteur, escaliers en colimaçon, ciel nocturne étoilé |
| `fond-catacombes.png` | Les Catacombes du Chaos | joueuse : cavités, cristaux, lucioles (jamais macabre) |
| `fond-labyrinthe.png` | Le Labyrinthe Doré | trésors, ors, coffres, lumière chaude et riche |

Livre chacun **aussi** en version compressée (`.webp`/`.jpg`, < 300 Ko) : ces
fonds resteront réservés à l'appli installée si les PNG sont trop lourds.

---

## 7. Livraison & budget poids

- Un PNG **par asset**, nommé **exactement** comme indiqué ; un ZIP par lot est
  parfait (dossiers `C-heraut/`, `E-decor/`, `F-banniere/`, `G-fonds/`).
- **Priorité** : **C** (mascotte) puis **E** (décor) — fort impact, faible poids.
  **F** et **G** ensuite (plus lourds).
- Cibles de poids : héraut < 60 Ko ; chaque décor < 25 Ko ; bannière et fonds :
  fournir **une version PNG** ET **une version compressée** (`.webp`/`.jpg`),
  car les gros fonds ne seront pas embarqués dans le fichier unique (ils
  resteront dans l'appli installée) pour garder ce dernier léger.
- Si un rendu ne convient pas, on itère asset par asset.

## 8. Ce qui sera fait côté code (pour info — rien à faire ici)

- `heraut*.png` → affichés dans le bandeau du narrateur (`js/herald.js` +
  `js/ui.js` / `css/style.css`), avec repli sur l'emoji 📯.
- `decor-*.png` → remplacent les emojis de décor dans `js/board.js` (`DECOR`),
  avec repli emoji.
- `hero-accueil.png` → écran d'accueil (`index.html` `#screen-home` +
  `css/style.css`).
- `fond-*.png` → arrière-plan par plateau via les classes `board-theme-*`
  (`css/style.css`) ; probablement **appli installée uniquement** (hors fichier
  unique) selon le poids.
- Le bundler encode en **data-URI** ce qui est léger (héraut, décor) et le
  service worker (`sw.js`) précache les nouveaux fichiers (bump de version).
  Un **repli** emoji/CSS reste en place si une image manque.

## 9. Rappel du style en une phrase

> Même **livre de contes de donjon** chaleureux que les portraits et jetons
> déjà livrés : aplats colorés, contours doux, éclats dorés, féerique et
> familial. Zéro peur, zéro marque, 100 % maison.
