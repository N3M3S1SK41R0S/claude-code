# MISSION GEN 2 — v4.5 « Les bâtiments-maquettes du village »
*(dernier chantier visuel : après tes figurines v4.3/v4.4 adoptées et
intégrées, les bâtiments doivent parler le même langage de maquette peinte)*

## 1. Le constat

Tes figurines en pied (héros et PNJ sur socle-tambour) peuplent
désormais le plateau 3D et tout le monde les adore. À côté d'elles, les
bâtiments actuels sont tes peintures v2 : très belles, mais cadrées de
FACE comme des façades plates — alors que la caméra du jeu les regarde
de trois quarts et en plongée. Résultat : les personnages ont du volume,
les bâtiments ont l'air de décors de théâtre.

Mission v4.5 : repeindre les 10 bâtiments comme des **maquettes de
village** vues de trois quarts, dans le style exact de tes figurines.

## 2. Format de livraison (les leçons des lots précédents)

- **PNG 1024×1024 à fond 100 % transparent, UNE seule vue par
  bâtiment.** PAS de GLB (leçon apprise), pas de multi-vues : les
  bâtiments ne tournent pas.
- **Cadrage « maquette » : trois quarts AVANT-GAUCHE, légère plongée
  (~30°)** — comme si tu photographiais une maquette posée sur une
  table, depuis la position de la caméra du jeu.
- **Lumière venant du HAUT-GAUCHE** (c'est le soleil de la scène 3D),
  ombres douces cuites dans la peinture, JAMAIS d'ombre portée qui
  déborde sur le fond transparent (elle jurerait avec le sol du jeu —
  le moteur pose déjà sa propre ombre).
- **Assise intégrée** : chaque bâtiment repose sur une petite langue de
  terrain peinte (pavés, herbe, éclaboussure de mousse…) qui fait
  partie de l'image. PAS de socle-tambour : il est réservé aux
  personnages.
- Le bâtiment occupe toute la hauteur de l'image (l'échelle en jeu est
  gérée par le moteur). ≤ 400 Ko par fichier.
- Style : la même gouache chaude que tes figurines v4.3/v4.4 — coups de
  pinceau visibles, dégradés chauds, palette du jeu (violets nuit
  #1a1230-#342a58, or #e0b04a, ivoire #f4ecd8).

## 3. Les 10 bâtiments (mêmes noms de fichiers = intégration automatique)

| Fichier | Bâtiment | Signatures à CONSERVER (de tes peintures v2) |
|---|---|---|
| `batiment-chateau.png` | Le château du Trésor | tours violettes pointues, drapeaux, porte dorée |
| `batiment-tour-mage.png` | La tour du mage | toit conique étoilé, fenêtres lumineuses |
| `batiment-boutique.png` | L'échoppe de Gérard | auvent rayé violet/blanc, étal garni |
| `batiment-taverne.png` | La taverne | colombages, enseigne suspendue, cheminée fumante |
| `batiment-bibliotheque.png` | La grande bibliothèque | vitraux, livres visibles, escalier |
| `batiment-pont.png` | Le pont du départ | arches de pierre, mousse, lanternes |
| `batiment-portail.png` | Le portail du Trou Noir | anneau de pierre, spirale violette au centre |
| `batiment-fontaine.png` | La fontaine aux vœux | vasques étagées, eau turquoise, pièces au fond |
| `batiment-etoile.png` | Le sanctuaire de l'étoile | étoile d'or rayonnante, colonnes |
| `batiment-champignon.png` | La maison champignon | chapeau ROUGE À POIS, porte ronde, fenêtres rondes |

## 4. Cohérence d'ensemble

- Les 10 bâtiments doivent avoir l'air de sortir de la MÊME boîte de
  jeu : même angle de vue, même lumière, même niveau de détail.
- Échelle relative respectée : le château est le monument le plus
  imposant, la maison champignon la plus menue.
- Un personnage posé devant (tes figurines font ≈ 2 têtes de haut pour
  la porte) doit sembler à l'échelle.

## 5. Livraison et validation

ZIP unique : les 10 PNG + une planche de comparaison par bâtiment
(ta peinture v2 à côté de la nouvelle maquette) + `INVENTAIRE.md`.
Le procédé ayant fait ses preuves sur les figurines, tu peux livrer le
lot complet d'un coup. Critère d'acceptation : posée à côté d'une
figurine v4.4, la maquette semble appartenir au même monde — même
lumière, même gouache, même chaleur.

## 6. Pour information : ce que le jeu en fera

Intégration automatique (mêmes noms de fichiers). Les bâtiments restent
PLEINEMENT OPAQUES en jeu ; ils ne s'estompent que l'espace d'un
instant, quand l'un d'eux se glisse entre la caméra et le héros qui
joue — ce comportement est déjà en place.
