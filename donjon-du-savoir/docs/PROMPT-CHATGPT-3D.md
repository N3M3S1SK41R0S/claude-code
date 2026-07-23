# Prompt intégral à coller dans ChatGPT 5.6 / Sol / gen 2

> Copiez tout le bloc ci-dessous tel quel. Il est auto-suffisant. Le détail
> complet (specs, budgets) est dans `docs/MISSION-EXTERNE-3D.md` du dépôt.

---

Tu interviens **comme administrateur (droits complets)** sur le projet
**« Le Donjon du Savoir »**, un jeu de plateau de culture générale hors-ligne
(façon Mario Party), et tu as autorité pour proposer et livrer des changements
via **pull requests**.

**Dépôt :** GitHub `N3M3S1SK41R0S/claude-code` · **branche**
`claude/french-quiz-pwa-game-6mfzcw` · **dossier du jeu** `donjon-du-savoir/`.
Lis d'abord `donjon-du-savoir/docs/MISSION-EXTERNE-3D.md`,
`docs/PLAN-3D-V2.md` et `docs/BRIEF-VISUELS*.md`.

**Ta mission :** rendre l'expérience **3D complète, fluide et magnifique**, et
doter le jeu d'une **vraie voix d'animateur pleine d'humour** (esprit maître de
jeu télé / Burger Quiz) qui **lit les questions puis les anecdotes** — le tout
en respectant des contraintes non négociables.

**CONTRAINTES ABSOLUES (à ne jamais violer) :**
1. **Hors-ligne total, zéro réseau à l'exécution.** Aucun asset/script depuis un
   CDN. Tout est **local** et **inlinable** dans le fichier HTML unique.
2. Toute bibliothèque est **vendorée** (three.js **r128** l'est déjà dans
   `vendor/three.min.js`, MIT ; réutilise-la, ne charge rien d'externe).
3. **100 % ORIGINAL** : aucun personnage/marque/musique/voix sous licence, aucune
   imitation d'une personne réelle. Voix et modèles **créés pour le jeu**.
4. **Familial, en français**, humour bienveillant. **Zéro chronomètre**, **aucune
   élimination** de joueur.
5. **Repli 2D obligatoire** : si WebGL est absent, l'appareil modeste, le réglage
   « Vue immersive » décoché ou « mouvements réduits » actif → le plateau 2D doit
   rester **pleinement jouable**. Ne casse jamais ce repli.
6. **Budget de poids :** le fichier unique fait ~6 Mo ; cible **< 10 Mo** tout
   compris (sinon prévois une **variante « riche »** séparée). Optimise tout
   (Draco pour la géométrie, WebP/KTX2 pour les textures).
7. **Commentaires de code en français.** Respecte le style existant.

**ÉTAT ACTUEL (déjà en place) :**
- Plateau **3D** (`js/board3d.js`, three.js) : chemin serpentin en ruban, cases =
  tuiles teintées, héros = **sprites** posés dessus, bâtiments/décors en sprites
  debout, **mini-carte** en incrustation, **caméra** qui cadre tout le plateau au
  repos et **suit le pion** pendant un déplacement, toile de fond peinte par thème.
- **Saynètes 2.5D** à l'arrivée sur les cases marquantes (`js/scene.js`).
- **93 assets 2D** dans `assets/` : `hero-*.png` (11), `pnj-*.png` (15),
  `batiment-*.png` (10), `case-*.png` (12), `objet-*.png` (14), `decor-*.png` (12),
  `fond-*.webp` (5). Réutilise-les comme base de style.
- **Voix** : Web Speech API (`js/tts.js`, fonction `sayHost`) lit déjà question
  puis anecdote quand « Héraut vocal » est activé — à **enrichir** (voix plus
  caractérielle, plus drôle).

**LIVRABLES ATTENDUS :**
- **A. Visuel 3D magnifique :** vrais **modèles 3D animés** (glTF/GLB + Draco) des
  **11 héros** (idle/marche/joie/déception), des **10 bâtiments** et **12 socles
  de case**, décor de donjon modulaire, éclairage soigné + **ombres douces**,
  skybox par thème, petites mises en scène 3D par case (échoppe qui s'ouvre,
  portail du Trou Noir…). Style « figurine de plateau, couleurs chaudes, contours
  nets », cohérent avec les `hero-*.png` existants.
- **B. Voix d'animateur :** au choix, du plus léger au plus riche —
  (B3) réglages/répliques pour la synthèse navigateur (immédiat) ;
  (B2) **jeu compact de clips audio** (30–60 accroches, WebM/Opus, quelques
  centaines de Ko) déposés dans `assets/voix/` + manifeste `data/voix.json` ;
  (B1) éventuelle **voix neurale on-device** (WASM, entièrement locale) si tu
  assumes une variante « riche » séparée. La voix **lit les questions puis les
  anecdotes**, avec un ton d'animateur **drôle et clair**.

**RÈGLES D'INTÉGRATION (impératif technique) :**
- Dépose : modèles/textures 3D dans `assets/3d/`, audio dans `assets/voix/`,
  images 2D dans `assets/`.
- Le bundler `tools/build-standalone.mjs` **inline** en data-URI tout
  `assets/….(png|webp)` référencé **par une chaîne LITTÉRALE** dans le code →
  **jamais de chemin d'asset construit dynamiquement**, sinon l'inlining échoue.
- Ajoute chaque nouveau fichier à la liste `SHELL` de `sw.js` et **incrémente
  `VERSION`**. Charge glTF/Draco via des loaders **vendorés** (pas de CDN).

**CRITÈRES D'ACCEPTATION :**
- Fonctionne **hors-ligne** (mode avion) et en **`file://`** (fichier unique),
  **sans aucune requête réseau**.
- **Repli 2D** intact ; accessibilité et « mouvements réduits » respectés.
- Assets et voix **100 % originaux** ; aucune IP tierce, aucune imitation.
- Les **9 tests headless** existants (`tools/smoke*.mjs`) passent.
- Fichier unique **< ~10 Mo** (ou variante « riche » assumée à part) ; **fluide**
  sur mobile milieu de gamme (viser 30 fps) ou repli propre.
- La voix **lit questions puis anecdotes**, ton d'animateur **drôle** et
  compréhensible, réglable (bouton « Héraut vocal », vitesse).

**PRIORITÉS :** 1) voix d'animateur (B2/B3) ; 2) héros en modèles 3D animés ;
3) bâtiments/cases 3D + éclairage/ombres ; 4) effets par case + skybox.

Livre par **petits lots vérifiables** : une **pull request** par lot, avec un
**montage de contrôle** (PNG) et un court README (liste, dimensions, poids).
Ne casse jamais le repli 2D ni l'usage hors-ligne. En cas de doute sur une
contrainte, choisis l'option qui préserve **hors-ligne + poids + repli 2D**.
