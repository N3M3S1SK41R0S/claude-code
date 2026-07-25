# MISSION GEN 2 — v4 « Héros fidèles » du Donjon du Savoir
*(mission intégrale et autonome — fait suite aux lots v2 « Grand Cabaret »
et v3 « Rendu 3D », livrés et intégrés)*

## 1. Le constat, sans détour

Tes PEINTURES sont l'âme visuelle du jeu : portraits des héros,
bâtiments, PNJ — magnifiques et immédiatement reconnaissables. Mais les
FIGURINES 3D actuelles des héros (low-poly simples) ne ressemblent pas
assez à tes portraits : visages minimalistes, accessoires trop discrets,
et Nébulia est méconnaissable (sa capuche avale son visage). Quant aux
bâtiments GLB, ils étaient si éloignés de tes peintures que nous les
avons retirés du jeu — le plateau 3D affiche aujourd'hui tes peintures
en panneaux (standees) à la place.

Mission v4 : des GLB enfin FIDÈLES à ton propre style peint.

## 2. Contraintes techniques (non négociables)

- **Format** : glTF 2.0 binaire (.glb), compression Draco bienvenue.
- **Axes** : Y vers le haut ; **pivot au sol**, centré.
- **Échelle** : 1 unité = 1 « mètre » du plateau ; un héros ≈ 2,2 u de
  haut (socle compris), un bâtiment 4 à 6,5 u.
- **Budgets héros** : ≤ 5 000 triangles, texture unique 1024×1024
  EMBARQUÉE, ≤ 120 Ko après Draco.
- **Budgets bâtiments** : ≤ 4 000 triangles, texture 1024×1024
  embarquée, ≤ 100 Ko après Draco.
- **Budget total du lot : < 3 Mo.**
- **Noms de fichiers et de clips EXACTS** (listés plus bas) :
  l'intégration est automatique, un écart = fichier ignoré.
- 100 % original, familial, palette du jeu (violets nuit #1a1230-#342a58,
  or #e0b04a, ivoire #f4ecd8).

## 3. LOT A — Les 11 héros fidèles aux portraits (priorité 1)

Mêmes fichiers (remplacement direct) : `assets/3d/heroes/hero-<id>.glb`.
**Conserver les 8 clips existants, mêmes noms exacts** : `idle`, `walk`,
`joy`, `disappointment`, `deception`, `salute`, `dance`, `think`.
Le socle de pion rond reste (c'est l'identité « figurine de plateau »),
mais TOUT LE RESTE monte en fidélité : silhouette signature lisible à
10 mètres, visage expressif (yeux, sourcils, bouche), accessoires
iconiques BIEN VISIBLES.

| Fichier | Héros | Signature à respecter (d'après TES portraits) |
|---|---|---|
| `hero-cageot.glb` | Cageot, chevalier en carton | casserole argentée sur la tête (poignée comprise), plastron en carton scotché de travers, sourire confiant |
| `hero-etincelle.glb` | Étincelle, magicienne pétillante | grand chapeau violet pointu et penché, robe à étincelles dorées, baguette-étoile |
| `hero-gobelin.glb` | Le Gobelin Comptable | peau verte, GRANDES oreilles pointues, lunettes rondes, gilet de comptable, pièce d'or serrée en main |
| `hero-nebulia.glb` | Nébulia, sorcière cosmique | capuche bleu nuit étoilée mais VISAGE DÉGAGÉ ET VISIBLE (priorité absolue : elle est méconnaissable aujourd'hui), spirale galactique sur la robe |
| `hero-boumbastien.glb` | Boumbastien, inventeur farfelu | cheveux en pétard roussis, lunettes d'atelier sur le front, tablier à outils, petite clé à molette |
| `hero-duchesse.glb` | La Duchesse érudite | chignon impeccable, diadème doré, face-à-main tenu à l'œil, robe élégante |
| `hero-flaque.glb` | Flaque, corsaire des flaques | bandana rouge, cache-œil, grand sourire à dents, bottes, éclaboussure au socle |
| `hero-pelote.glb` | Pelote, mamie tricoteuse | chignon gris, lunettes rondes, châle tricoté, pelote de laine rose + aiguilles |
| `hero-hibou.glb` | Le Hibou bibliothécaire | GROSSES lunettes rondes, aigrettes, plumage brun-roux, petit livre sous l'aile |
| `hero-kribouille.glb` | Kribouille, créature des étoiles | fourrure turquoise, ventre lavande, grandes oreilles rondes, petites étoiles dorées flottantes |
| `hero-plomberoy.glb` | Plomberoy, plombier-chevalier | casque à plume ivoire, GROSSE moustache, armure rouge, clé anglaise dorée à l'épaule |

Règle d'or : quelqu'un qui connaît le portrait peint doit reconnaître la
figurine EN UNE SECONDE, de dos comme de face (la silhouette d'abord).

## 4. LOT B — Les 10 bâtiments fidèles aux peintures (priorité 2)

Mêmes fichiers : `assets/3d/buildings/batiment-<id>.glb`
(`chateau`, `tour-mage`, `boutique`, `taverne`, `bibliotheque`, `pont`,
`portail`, `fontaine`, `etoile`, `champignon`).

Chaque GLB doit être la TRADUCTION EN VOLUME de ta peinture du même nom
(`assets/batiment-<id>.png`) : mêmes couleurs, mêmes proportions, mêmes
détails signatures (les tours violettes pointues du château, les
rayures de l'échoppe, le chapeau rouge à pois de la maison
champignon…). Texture peinte à la main, pas de matériaux unis.
S'ils sont fidèles, ils remplaceront les panneaux peints actuels ;
sinon, les panneaux restent — la fidélité décide.

## 5. LOT C — Les 3 PNJ v3 restylés (priorité 3, optionnel)

`assets/3d/pnj/gerard.glb`, `merlinouche.glb`, `zebulon.glb` : mêmes
fichiers, mêmes clips (`idle` + `bow` / `spell-fail` / `lose-thread`),
mais alignés sur leurs portraits peints (Gérard : squelette courtois à
nœud papillon ; Merlinouche : mage débraillé au chapeau tordu ;
Zébulon : génie vaporeux mauve sortant de sa lampe).

## 6. Checklist qualité avant livraison

- [ ] Chaque GLB s'ouvre sans erreur dans un viewer glTF standard.
- [ ] Les 8 clips des héros présents, noms EXACTS, non altérés dans
      leur intention (idle calme, walk rythmée, joy explosive…).
- [ ] Test de reconnaissance : figurine ↔ portrait appariés en 1 s.
- [ ] Nébulia : visage visible, y compris en vue de trois quarts.
- [ ] Pivot au sol, échelle 2,2 u vérifiée, textures embarquées.
- [ ] Budgets respectés (5 000/4 000 tris ; 120/100 Ko ; < 3 Mo total).
- [ ] Style raccord avec les lots v2-v3 (sols, ciels, décors).

## 7. Livraison

ZIP unique reprenant l'arborescence `assets/…` + `INVENTAIRE.md` (une
ligne par fichier) + si possible un `QA.json` (triangles, hauteur,
clips, poids par fichier, comme au lot v3 — c'était parfait). Lots
séparés acceptés, priorité A > B > C. Chaque pièce livrée est intégrée
automatiquement ; toute pièce manquante est ignorée sans rien casser.
