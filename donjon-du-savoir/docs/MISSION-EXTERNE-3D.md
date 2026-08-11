# Mission — sublimer « Le Donjon du Savoir » : visuel 3D, voix, immersion

> **Destinataires : ChatGPT 5.6 · Sol · gen 2** (et tout outil de génération
> d'assets 3D / d'images / de voix).
> **Commanditaire :** l'auteur du jeu. **Rédacteur du brief :** l'assistant de dev.
>
> Ce document est **auto-suffisant** : il donne le contexte, les accès, les
> contraintes ABSOLUES, l'état actuel du code, et la liste précise des livrables
> attendus avec leurs critères d'acceptation. Objectif : rendre l'expérience 3D
> **complète, fluide et magnifique**, doter le jeu d'une **vraie voix
> d'animateur pleine d'humour** (façon Alain Chabat / Burger Quiz) qui lit les
> questions puis les anecdotes, et élever tout le visuel.

---

## 1. Le projet en deux minutes

« Le Donjon du Savoir » est un **jeu de plateau de culture générale** (façon
Mario Party) : 1 à 20 joueurs en *pass-and-play* sur un même appareil, on avance
sur un plateau serpentin, on répond à des questions **vérifiées et sourcées**,
et après **chaque** question le « Héraut » révèle une **anecdote** avec ses
sources. Principes intangibles : **zéro chronomètre**, **personne n'est jamais
éliminé**, **familial**, **hors-ligne**.

- Technique : **HTML/CSS/JS vanilla**, **aucune dépendance réseau**, **PWA** +
  **fichier HTML unique autonome** (tout inliné, marche en `file://`).
- 3D : **three.js r128** est **déjà embarqué en local** (`vendor/three.min.js`,
  MIT) et un premier rendu 3D existe (`js/board3d.js`).

---

## 2. Accès au dépôt et aux sources

- **Dépôt GitHub :** `N3M3S1SK41R0S/claude-code`
- **Branche de travail :** `claude/french-quiz-pwa-game-6mfzcw`
- **Sous-dossier du jeu :** `donjon-du-savoir/`
- **Plans existants à lire d'abord :**
  - `donjon-du-savoir/docs/PLAN-3D-V2.md` (feuille de route 3D)
  - `donjon-du-savoir/docs/BRIEF-VISUELS.md` et `BRIEF-VISUELS-2.md` (chartes)
  - `donjon-du-savoir/docs/prompts-visuels-heros.md` (style des héros)

> L'auteur donnera l'accès en lecture/écriture (ou un fork + pull request). Pour
> proposer des changements : **ouvrir une pull request** sur la branche ci-dessus.
> Livrer les **assets binaires** (modèles, textures, audio) dans les dossiers
> indiqués au §7, avec un court README par lot.

---

## 3. Contraintes ABSOLUES (à ne jamais violer)

1. **Hors-ligne total.** Aucun asset ni script chargé depuis un réseau/CDN **en
   jeu**. Tout doit être **local** et **inlinable** dans le fichier unique.
2. **Zéro dépendance réseau à l'exécution.** Toute bibliothèque doit être
   **vendorée** (three.js l'est déjà). Pas d'`import` distant, pas de `fetch`.
3. **100 % ORIGINAL.** Interdiction absolue de reproduire un personnage, une
   marque, une musique ou une œuvre sous licence. Les héros/mascottes/décors du
   jeu sont **créés pour lui** (Flaque, Pelote, Plomberoy, Kribouille…). On peut
   *nommer* des œuvres réelles dans les questions (trivia), **jamais** les
   *reproduire* visuellement ou sonorement.
4. **Familial** et **FR**. Ton tout public, humour bienveillant.
5. **Zéro chronomètre**, **aucune élimination** (règles du cahier).
6. **Accessibilité & repli.** La 3D est un **plus** : un **repli 2D** existe et
   doit rester pleinement jouable (WebGL absent, appareil modeste, réglage
   « Vue immersive » décochable, mouvements réduits respectés).
7. **Budget de poids.** Le fichier unique est aujourd'hui **~6 Mo**. Cible :
   rester **sous ~10 Mo** tout compris. Chaque asset doit être **optimisé**
   (compression géométrie/texture, budgets stricts — voir §5/§6).
8. **Commentaires de code en français.** Style existant à respecter.

---

## 4. État actuel (ce qui existe déjà)

- **Plateau 3D** (`js/board3d.js`, WebGL/three.js) : chemin serpentin en ruban,
  cases = tuiles teintées, héros = **sprites** (billboards) posés dessus,
  bâtiments/décors d'ambiance en **sprites debout**, **mini-carte** en
  incrustation, **caméra** qui cadre tout le plateau au repos et **suit le
  pion** pendant un déplacement.
- **Saynètes 2.5D** (`js/scene.js`) à l'arrivée sur les cases marquantes
  (boutique, marchand d'étoiles, Trou Noir, gambit, événement, insolite,
  expression) : fond de donjon + bâtiment + PNJ + héros.
- **Assets 2D existants** (93 fichiers, `donjon-du-savoir/assets/`) :
  - `hero-*.png` (11 héros), `portrait-*.png`, `pnj-*.png` (15 PNJ),
  - `batiment-*.png` (10 bâtiments), `case-*.png` (12 types de cases),
  - `objet-*.png` (14 objets), `decor-*.png` (12 décors),
  - `fond-*.webp` (5 ambiances de donjon).
  Ils sont aujourd'hui utilisés **en 2D** et **en billboards 3D**.
- **Voix** (`js/tts.js`) : Web Speech API du navigateur, profil par personnage
  (pitch/rate), lit aujourd'hui les répliques du Héraut. **Insuffisant** pour un
  vrai animateur (voir §6).
- **Contenu** : ~1400 questions vérifiées (`data/questions.json`) avec, pour
  chacune, `texte`, la bonne réponse et une `anecdote` + sources.

---

## 5. Livrable A — Assets 3D & visuel « magnifique »

Faire passer le plateau des **billboards** à de **vrais volumes 3D**, ou à des
sprites pré-rendus de très haute qualité, cohérents avec le style « figurine de
plateau, couleurs chaudes de donjon, contours nets ».

### A1. Héros (11) — priorité haute
- **Modèles 3D** stylisés (glTF/GLB, Draco), ~1500–3000 tris, textures ≤ 512².
- **Animations** minimales : *idle* (respiration), *marche*, *saut de joie*,
  *déception*. (Clips courts, bouclables.)
- À défaut de modèles : **tournettes pré-rendues** (16 angles) + sprite d'anim.
- Style : reprendre `hero-*.png` et `docs/prompts-visuels-heros.md`.

### A2. Bâtiments (10) & cases (12) — priorité haute
- Bâtiments **low-poly** (échoppe, taverne, portail, fontaine, bibliothèque,
  château, tour du mage, pont, champignonnière, marchand d'étoiles). GLB Draco,
  ≤ 150 Ko chacun textures comprises.
- **Socles de case** 3D par type (12), réutilisant les couleurs/emoji existants.

### A3. Décor & ambiance — priorité moyenne
- Sol/murs **modulaires** de donjon pour habiller la scène, éléments de décor
  (torches animées, cristaux, statues…), skybox/toile de fond par thème
  (5 ambiances : donjon, crypte, tour, labyrinthe, catacombes).
- Éclairage soigné (clé + contre-jour), **ombres douces**, brume d'ambiance.

### A4. Effets par case — priorité moyenne
- Petites mises en scène 3D à l'arrivée (ex. boutique : l'échoppe s'ouvre, le
  marchand salue, le héros se place au comptoir ; Trou Noir : portail qui
  s'ouvre). Fournir modèles + specs d'animation ; l'intégration se fera côté code.

**Format & budget** : glTF/GLB + **Draco** (géométrie), textures **WebP/KTX2**,
atlas quand possible. Chaque lot livré avec un **manifeste** (liste, dimensions,
poids) et une **vue de contrôle** (montage PNG).

---

## 6. Livrable B — La VOIX de l'animateur (façon Alain Chabat)

**Attendu de l'auteur :** une **vraie voix d'animateur, pleine d'humour**, qui
**lit les questions puis les anecdotes**, avec le punch d'un maître de jeu de
télé (esprit Burger Quiz), **sans imiter** une personne réelle (voix
**originale**, pas de clonage de célébrité).

Trois options, à combiner selon le budget de poids :

### Option B1 — Voix neurale embarquée (idéal qualité, lourd) 
- Fournir un **modèle TTS français on-device** (ex. type Piper/VITS) + runtime
  **WASM**, entièrement **local** (aucun réseau). Voix **originale**, timbre
  chaleureux et joueur, débit vif.
- Contrainte : **poids** (souvent 10–30 Mo). Si retenu, prévoir une **variante
  « riche »** séparée du fichier léger (voir PLAN-3D-V2 §7).

### Option B2 — « Stingers » + habillage (léger, recommandé en 1er)
- Produire un **jeu compact d'accroches audio** dites par la voix d'animateur
  (30–60 clips, WebM/Opus, quelques centaines de Ko au total) : intros de
  question (« Attention, ça va chauffer ! »), réactions (bonne/mauvaise
  réponse), lancements d'anecdote (« Et l'anecdote qui tue… »), transitions.
- Ces stingers **encadrent** la lecture du texte (question/anecdote) faite par la
  synthèse du navigateur, réglée pour un **débit d'animateur** (voir B3).
- Livrer aussi les **scripts** (variantes humoristiques) au format JSON.

### Option B3 — Réglage fin de la synthèse navigateur (immédiat, gratuit)
- Recommandations SSML/paramètres (voix FR, pitch, rate, pauses) pour donner du
  **relief** et de l'**humour** à la lecture des questions et anecdotes via
  l'API Web Speech (déjà en place). Fournir une **table de réglages** et des
  **répliques d'animateur** (avant/après chaque question et anecdote).

> **Intégration côté code (déjà prévue) :** le jeu peut **lire à voix haute le
> texte de la question puis l'anecdote** quand le « Héraut vocal » est activé ;
> il suffit de brancher la voix d'animateur (B1/B2) ou d'affiner B3. Fournir les
> fichiers audio dans `assets/voix/` + un manifeste `data/voix.json` (id →
> fichier + texte).

---

## 7. Intégration technique (où déposer, comment ça s'inline)

- **Modèles/textures 3D :** `donjon-du-savoir/assets/3d/` (glb, ktx2/webp).
  L'intégrateur les chargera via three.js (GLTFLoader + DRACOLoader **vendorés**).
- **Audio voix :** `donjon-du-savoir/assets/voix/` + `data/voix.json`.
- **Images 2D (billboards, décors) :** `donjon-du-savoir/assets/` (png/webp).
- **Le fichier unique** est produit par `tools/build-standalone.mjs`, qui
  **inline** en data-URI tout `assets/....(png|webp)` référencé **par une chaîne
  littérale** dans le code. ⚠️ Donc : **chemins d'assets = chaînes littérales**
  (pas de template dynamique), sinon l'inlining échoue.
- **Service worker** `sw.js` : ajouter chaque nouveau fichier à la liste `SHELL`
  (offline PWA) et **incrémenter `VERSION`**.
- **Poids :** viser des lots compressés ; signaler tout dépassement du budget.

---

## 8. Critères d'acceptation

- ✅ Tout fonctionne **hors-ligne** (mode avion) et en **`file://`** (fichier
  unique), **sans aucune requête réseau**.
- ✅ **Repli 2D** intact si WebGL absent / « Vue immersive » décochée.
- ✅ Aucune reproduction d'IP tierce ; assets et voix **originaux**.
- ✅ Les **9 suites de tests headless** existantes passent (`tools/smoke*.mjs`).
- ✅ Poids du fichier unique **< ~10 Mo** (ou variante « riche » assumée à part).
- ✅ Sur mobile milieu de gamme : **fluide** (30 fps visés) ou repli propre.
- ✅ La voix **lit les questions puis les anecdotes**, avec un ton d'animateur
  **drôle** et **compréhensible**, réglable (bouton « Héraut vocal », vitesse).

---

## 9. À NE PAS faire

- ❌ Charger three.js, une police, une voix ou une image depuis un **CDN**.
- ❌ Reproduire Mario/Sonic/Pikachu/etc. ou **imiter** la voix d'une célébrité.
- ❌ Introduire un **chronomètre** ou une **élimination**.
- ❌ Alourdir le fichier au point de casser l'usage mobile sans variante légère.
- ❌ Casser le **repli 2D** ou l'accessibilité.

---

## 10. Ordre de priorité conseillé

1. **Voix d'animateur** (B2 ou B3) — le plus fort ressenti immédiat.
2. **Héros en vrais modèles 3D animés** (A1) — cœur de l'immersion.
3. **Bâtiments/cases 3D** (A2) + éclairage/ombres (A3).
4. **Effets par case** (A4) + skybox par thème.

Chaque lot est **livrable indépendamment** et **réversible** (repli garanti).
Merci de livrer par **petits lots vérifiables** (une PR par lot + montage de
contrôle), en respectant les contraintes du §3.
