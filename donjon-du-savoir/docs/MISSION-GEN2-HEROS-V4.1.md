# MISSION GEN 2 — v4.1 CORRECTIVE « Trait pour trait »
*(remplace la v4, rejetée : les héros livrés avaient la peau bleu marine
et une palette froide, sans rapport avec les portraits peints)*

## 0. Ce qui a changé dans le jeu en attendant

Les pions 3D sont désormais TES FIGURINES PEINTES (hero-*.png), animées
par le code. C'est la référence de fidélité à battre : un GLB ne sera
accepté que s'il est AUSSI ressemblant que la peinture.

## 1. La règle absolue de cette mission

**TRAIT POUR TRAIT.** Chaque figurine doit être la copie en volume de la
peinture du même héros : mêmes couleurs EXACTES (codes ci-dessous),
mêmes proportions, mêmes accessoires, même bouille. Pas
d'interprétation, pas de « style » nouveau. La texture doit être PEINTE
(coups de pinceau, dégradés chauds), jamais des aplats unis.

## 2. Palette OBLIGATOIRE (relevée sur les portraits)

- **Peau des humains : #f2c9a0** (pêche chaude) — JAMAIS de bleu.
- Cageot : carton #b98a54 / #8a6234, casserole gris acier #9aa2ad.
- Étincelle : violet #8e5cc2, chapeau #6a3fa0, étincelles or #e0b04a.
- Gobelin : peau VERTE #7dd39a, gilet sombre, pièce d'or #e0b04a.
- Nébulia : capuche bleu nuit #2b2d66, visage clair #e8d8f0 VISIBLE.
- Boumbastien : cheveux roux roussis #a0522d, lunettes #cfe8f0.
- Duchesse : robe #c23e6b, cheveux gris-lilas #d8d0e8, diadème or.
- Flaque : bandana rouge #c0392b, fond turquoise #2f9e8f.
- Pelote : chignon gris #d8d8de, pelote rose #e07ba0.
- Hibou : plumage brun #a07a52, ventre #c9a978, lunettes ivoire #f4ecd8.
- Kribouille : fourrure turquoise #3fc4b0, ventre lavande #c9a6e0.
- Plomberoy : armure rouge #b23a2a, casque acier #9aa2ad, plume ivoire.

## 3. Processus de validation OBLIGATOIRE (nouveau)

1. **Livrer D'ABORD UN SEUL héros : Cageot** (`hero-cageot.glb`),
   accompagné de 3 rendus PNG (face, trois quarts, dos) posés À CÔTÉ
   du portrait peint dans la même image (planche de comparaison).
2. Nous validons ou refusons avec commentaires.
3. Une fois Cageot validé, produire les 10 autres avec le même procédé
   (chacun avec sa planche de comparaison dans le ZIP final).

## 4. Contraintes techniques (inchangées)

glTF 2.0 binaire, Draco bienvenu, Y-up, pivot au sol, héros ≈ 2,2 u,
≤ 5 000 triangles, texture 1024×1024 embarquée, ≤ 120 Ko/pièce.
Clips EXACTS à conserver : `idle`, `walk`, `joy`, `disappointment`,
`deception`, `salute`, `dance`, `think`.

## 5. Critère d'acceptation final

Un joueur qui connaît le jeu doit dire « c'est Cageot ! » en UNE
seconde en voyant la figurine, et ne remarquer AUCUNE différence de
couleur avec le portrait posé à côté. Sinon : refus, retour au §3.
