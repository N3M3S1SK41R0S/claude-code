# MISSION GEN 2 — v3 « Rendu 3D à tout niveau » du Donjon du Savoir
*(mission intégrale et autonome — fait suite au lot v2 « Grand Cabaret »,
livré et intégré : sols, ciels, médailles, tenues, cadre souvenir)*

## 1. Contexte et objectif

Le plateau 3D du jeu est un village de donjon : sol dallé peint (ton lot
v2), dôme de ciel 360° (ton lot v2), bâtiments GLB translucides, socles
de cases GLB, 11 héros GLB animés (idle / walk / joy / deception),
braseros à flammes, poussière dorée, caméra qui zoome sur le joueur.

Objectif de cette mission : élever le RENDU 3D à tous les niveaux —
modèles plus vivants, matières plus riches, effets plus jolis — sans
jamais sacrifier la fluidité (le jeu tourne aussi sur tablettes).

## 2. Contraintes techniques 3D (non négociables)

- **Format** : glTF 2.0 binaire (.glb), compression Draco bienvenue.
- **Axes** : Y vers le haut ; **pivot au niveau du sol**, centré.
- **Échelle** : 1 unité = 1 « mètre » du plateau. Une case fait ~1,4 u
  de rayon ; un héros fait ~2,2 u de haut. Respecter ces proportions.
- **Budget par pièce** : ≤ 3 000 triangles, texture unique 512×512
  embarquée (pas de fichiers externes), ≤ 60 Ko après Draco.
- **Budget total du lot : < 2,5 Mo.**
- **Style** : low-poly peint, continuité exacte avec les GLB existants
  (formes rondes, couleurs franches, palette violet nuit #1a1230-#342a58
  + or #e0b04a). Aucun photoréalisme, aucun contenu sous licence,
  familial à 100 %.
- **Noms de fichiers EXACTS** ci-dessous (intégration automatique).

## 3. LOT E — Le village s'anime (priorité 1)

Décors GLB posés autour du plateau. Si un objet a une partie mobile,
la séparer en un nœud nommé `anim` (le jeu le fera tourner/flotter).

| Fichier | Contenu |
|---|---|
| `assets/3d/decors/lampadaire-lucioles.glb` | lampadaire tordu, cage à lucioles (nœud `anim` : la cage) |
| `assets/3d/decors/banniere-donjon.glb` | mât + bannière or/violet (nœud `anim` : la bannière) |
| `assets/3d/decors/arbre-rond.glb` | arbre boule feuillu, tronc trapu |
| `assets/3d/decors/puits.glb` | puits de pierre, seau suspendu (nœud `anim` : le seau) |
| `assets/3d/decors/gargouille-baillante.glb` | gargouille assise qui bâille (bouche ouverte figée, drôle) |
| `assets/3d/decors/moulin-a-vent.glb` | petit moulin (nœud `anim` : les ailes) |

## 4. LOT F — Matières des socles et modules (priorité 2)

Retexture des 12 socles de cases et 4 modules existants : mêmes
géométries (je te renvoie les GLB sur demande) OU nouvelles versions
complètes aux mêmes noms, avec des matières plus riches — pierre
biseautée, liseré doré émissif discret par type de case (question bleu
#4a6fb5, chance vert #3ec27a, coup dur rouge #b54a4a, gambit cyan
#3eb8c2, trou noir violet profond #181026 avec anneau émissif…).

`assets/3d/tiles/socle-question.glb` … (les 12 noms existants) et
`assets/3d/dungeon/module-mur.glb`, `module-arche.glb`,
`module-colonne.glb`, `module-brasero.glb`.

## 5. LOT G — Feuilles de sprites d'effets (priorité 2)

PNG transparents 512×512 en grille 4×4 (16 images d'animation), style
peint :

| Fichier | Contenu |
|---|---|
| `assets/fx/etincelles.png` | gerbe d'étincelles dorées (bonne réponse) |
| `assets/fx/fumee-douce.png` | volute de fumée violette (téléportation, Trou Noir) |
| `assets/fx/confettis.png` | poignée de confettis multicolores (victoire, étoile) |
| `assets/fx/halo-etoile.png` | halo étoilé pulsant (achat d'étoile) |
| `assets/fx/plouf-piece.png` | pièces qui sautent (gain de pièces) |

## 6. LOT H — Animations de héros supplémentaires (priorité 3)

Sur les 11 GLB de héros existants (mêmes fichiers, clips ajoutés) :
- `salute` : petit salut au début du tour (~1,5 s, boucle non)
- `dance` : danse de victoire simple (~2 s, bouclable)
- `think` : réflexion, main au menton (~2 s, bouclable, pendant les questions)
Ne PAS toucher aux clips existants (idle, walk, joy, deception).

## 7. LOT I — 3 PNJ en GLB animé (priorité 3)

Comme les héros (idle + une animation signature chacun) :

| Fichier | PNJ | Animation signature |
|---|---|---|
| `assets/3d/pnj/gerard.glb` | Gérard le Squelette Poli (boutique) | s'incline poliment |
| `assets/3d/pnj/merlinouche.glb` | Merlinouche l'Étourdi | rate un sort (pouf de fumée mimé) |
| `assets/3d/pnj/zebulon.glb` | Zébulon le Génie Distrait | flotte et perd le fil (haussement d'épaules) |

## 8. LOT J — Remparts modulaires (priorité 4)

`assets/3d/dungeon/rempart-droit.glb`, `rempart-angle.glb`,
`rempart-porte.glb` : murets crénelés bas (~1,2 u de haut) pour border
le plateau sans jamais cacher les cases (ils seront translucides comme
les bâtiments).

## 9. Checklist qualité avant livraison

- [ ] Chaque GLB s'ouvre dans un viewer glTF standard sans erreur.
- [ ] Pivot au sol, échelle vérifiée contre un héros (~2,2 u).
- [ ] Textures embarquées, aucun chemin externe.
- [ ] Budgets : ≤ 3 000 tris et ≤ 60 Ko par pièce, < 2,5 Mo au total.
- [ ] Nœuds `anim` nommés exactement `anim` là où indiqué.
- [ ] Clips d'animation nommés exactement `salute`, `dance`, `think`,
      `idle` (PNJ) — en minuscules.
- [ ] Style raccord avec les GLB v1 (héros/bâtiments/socles).

## 10. Livraison

ZIP unique avec l'arborescence `assets/…` ci-dessus + `INVENTAIRE.md`
(une ligne par fichier). Lots séparés acceptés, priorité E > F > G >
H > I > J. Chaque pièce livrée est intégrée automatiquement ; toute
pièce manquante est ignorée sans casser le jeu.
