# Le Donjon du Savoir — Plan de la version 2 « full 3D immersive »

> Document de conception. La **v1** (actuelle) est un plateau 2.5D : cases peintes,
> figurines 3D pré-rendues, saynètes animées à l'arrivée sur une case et pion qui
> marche le long du chemin. La **v2** vise une vraie scène 3D temps réel, façon
> Mario Party, avec caméra qui suit le joueur et animations par case.
>
> Objectif : garder TOUS les principes du cahier (hors-ligne, zéro dépendance
> réseau, zéro chronomètre, contenu vérifié, familial, 100 % original) tout en
> passant d'un plateau vu de dessus à une scène 3D navigable.

---

## 1. Ce qui est déjà livré en v1 (socle de l'immersion)

- **Figurines 3D** des héros et **bâtiments isométriques** posés sur le plateau.
- **Saynètes 2.5D** à l'arrivée sur les cases marquantes (boutique, marchand
  d'étoiles, Trou Noir, gambit, événement, insolite, expression) : fond du
  donjon + bâtiment + PNJ + héros qui entre en scène (`js/scene.js`).
- **Pion qui marche** case par case le long du chemin (`walkPion`, `js/board.js`).
- **Réglage « Vue immersive »** (activable/désactivable) + respect de
  « mouvements réduits » et de la préférence système.

La v2 ne repart pas de zéro : elle réutilise ce vocabulaire (mêmes cases, mêmes
héros, mêmes bâtiments, même moteur de règles) mais remplace le **rendu** du
plateau par une scène 3D.

---

## 2. Vision v2

1. **Plateau 3D** : le chemin serpentin devient un ruban 3D posé dans un décor
   de donjon (sol, murs, reliefs), avec les bâtiments en volume aux abords.
2. **Caméra qui suit le joueur** : au lancer de dé, la caméra glisse derrière le
   pion actif et le suit pendant qu'il avance de case en case ; petit
   dézoom/pano à l'arrivée.
3. **Mini-carte** (vue intégrale) en incrustation dans un coin, pour garder la
   vision d'ensemble du plateau — comme demandé.
4. **Animations par case** : en arrivant, une petite mise en scène 3D jouée sur
   place (ex. boutique : l'échoppe s'ouvre, le marchand salue, le héros se place
   devant le comptoir ; Trou Noir : un portail s'ouvre et aspire la lumière).
5. **Repli 2D garanti** : la vue 2.5D actuelle reste disponible (réglage /
   appareils modestes / accessibilité), jamais supprimée.

---

## 3. Contraintes non négociables (rappel cahier)

- **Hors-ligne total** : aucun asset ni script chargé depuis le réseau en jeu.
  Le fichier unique doit continuer d'exister (tout inliné).
- **Zéro dépendance réseau** : une éventuelle bibliothèque 3D doit être
  **embarquée** (inlinée), jamais servie par un CDN.
- **Mobile d'abord**, pass-and-play 1→20 joueurs, gros boutons, zéro chrono.
- **Accessibilité** : la 3D est un PLUS, pas un prérequis. Mode réduit, police
  lisible, daltonien, et **repli 2D** doivent rester pleinement jouables.
- **Budget de poids** : le fichier unique est déjà ~4 Mo. La 3D impose de
  surveiller le poids (modèles + textures) — voir §7.

---

## 4. Choix technique du moteur de rendu

Trois pistes, de la plus légère à la plus riche :

### Piste A — CSS 3D (`transform-style: preserve-3d`)  ★ recommandé pour un 1er jet
- **Idée** : garder le DOM, mais incliner le plateau en perspective (rotateX),
  poser les cases et les figurines comme des plans 3D (billboards), et bouger
  une « caméra » = un conteneur transformé.
- **Pour** : zéro dépendance, continuité avec le code actuel, repli trivial,
  poids quasi nul, marche partout.
- **Contre** : pas de vraie profondeur/occlusion ni d'éclairage ; « faux 3D »
  (2.5D poussé). Suffisant pour « caméra qui suit + plateau incliné + décor en
  couches parallax ».

### Piste B — WebGL via une micro-bibliothèque embarquée (three.js inliné)
- **Idée** : trois.js (ou un moteur plus petit) **inliné** dans le bundle ;
  scène 3D réelle (meshes, caméra, lumières), modèles glTF des héros/bâtiments.
- **Pour** : vraie 3D (profondeur, éclairage, ombres), caméra cinématique,
  animations de modèles.
- **Contre** : +150–600 Ko de moteur inliné, modèles glTF à produire et
  optimiser, complexité, gestion mémoire GPU sur mobile d'entrée de gamme.

### Piste C — Sprites 3D pré-rendus + moteur 2.5D « maison »
- **Idée** : pas de vrai moteur 3D ; on pré-rend (via ChatGPT/gen2/Sol) des
  **tournettes** (8–16 angles) de chaque héros/bâtiment, et on choisit l'angle
  selon la caméra. Le plateau reste un ruban 2.5D incliné.
- **Pour** : rendu très soigné (pré-calculé), léger à l'exécution, pas de GPU 3D.
- **Contre** : beaucoup d'images (poids), angles discrets (pas de rotation
  continue fluide), pipeline d'assets lourd.

**Recommandation** : commencer par **A** (CSS 3D) pour la caméra-qui-suit + le
plateau incliné + la mini-carte (gros gain visuel, risque faible, repli facile),
et n'envisager **B** que si l'on veut vraiment des scènes de case en 3D pleine.
**C** est un bon compromis pour les seules saynètes de case si B est trop lourd.

---

## 5. Architecture logicielle visée

Le moteur de **règles** reste inchangé (`state.js`, `game.js`) : il ne connaît
que des cases, des pions et des positions. On isole le **rendu** derrière une
interface pour brancher 2D ou 3D sans toucher aux règles.

```
Règles (state/game)  ──►  Renderer (interface)
                             ├── Renderer2D  (actuel : board.js)
                             └── Renderer3D  (nouveau : board3d.js)
                                   ├── scène / caméra / lumières
                                   ├── ruban du plateau (chemin)
                                   ├── pions (modèles + walk le long du chemin)
                                   ├── bâtiments / props par case
                                   ├── mini-carte (vue 2D du plateau)
                                   └── saynètes de case (jouées in-scene)
```

- **Interface Renderer** : `build(layout)`, `updatePions(pions, actif)`,
  `walk(pionId, path)`, `focus(pionId)`, `playCaseScene(type, pionId)`,
  `setStar(pos)`. La v1 implémente déjà `updatePions` / `walkPion` : on la
  formalise en interface et on ajoute `Renderer3D`.
- **Choix du renderer** au lancement selon le réglage « Vue immersive » +
  capacité de l'appareil (test WebGL) → repli 2D automatique si indisponible.
- **Caméra** : un « rig » qui interpole sa cible entre les cases pendant le
  `walk`, avec easing ; à l'arrêt, léger recul + regard sur la case.

---

## 6. Pipeline d'assets 3D (ChatGPT 5.x / gen2 / Sol)

On produit des assets **originaux** (jamais de personnage sous licence).

- **Héros** (11) : modèle 3D stylisé « figurine » ou tournette pré-rendue
  (16 angles). Format cible : glTF/GLB compressé (Draco) pour la piste B, ou
  sprite-sheet d'angles pour la piste C.
- **Bâtiments** (boutique, taverne, portail, fontaine, bibliothèque, château,
  étoile, champignon, tour, pont) : modèles low-poly ou pré-rendus isométriques
  haute qualité (déjà partiellement en v1 en 2.5D).
- **Cases / props** : socles de case, décors (torches, cristaux…), déjà en v1.
- **Décor de donjon** : sol/murs modulaires pour habiller la scène 3D.

**À demander aux outils** (exemples de consignes) :
- « Figurine 3D stylisée, style jouet de plateau, ~2000 tris, textures 512²,
  vue neutre + 16 tournettes à 22,5°, fond transparent, cohérente avec la charte
  (couleurs chaudes de donnjon, contours nets). » (par héros)
- « Bâtiment low-poly isométrique, échelle jouet, base carrée, export GLB Draco,
  < 150 Ko textures comprises. » (par bâtiment)
- Toujours : **100 % original**, aucune marque/personnage existant, cohérent
  avec les figurines v1.

**Optimisation obligatoire** : compression Draco (géométrie), textures KTX2/Basis
ou WebP, atlas de textures, budgets stricts (voir §7).

---

## 7. Budget de poids & performance

- Fichier unique : viser **< 8–10 Mo** tout compris (v1 ≈ 4 Mo). Au-delà,
  proposer une **variante « légère »** (2D) et une **variante « 3D »** séparées,
  plutôt qu'un seul fichier trop lourd.
- Moteur (piste B) : préférer un build minimal de three.js (tree-shaké) inliné.
- Modèles : Draco + textures compressées ; un budget par catégorie
  (héros ≤ 150 Ko, bâtiment ≤ 150 Ko, décor mutualisé).
- **Détection de capacité** : si WebGL absent / GPU faible / peu de mémoire →
  repli 2D automatique et silencieux.
- **Mouvements réduits** : caméra fixe + coupures d'animations (déjà géré côté
  réglages) ; la 3D doit respecter ce mode.

---

## 8. Feuille de route par phases

1. **Phase 0 — Interface Renderer** : extraire une interface de rendu, faire de
   l'actuel `board.js` le `Renderer2D`. (Refactor sans changement visible.)
2. **Phase 1 — Caméra 2.5D (CSS 3D)** : plateau incliné en perspective, caméra
   qui suit le pion pendant le `walk`, mini-carte en incrustation. Repli plat au
   réglage. (Gros gain, risque faible.)
3. **Phase 2 — Saynètes de case « en scène »** : rejouer les saynètes v1
   directement dans la vue 3D (le héros se place devant le bâtiment concerné).
4. **Phase 3 — Renderer3D (WebGL)** *(optionnel/ambitieux)* : vraie scène
   three.js inlinée, modèles glTF, éclairage, ombres douces. Activé seulement si
   l'appareil suit ; sinon Phase 1/2.
5. **Phase 4 — Polissage** : transitions caméra, effets par case, réglages de
   qualité (auto/économe/riche), tests de performance mobile.

Chaque phase est **livrable indépendamment** et **réversible** (repli 2D).

---

## 9. Tests & garanties

- Conserver les smokes headless existants (ils pilotent l'UI, pas le rendu) et
  les faire tourner en **mode repli 2D** pour rester déterministes.
- Ajouter des tests de **détection de capacité** (WebGL présent/absent →
  bon renderer choisi) et de **non-régression des règles**.
- Vérifier systématiquement : hors-ligne, poids du bundle, mode réduit,
  accessibilité, et que la partie reste jouable sans la 3D.

---

## 10. Décisions à trancher avec le joueur

- Un **seul fichier** 3D (plus lourd) ou **deux variantes** (légère 2D / riche 3D) ?
- Piste **A (CSS 3D, rapide)** d'abord, ou viser directement **B (WebGL)** ?
- Style visuel 3D : « figurines jouet » (comme v1) confirmé, ou plus réaliste ?
- Priorité : **caméra qui suit** (Phase 1) avant les **scènes de case en 3D**
  (Phase 2/3) — à confirmer.
