# MISSION GEN 2 — v4.2 « La peinture cuite dans la figurine »
*(complète la v4.1 : la géométrie de ton Cageot est VALIDÉE ; c'est le
niveau de finition qui monte d'un cran, à partir de TA propre planche)*

## 0. La référence officielle

Ta planche « figurine Cageot en trois vues » (face, trois quarts, dos,
sur socle-tambour bois et bronze) est adoptée comme **référence
officielle de rendu** pour TOUS les héros. Copie conservée dans le
projet : `docs/reference-cageot-figurine.jpg`. C'est exactement ça que
le joueur doit voir en 3D.

## 1. Ce que la v4.1 a prouvé (et ce qui manque)

Ton `hero-cageot.glb` v4.1 est bon sur TOUT le mesurable : pivot au
sol, 2,2 u, 2 182 triangles, les 8 clips, 89,7 Ko. Silhouette validée.
MAIS son rendu est fait d'aplats : la texture embarquée est quasi
blanche (de très légers coups de pinceau) et toute la couleur vient de
14 matériaux unis. Résultat à l'écran : propre… et plat. Ta planche,
elle, est PEINTE : visage expressif aux yeux bruns brillants, carton
ondulé aux stries chaudes, scotch ivoire, casserole martelée, cape aux
plis rouille, socle orné. **Cette peinture doit vivre DANS la
texture.**

## 2. La règle v4.2 : tout dans la texture, un seul matériau

- **Une seule texture 1024×1024 PEINTE par héros**, qui porte TOUTE la
  couleur et TOUT le détail : visage complet (yeux, sourcils, bouche,
  joues), matières (carton ondulé + scotch, métal martelé, tissu
  froissé), ombres et lumières douces cuites (éclairage neutre, pas
  d'ombre portée dure).
- **`baseColorFactor` = blanc `[1,1,1,1]`** sur tous les matériaux
  (idéalement UN seul matériau). La texture est lue en sRGB
  automatiquement : cela supprime définitivement le piège
  colorimétrique de la v4.1 (tes hex étaient bons mais délavés à
  l'écran, nous avions dû convertir).
- Le mesh reste LOW-POLY (le détail vit dans la peinture, pas dans la
  géométrie) : silhouette v4.1 conservée, tu peux arrondir légèrement
  (épaules, casserole, bottes) si le budget triangles le permet.
- **Le socle de ta planche est adopté** : tambour bois cerclé de
  bronze, losanges dorés — même socle pour les 11 héros (c'est leur
  uniforme d'équipe).

## 3. Budgets ajustés (une vraie peinture pèse plus lourd)

- Texture 1024×1024 embarquée, **JPEG (`image/jpeg`) accepté** pour le
  baseColor (pas d'alpha nécessaire) — vise qualité 80-85.
- **≤ 5 000 triangles** (inchangé), **≤ 350 Ko par héros** après Draco
  (au lieu de 120 Ko), **lot complet des 11 < 4 Mo**.
- Le reste ne bouge pas : glTF 2.0 binaire + Draco, Y-up, pivot au
  sol, 2,2 u socle compris, clips EXACTS `idle`, `walk`, `joy`,
  `disappointment`, `deception`, `salute`, `dance`, `think`.

## 4. Processus (identique à la v4.1, qui a bien fonctionné)

1. **Relivrer D'ABORD Cageot seul** (`hero-cageot.glb` v4.2) avec sa
   planche de comparaison : les 3 rendus du GLB posés à côté des 3
   vues de ta planche peinte, dans la même image.
2. Validation (le juge de paix : à 2 mètres de l'écran, on ne doit
   plus savoir dire laquelle des deux colonnes est la 3D).
3. Une fois Cageot v4.2 validé : les 10 autres, chacun avec sa
   planche, + `INVENTAIRE.md` + `QA.json` (triangles RÉELS du fichier,
   la v4.1 annonçait 3 368 pour 2 182 déclarés).

## 5. Rappels fidélité par héros (inchangés depuis la v4.1)

Palette de la mission v4.1 toujours en vigueur — désormais DANS la
texture. Points de vigilance : Nébulia au visage VISIBLE sous la
capuche ; Gobelin à la peau verte et aux GRANDES oreilles ; Hibou aux
GROSSES lunettes ; Plomberoy à la GROSSE moustache ; Kribouille
turquoise au ventre lavande.
