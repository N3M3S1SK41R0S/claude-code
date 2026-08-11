# MISSION GEN 2 — v4.4 « Toute la troupe en figurines peintes »
*(fait suite à ton Cageot v4.3 : tes PEINTURES sont validées et adoptées —
c'est désormais le format officiel des pions du jeu)*

## 1. Le verdict Cageot v4.3, sans détour

Tes trois peintures (face, trois quarts, dos) sont exactement le niveau
attendu : le joueur voit TA peinture, trait pour trait. Adoptées.
Le CONTENEUR GLB, lui, est abandonné : testé dans un moteur three.js
standard, il s'affiche à l'envers (convention UV inversée) et ses trois
plans superposés en transparence se voient l'un l'autre. Aucune
importance : le jeu affichera directement tes peintures — c'est la
garantie de fidélité absolue. **Ne produis plus de GLB.**

## 2. Le format de livraison (celui de ton atlas v4.3, cadré)

Pour CHAQUE personnage : **un PNG 1024×1024 à fond transparent**
contenant les vues côte à côte, chaque vue dans son tiers, SANS déborder
sur le tiers voisin (le trois-quarts de Cageot mordait légèrement sur la
tranche de droite — à corriger dans les prochains atlas).
- **Héros (ils marchent) : 3 vues** — face, trois quarts, dos.
- **PNJ (ils sont postés) : 1 seule vue de face**, centrée (PNG
  1024×1024 aussi, pour garder une chaîne unique).
- Même style que Cageot v4.3 : gouache chaude, personnage en pied sur
  le **socle-tambour bois/bronze à losanges d'or** (uniforme d'équipe),
  même échelle et même cadrage d'un personnage à l'autre (Cageot =
  étalon), palette de la mission v4.1 respectée.
- ≤ 400 Ko par atlas (ton PNG palette à 203 Ko était parfait).

## 3. Le lot à produire

**Les 10 héros restants** (3 vues chacun) :
`atlas-etincelle.png`, `atlas-gobelin.png`, `atlas-nebulia.png`,
`atlas-boumbastien.png`, `atlas-duchesse.png`, `atlas-flaque.png`,
`atlas-pelote.png`, `atlas-hibou.png`, `atlas-kribouille.png`,
`atlas-plomberoy.png`.

**Les PNJ (1 vue de face chacun)** :
`pnj-gerard.png` (squelette courtois à nœud papillon),
`pnj-merlinouche.png` (mage débraillé au chapeau tordu),
`pnj-zebulon.png` (génie vaporeux mauve sortant de sa lampe),
`pnj-piquot.png`, `pnj-turbo.png`, `pnj-roquefort.png`,
`pnj-fee-bricole.png` — fidèles à leurs portraits peints existants.

Points de vigilance inchangés : Nébulia au visage VISIBLE sous la
capuche ; Gobelin peau verte et GRANDES oreilles ; Hibou GROSSES
lunettes ; Plomberoy GROSSE moustache ; Kribouille turquoise au ventre
lavande.

## 4. Livraison et validation

ZIP unique : les atlas + une planche de comparaison par personnage
(portrait existant à côté des vues) + `INVENTAIRE.md`. Le procédé
Cageot ayant fait ses preuves, tu peux livrer le lot complet d'un coup.
Critère d'acceptation : chaque personnage reconnu en UNE seconde,
zéro écart de couleur ni de style avec Cageot v4.3 posé à côté.

## 5. Ce que le jeu en fera (pour information)

Chaque pion devient ta figurine en pied : vue de dos quand le héros
s'éloigne, trois quarts quand il tourne, face quand il regarde le
joueur — toujours ta peinture, jamais une interprétation.
