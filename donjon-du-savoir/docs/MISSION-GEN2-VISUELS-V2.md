# MISSION GEN 2 — Visuels v2 « Grand Cabaret » du Donjon du Savoir
*(mission intégrale et autonome : tout le contexte nécessaire est ici)*

## 1. Le projet

« Le Donjon du Savoir » est un jeu de plateau familial de culture
générale (dans l'esprit d'un party game de plateau, 1 à 20 joueurs de
2 à 99 ans, sans chronomètre, personne n'est jamais éliminé). Il tourne
100 % hors-ligne dans un navigateur, avec un plateau en 3D : un village
de donjon chaleureux où des figurines de héros avancent de case en
case, caméra qui zoome sur le joueur actif, bâtiments translucides pour
que le plateau reste lisible, mini-carte globale.

Ton rôle (GEN 2) : tu es le directeur artistique-exécutant du projet.
Tu as déjà produit tout l'univers peint du jeu. Cette mission prolonge
EXACTEMENT ce que tu as créé — même pinceau, même chaleur, même humour.

## 2. Ce que tu as déjà livré (à respecter pour la cohérence)

- **11 héros peints** (portraits + figurines + GLB 3D) : Cageot le
  chevalier en carton (casserole sur la tête), Étincelle la magicienne
  pétillante, le Gobelin Comptable à lunettes, Nébulia la sorcière
  cosmique, Boumbastien l'inventeur roussi, la Duchesse érudite au
  face-à-main, Flaque le corsaire des flaques, Pelote la mamie
  tricoteuse, le Hibou bibliothécaire, Kribouille la créature des
  étoiles, Plomberoy le plombier-chevalier à plume.
- **15 PNJ peints** : Merlinouche l'Étourdi (mage gaffeur), Biscornu le
  Dragonnet, Maître Hibou de Passage, Barnabé le Bateleur, Roquefort le
  Mulot Marchand, la Fée Bricole, Boubou le Fantôme Timide, Gérard le
  Squelette Poli (tient la boutique), Turbo l'Escargot, Groumf le Troll
  Gentil, Ratichon le Chapardeur Repenti, Sylvette la Sylphide, Coassin
  le Crapaud Bavard, Piquot le Hérisson Pressé, Zébulon le Génie
  Distrait.
- **10 bâtiments** (château, tour du mage, boutique, taverne,
  bibliothèque, pont, portail, fontaine, kiosque-étoile, maison
  champignon), **12 jetons de cases**, **14 objets** (coffre, potion,
  tonneau, dé, sablier…), **12 décors**, le **Grand Héraut** (mascotte
  crieur public), et 5 **fonds d'ambiance** (donjon, crypte, tour,
  catacombes, labyrinthe).

## 3. Règles d'or (non négociables)

1. **100 % ORIGINAL.** Aucun personnage, décor, logo, silhouette ou
   « hommage » à une licence existante (pas de plombier moustachu rouge,
   pas de sorcier à cicatrice, rien de reconnaissable d'ailleurs).
   Uniquement NOTRE univers, décrit au §2.
2. **FAMILIAL.** Rien d'effrayant ni de macabre : même les catacombes
   sourient. Les squelettes sont polis, les fantômes timides.
3. **Aucun texte incrusté** dans les images (le jeu écrit par-dessus).
4. **Fond transparent** pour tout élément « posé » (PNG) ; fonds pleins
   en WebP qualité ~82.
5. **Noms de fichiers EXACTS** (listés ci-dessous) : l'intégration dans
   le jeu est automatique, le moindre écart de nom = fichier ignoré.
6. **Poids total du lot < 2 Mo.** Le jeu entier tient dans ~10 Mo
   embarqués : chaque kilo-octet compte. Optimise agressivement.

## 4. Direction artistique

- **Style** : cartoon peint à la main, formes rondes, contours doux,
  matières visibles (coups de pinceau assumés), zéro photoréalisme.
- **Palette maîtresse** : violets nuit #1a1230 → #342a58 (fonds), or
  chaud #e0b04a (lumières, trésors, liserés), ivoire parchemin #f4ecd8
  (clartés), avec la lumière « bougie » : chaude, tamisée, joyeuse.
- **Accents par thème de donjon** :
  - Crypte d'Initiation : vert mousse #3f6b46, bougies, douceur.
  - Grand Donjon : violet #4a3a78, bannières or, classique et fier.
  - Tour du Vertige : rouge sombre #6e3a3a, hauteur, vent, braises.
  - Catacombes du Chaos : bleu-vert #2e5f63, champignons luisants,
    os TRÈS discrets et rigolos.
  - Labyrinthe Doré : or #7a6428, pavés dorés, coffres, opulence.
- **Humour visuel** : pince-sans-rire — un détail absurde par image
  suffit (une gargouille qui bâille, un panneau « fragile » sur un
  rocher). Jamais de surcharge.

## 5. LOT A — Textures 3D (priorité 1)

**Sols de donjon**, SEAMLESS (répétables sans couture visible dans les
deux axes), 512×512, WebP :

| Fichier | Contenu |
|---|---|
| `assets/3d/textures/sol-crypte.webp` | dalles de pierre moussues, joints verts discrets |
| `assets/3d/textures/sol-donjon.webp` | dalles violettes usées, éclats d'usure ivoire |
| `assets/3d/textures/sol-tour.webp` | pierre rouge sombre, fissures fines |
| `assets/3d/textures/sol-catacombes.webp` | pierre bleu-vert, un petit os rigolo par-ci par-là |
| `assets/3d/textures/sol-labyrinthe.webp` | pavés dorés patinés, reflets chauds |

**Ciels panoramiques** ÉQUIRECTANGULAIRES (360°, projection
equirectangular pour servir de skybox 3D), 2048×1024, WebP — ciel
étoilé nocturne, lune peinte, silhouettes de tours et de collines à
l'horizon, teinté aux couleurs du thème :

`assets/ciel-crypte.webp` · `assets/ciel-donjon.webp` ·
`assets/ciel-tour.webp` · `assets/ciel-catacombes.webp` ·
`assets/ciel-labyrinthe.webp`

## 6. LOT B — Les écrans de fête (priorité 2)

| Fichier | Taille | Contenu |
|---|---|---|
| `assets/fond-victoire.webp` | 1280×720 | grande salle du trône en liesse : trône doré au centre, confettis peints, bannières, foule de silhouettes joyeuses (nos PNJ de dos, pas de visages détaillés) |
| `assets/micro-heraut.png` | 512×512 | le « micro-parchemin » du Héraut pour l'interview d'après-match : un parchemin roulé tendu comme un micro, doré, digne et drôle |
| `assets/parchemin-sponsor.png` | 512×256 | petit parchemin déroulé « réclame du royaume », cachet de cire, coin corné |
| `assets/medaille-argentier.png` | 256×256 | médaille « Grand Argentier » : pièce d'or rayonnante à ruban violet |
| `assets/medaille-sangfroid.png` | 256×256 | médaille « Prix du Sang-Froid » : bouclier fissuré mais fier, ruban rouge |
| `assets/medaille-espoir.png` | 256×256 | médaille « Meilleur Espoir » : étoile montante, ruban vert |
| `assets/medaille-constance.png` | 256×256 | médaille « Constance dans l'Erreur » : une plume qui persévère — AFFECTUEUSE, c'est un prix tendre, pas une moquerie |

## 7. LOT C — Pastilles de tenues (priorité 3)

Le jeu débloque des « tenues » de héros via les succès. 6 médaillons
128×128, PNG transparent : une étoffe drapée + liseré de la couleur,
même gabarit pour les six.

| Fichier | Couleur du liseré |
|---|---|
| `assets/tenue-classique.png` | ivoire #f4ecd8 |
| `assets/tenue-doree.png` | or #e0b04a |
| `assets/tenue-emeraude.png` | vert #3ec27a |
| `assets/tenue-flamboyante.png` | braise #e05a3c |
| `assets/tenue-royale.png` | pourpre #c23e6b |
| `assets/tenue-cosmique.png` | violet céleste #7a6ad0 + petites étoiles |

## 8. LOT D — Cadre de carte souvenir (priorité 4)

`assets/souvenir-cadre.png`, 1080×1350, PNG : un cadre
parchemin/dorures dont le CENTRE EST ENTIÈREMENT TRANSPARENT (le jeu
dessine la carte souvenir dessous : podium, stats, anecdote). Coins
ornés, sobre, beau à imprimer en A4.

## 9. Checklist qualité avant livraison

- [ ] Style raccord avec les assets existants (§2 et §4).
- [ ] Aucun texte incrusté, aucun élément sous licence.
- [ ] Sols réellement seamless (tester en mosaïque 2×2).
- [ ] Ciels réellement équirectangulaires (pas de déformation aberrante
      aux pôles au niveau de l'horizon).
- [ ] PNG : fond transparent propre (pas de halo blanc).
- [ ] Poids total < 2 Mo, chaque fichier optimisé.
- [ ] Noms de fichiers exactement conformes aux tableaux.

## 10. Livraison

Un ZIP unique reprenant l'arborescence `assets/…` ci-dessus, plus un
`INVENTAIRE.md` (une ligne de description par fichier). Livraison par
lots acceptée, priorité A > B > C > D. Toute pièce manquante est
simplement ignorée par le jeu (replis garantis) — chaque pièce livrée
sera intégrée automatiquement.
