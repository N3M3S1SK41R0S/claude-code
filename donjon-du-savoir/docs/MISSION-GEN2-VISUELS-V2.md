# Mission GEN 2 — Visuels v2 « Grand Cabaret » du Donjon du Savoir

Objectif : pousser encore le niveau visuel du jeu (3D et 2D) avec des
assets peints ORIGINAUX, dans la continuité du style déjà livré
(cartoon peint chaleureux, palette violet nuit + or, familial).

## Règles de production (inchangées, non négociables)

1. **100 % original.** Aucun personnage, décor ou logo inspiré d'une
   licence existante. Nos héros et PNJ uniquement.
2. **Palette** : violets nuit (#1a1230 → #342a58), or #e0b04a, ivoire
   #f4ecd8 ; accents par type de case (voir `js/board.js CASE_TYPES`).
3. **Formats** : PNG fond transparent pour les éléments posés, WebP
   qualité 82 pour les fonds pleins. Poids total du lot **< 2 Mo** —
   le jeu vit dans un seul fichier de ~10 Mo, chaque Ko compte.
4. **Chemins littéraux** : livrer avec les noms EXACTS ci-dessous, le
   bundler (`tools/build-standalone.mjs`) inline tout en data-URI.

## Lot A — La 3D encore plus riche (priorité haute)

| Fichier | Contenu | Taille |
|---|---|---|
| `assets/3d/textures/sol-crypte.webp` | dalles de pierre moussues, SEAMLESS | 512×512 |
| `assets/3d/textures/sol-donjon.webp` | dalles violettes usées, SEAMLESS | 512×512 |
| `assets/3d/textures/sol-tour.webp` | pierre rouge sombre, SEAMLESS | 512×512 |
| `assets/3d/textures/sol-catacombes.webp` | ossuaire discret (familial !), SEAMLESS | 512×512 |
| `assets/3d/textures/sol-labyrinthe.webp` | pavés dorés, SEAMLESS | 512×512 |
| `assets/ciel-crypte.webp` … `ciel-labyrinthe.webp` (5) | panorama équirectangulaire peint (ciel étoilé, lune, silhouettes) | 2048×1024 |

Ces textures remplaceront le sol uni et les cubemaps procédurales de
`js/board3d.js` (repli automatique si absentes : rien ne casse).

## Lot B — Les écrans de fête (priorité haute)

| Fichier | Contenu |
|---|---|
| `assets/fond-victoire.webp` | grande salle du trône en liesse, confettis peints (1280×720) |
| `assets/micro-heraut.png` | le micro-parchemin du Héraut pour l'interview d'après-match (512×512) |
| `assets/parchemin-sponsor.png` | petit parchemin déroulé « réclame du royaume » (512×256) |
| `assets/medaille-argentier.png` | médaille « Grand Argentier » (pièce d'or à ruban) (256×256) |
| `assets/medaille-sangfroid.png` | médaille « Prix du Sang-Froid » (bouclier fissuré digne) (256×256) |
| `assets/medaille-espoir.png` | médaille « Meilleur Espoir » (étoile montante) (256×256) |
| `assets/medaille-constance.png` | médaille « Constance dans l'Erreur » (plume qui persévère, BIENVEILLANTE) (256×256) |

## Lot C — Les tenues de héros (priorité moyenne)

6 pastilles de tenue pour l'écran Palmarès et le réglage de partie
(`assets/tenue-classique.png`, `tenue-doree`, `tenue-emeraude`,
`tenue-flamboyante`, `tenue-royale`, `tenue-cosmique`) : un médaillon
128×128 par tenue (étoffe + liseré de la couleur : or #e0b04a, vert
#3ec27a, braise #e05a3c, pourpre #c23e6b, violet céleste #7a6ad0).

## Lot D — La carte souvenir (priorité douce)

`assets/souvenir-cadre.png` : un cadre parchemin/dorures 1080×1350
(fond TRANSPARENT au centre) que la carte souvenir canvas posera
par-dessus ses éléments. Coins ornés, sobres, imprimables.

## Livraison

ZIP unique reprenant l'arborescence `assets/…` ci-dessus + un
`INVENTAIRE.md` listant chaque fichier avec une ligne de description.
Toute pièce manquante est simplement ignorée par le jeu (replis
garantis) : livrez par lots si nécessaire, priorité A > B > C > D.
