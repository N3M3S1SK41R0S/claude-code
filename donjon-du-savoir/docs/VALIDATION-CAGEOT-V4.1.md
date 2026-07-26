# VALIDATION — Cageot v4.1 « Trait pour trait »

**Verdict : VALIDÉ** (avec un correctif colorimétrique appliqué de notre côté).
Le lot de validation (`hero-cageot.glb` + planche de comparaison + QA.json)
répond au processus du §3 de la mission v4.1 : GEN 2 a le feu vert pour
produire les 10 autres héros, avec les corrections obligatoires ci-dessous.

## Mesures indépendantes (banc d'essai avec la stack du jeu, three r128 + Draco)

| Critère | Exigé | Mesuré | OK |
|---|---|---|---|
| Format | glTF 2.0 binaire + Draco | glTF 2.0, KHR_draco_mesh_compression | ✓ |
| Pivot | au sol | bbox monde minY = 0,000 | ✓ |
| Hauteur | ≈ 2,2 u | 2,200 u | ✓ |
| Triangles | ≤ 5 000 | 2 182 | ✓ |
| Texture | 1024×1024 embarquée | 1 PNG 1024×1024 embarqué | ✓ |
| Poids | ≤ 120 Ko | 89,7 Ko | ✓ |
| Clips | 8 noms exacts | idle, walk, joy, disappointment, deception, salute, dance, think — `walk` lu sans erreur | ✓ |
| Reconnaissance | « c'est Cageot ! » en 1 s | casserole 2 poignées, cheveux roux, plastron carton scotché, cape rouille, socle violet/or | ✓ |

## Le défaut détecté (corrigé chez nous)

Les 14 matériaux contenaient les **hex EXACTS de la palette imposée**
(peau #f2c9a0, carton #b98a54/#8a6234, acier #9aa2ad, or #e0b04a…),
mais encodés tels quels dans `baseColorFactor` — champ que le glTF
définit en **linéaire**. three.js les affichait donc délavés
(ex. carton #b98a54 rendu #ddc29b). Correctif appliqué :
conversion sRGB → linéaire de chaque `baseColorFactor`
(`hero-cageot.glb` du dépôt = version corrigée). Après correction,
le rendu tombe exactement sur la palette de la mission.

Divergence mineure notée : QA.json annonce 3 368 triangles, les
accessors en déclarent 2 182 (sous budget dans les deux cas).

## État du jeu

Les pions restent les **figurines peintes** (`USE_GLB_HEROES = false`)
tant que le lot complet des 11 héros fidèles n'est pas livré et validé.
Le GLB corrigé de Cageot est la nouvelle référence dans
`assets/3d/heroes/`, prête à être branchée.
