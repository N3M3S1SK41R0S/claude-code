# MISSION GEN 2 — v5 « Les Cinq Nouveaux Mondes »
*(la plus grande mission depuis le début : CINQ univers complets, dans la
gouache des figurines v4.3/v4.4 et des maquettes v4.5 — le procédé qui a
fait ses preuves ne change pas d'un poil)*

## 0. Le contexte

Le jeu vient de gagner cinq nouveaux plateaux jouables, avec des
mécaniques inédites : tourbillons qui téléportent, carrefours à choix,
Grand Retournement du sens de jeu, glissades sur la glace. Ils tournent
déjà avec des visuels provisoires (sols procéduraux, ciels en dégradé).
Ta mission : les habiller ENTIÈREMENT, chacun avec sa personnalité.

## 1. Les cinq mondes (personnalité à respecter)

| Thème (id) | Univers | Ambiance |
|---|---|---|
| `cuisine` | **La Cuisine Géante** — un plateau posé sur la table du petit-déjeuner, vu par des héros hauts comme un pot de confiture | chaleureux, beurré, gourmand |
| `plage` | **La Plage des Pirates** — criques, épaves, tourbillons marins | ensoleillé, salin, aventureux |
| `grenier` | **Le Grenier Hanté** — jouets qui s'animent la nuit, malles ouvertes, poussière d'or | pénombre douce, mystère rigolo |
| `foraine` | **La Fête Foraine** — manèges, guirlandes, barbe à papa | néons chauds, joie criarde maîtrisée |
| `banquise` | **La Banquise Rigolote** — glace turquoise, igloos, aurores boréales | froid lumineux, drôlerie de pingouin |

Palette générale du jeu toujours en vigueur (violets nuit #1a1230-#342a58,
or #e0b04a, ivoire #f4ecd8) : chaque monde a SA couleur dominante mais
reste de la même boîte de jeu.

## 2. Lot A — Les décors de scène (5 × 3 fichiers)

Pour CHAQUE thème :
- `fond-<id>.webp` — le fond peint du plateau 2D (paysage horizontal,
  ~1600×1120, comme les fonds existants type `fond-donjon.webp`).
- `ciel-<id>.webp` — un ciel ÉQUIRECTANGULAIRE 2:1 (2048×1024) pour la
  sphère céleste 3D : cuisine = plafond de cuisine flou et chaud ;
  plage = grand ciel marin ; grenier = charpente sombre étoilée de
  poussière ; foraine = nuit de fête aux lampions ; banquise = aurores
  boréales.
- `sol-<id>.webp` — une TEXTURE de sol carrée RÉPÉTABLE (1024×1024,
  bords raccordés) : nappe à carreaux (cuisine), sable mouillé et
  coquillages (plage), parquet poussiéreux (grenier), pavés de fête et
  confettis (foraine), glace craquelée (banquise).

## 3. Lot B — Les bâtiments-maquettes (5 × 4 fichiers)

Même cahier que la mission v4.5 (trois quarts AVANT-GAUCHE, plongée
~30°, lumière HAUT-GAUCHE, assise de terrain intégrée, PNG 1024
transparent, ≤ 400 Ko) :

- **cuisine** : `bat-cuisine-grille-pain.png` (maison grille-pain),
  `bat-cuisine-theiere.png` (fontaine-théière fumante),
  `bat-cuisine-gateau.png` (château en pièce montée),
  `bat-cuisine-casserole.png` (taverne-casserole).
- **plage** : `bat-plage-epave.png` (épave-taverne),
  `bat-plage-phare.png` (phare rayé), `bat-plage-cabane.png`
  (cabane de plage sur pilotis), `bat-plage-coquillage.png`
  (palais-coquillage).
- **grenier** : `bat-grenier-malle.png` (malle aux trésors ouverte),
  `bat-grenier-cheval.png` (cheval à bascule géant),
  `bat-grenier-livres.png` (tour de livres empilés),
  `bat-grenier-lanterne.png` (lanterne magique).
- **foraine** : `bat-foraine-grande-roue.png` (grande roue),
  `bat-foraine-chapiteau.png` (chapiteau rayé),
  `bat-foraine-stand.png` (stand de tir à la peluche),
  `bat-foraine-barbe-papa.png` (kiosque à barbe à papa).
- **banquise** : `bat-banquise-igloo.png` (grand igloo),
  `bat-banquise-toboggan.png` (toboggan de glace),
  `bat-banquise-phoque.png` (rocher-phoque),
  `bat-banquise-sapin.png` (sapin givré étoilé).

## 4. Lot C — Les PNJ des nouveaux mondes (10 fichiers)

Même format que le lot v4.4 : figurine en pied sur SOCLE-TAMBOUR
bois/bronze, une seule vue de face, PNG 1024 transparent. Deux par
monde, 100 % originaux et rigolos :

- cuisine : `pnj-chef-mimolette.png` (souris-cheffe à toque),
  `pnj-tartine.png` (tartine beurrée à bras courts, très fière).
- plage : `pnj-capitaine-bigorno.png` (crabe-capitaine à bicorne),
  `pnj-mouette-jackpot.png` (mouette qui a volé un doublon).
- grenier : `pnj-nounours-borgne.png` (ours en peluche à un œil,
  adorable), `pnj-poupee-clairvoyante.png` (poupée voyante à boule).
- foraine : `pnj-bonimenteur.png` (bonimenteur moustachu à mégaphone),
  `pnj-barbapapy.png` (papy vendeur de barbe à papa, nuage rose).
- banquise : `pnj-pingouin-jongleur.png` (pingouin jonglant avec des
  glaçons), `pnj-morse-savant.png` (morse à lorgnon et nœud papillon).

## 5. Lot D — Les jetons des deux nouvelles cases (2 fichiers)

Comme les jetons existants (`case-*.png`, disque peint, transparent) :
- `case-teleporteur.png` — un TOURBILLON cyan-violet hypnotique
  (couleur du type : #39b8d8).
- `case-carrefour.png` — un panneau de CARREFOUR à deux flèches
  opposées, bois et or (couleur du type : #8f9e3d).

## 6. Livraison et validation

ZIP unique (ou un ZIP par monde si tu préfères), arborescence `assets/…`
plate, + `INVENTAIRE.md` + une planche d'ambiance par monde (ses 3
décors + 4 bâtiments + 2 PNJ posés côte à côte). Critère d'acceptation
inchangé : chaque pièce doit sembler sortir de la MÊME boîte de jeu que
Cageot v4.3 posé à côté — même gouache, même lumière, même chaleur.
Aucun GLB, aucune ombre portée hors des assises, fonds transparents
irréprochables.
