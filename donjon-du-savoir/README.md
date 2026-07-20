# 🏰 LE DONJON DU SAVOIR

> Jeu de plateau interactif de culture générale — 1 à 20 joueurs sur un seul
> écran (pass-and-play), solo, chacun-pour-soi ou par équipes.
> **Se cultiver en jouant : chaque question livre son anecdote vérifiée.**
> **Zéro chronomètre, nulle part** (règle d'or du cahier des charges).
>
> Prototype « jouable ce soir » du cahier des charges v1.0 (§12) —
> HTML/CSS/JS vanilla, PWA installable, hors-ligne après premier chargement.

## Lancer le jeu

C'est un site 100 % statique, sans build :

```bash
cd donjon-du-savoir
python3 -m http.server 8080     # ou n'importe quel serveur statique
# → http://localhost:8080
```

Sur téléphone/tablette : ouvrir l'URL, puis **Installer l'application**
(Android : menu ⋮ → Installer ; iPhone : Partager → Sur l'écran d'accueil).
Après un premier chargement, le jeu fonctionne **entièrement hors-ligne**.

## Comment on joue

1. **Préparez l'expédition** : 1 à 20 joueurs (ou 2 à 6 équipes — un pion par
   équipe, porte-parole tournant), chacun avec un nom, une **tranche d'âge**
   (🍼 2-5 · 🧸 5-8 · 🧒 9-11 · 🧑 12-14 · 🎓 14-16 · 🧑‍🎓 16-18 · 🧙 18 ans et +)
   et un personnage du Donjon. Chaque tranche ouvre une fenêtre de difficulté :
   les tout-petits reçoivent des questions dédiées (animaux, couleurs, formes…),
   les grands des questions plus corsées. Une **question collective** vise
   toujours la tranche la **plus jeune** à la table ; une équipe joue au niveau
   de son plus jeune membre. Puis **choisissez votre donjon** parmi 5 plateaux :

   | Donjon | Cases | Caractère |
   |--------|-------|-----------|
   | 🕯️ La Crypte d'Initiation | 28 | clémente, sans trou noir — idéale enfants/découverte |
   | 🏰 Le Grand Donjon | 42 | le parcours classique équilibré |
   | 🗼 La Tour du Vertige | 48 | malus fréquents, DEUX trous noirs |
   | 💀 Les Catacombes du Chaos | 44 | trois gambits, événements collectifs à gogo |
   | 💰 Le Labyrinthe Doré | 56 | marathon à trésors, pièces et jokers abondants |

   Chaque partie re-mélange en plus les cases libres du plateau choisi.
   Puis choisissez le **mode** : 🏁 **Course** (le 1er au Trésor gagne) ou
   ⭐ **Étoiles** façon Mario Party (plateau en boucle, nombre de manches réglable
   de **5 à 200**,
   on achète des étoiles au marchand itinérant ; le plus d'étoiles gagne, l'or
   départage). En mode Étoiles, **on passe DEVANT** la boutique et l'étoile —
   pas besoin de s'arrêter pile dessus ; l'étoile change de place après chaque
   achat, et les grands plateaux ont plusieurs boutiques.
   **Vol d'étoile** : au marchand, on peut s'offrir le 👑 **Sceptre du Larcin**
   (cher) pour dérober une étoile à un adversaire ; et sur une case Chance, une
   rare (~4 %) *aubaine du destin* subtilise gratuitement une étoile au meneur
   (un bouclier pare le larcin). **Fin de partie** : 3 **étoiles bonus** tirées
   au sort récompensent des exploits chiffrés (🐇 le plus de cases, 🧠 le plus
   de bonnes réponses, 💰 le plus d'or, 🤕 le plus de coups durs encaissés…) et
   peuvent renverser le classement au tout dernier moment.
2. À son tour : **lancer le dé** (1d6), avancer, subir la case — et **utiliser
   un objet** de sa besace quand on veut (**un seul objet par tour** ; après
   usage, on reprend son tour, besace grisée).
3. Cases : ❓ Question · 🍀 Chance · 🎪 Événement collectif · 💀 Coup dur ·
   🪙 Pièces · 🃏 Joker · 🎲 Gambit (×2) · 🕳️ Trou Noir · 🛒 Boutique ·
   🦩 Savoir insolite · 🎭 Défi d'expression · 🏆 Trésor / ⭐ Étoile.
   **Objets & dés spéciaux** (boutique) : Dé Double/Triple/Choisi/Mirage/
   Échange, Tuyau d'Or, Bouclier, Aimant à Or, malus Sabotage/Racket, et la
   **Besasse Badass** (inventaire 3 → 6). Un **toast d'ouverture** loufoque
   désigne qui commence.
4. **Après chaque question, l'anecdote s'affiche — toujours**, avec ses sources.
5. **Mini-jeux de mots** : certaines questions QCM se muent en 🔤 **Anagramme**
   (les lettres de la réponse mélangées, façon Motus/Time's Up) ou en 🪢 **Pendu**
   (on devine les lettres, 6 erreurs max). Ils sont **dérivés de la banque déjà
   vérifiée** — aucun contenu neuf, donc aucun risque factuel.
6. **Question bonus de la tablée** : de temps en temps, entre deux tours, le
   Héraut lance une question à **toute la table** — la première bonne réponse
   criée rafle quelques pièces (toujours zéro chronomètre, la table est juge).
7. **Défis d'expression** (case 🎭) : le pion actif devient meneur et fait
   deviner à la tablée un défi 🚫 **Tabou** (sans dire les mots interdits),
   🔑 **Password** (indices d'un seul mot) ou 🤫 **Mime** (en silence). Contenu
   **vérifié, 100 % original et tout public** (`data/wordgames.json`) — aucun
   nom de marque, aucun personnage sous licence.
8. Premier pion au Trésor : victoire (jamais d'élimination).

### Formats de question (aucun n'est chronométré)

| Format | Mécanique | Récompense (cases) |
|--------|-----------|--------------------|
| QCM | 4 choix | +2 |
| Vrai/Faux | 2 choix | +1 |
| CASH / CARRÉ / DUO | choisir son risque avant de voir les choix | +4 / +2 / +1 |
| Pari de confiance | s'auto-évaluer de 1 à 10 avant de voir la question ; réussite = avance de ⌈mise/2⌉, mise ≥ 6 ratée = recul d'1 | +1 à +5 |
| Gambit numérique | annoncer un nombre ; les autres parient « trop haut / trop bas / juste » (+2 🪙 aux bons parieurs) | exact +4, proche +2/+1 |
| Question d'équipe / réponse ouverte | on répond à voix haute, la table valide (système d'honneur) | +2 |

Bonne réponse = **+1 pièce** en plus des cases. Règle de moteur : seuls les
**déplacements au dé** déclenchent les cases — les récompenses/pénalités
déplacent le pion sans re-déclencher (un tour se termine toujours).

### Difficulté adaptative (§5)

- Chaque **tranche d'âge** ouvre une fenêtre de difficulté (1-5) : 🍼 2-5 → 1
  (contenu tout-petit dédié), 🧸 5-8 → 1-2, 🧒 9-11 → 1-3, 🧑 12-14 → 2-4,
  🎓 14-16 → 3-5, 🧑‍🎓 16-18 → 4-5, 🧙 18+ → 3-5. Jamais de question au-dessus
  de sa fenêtre — les repêchages recyclent dans la même tranche.
- Le **1er du classement** pioche dans le tiers le plus dur de sa tranche.
- Le **dernier** (à partir de 3 pions) pioche plus facile **et** bénéficie du
  *coup de pouce du Donjon* : une mauvaise réponse éliminée sur les QCM.
- Le **Trou Noir** pose la question la plus dure disponible : +3 cases ou −6.
- En équipe, le niveau s'aligne sur le plus jeune membre de l'équipe.

### Les personnages (pouvoir unique, rechargeable 🃏 ou 8 🪙)

| | Personnage | Pouvoir 🎩 adulte | Pouvoir 👶 enfant |
|---|-----------|-------------------|-------------------|
| 🛡️ | Sire Cageot | Charge Téméraire (répondre CASH) | Bouclier Facile (question plus facile) |
| ✨ | Dame Étincelle | Chapardage (vole un Joker) | Deuxième Chance (relance le dé) |
| 🪙 | Gobelin Comptable | Bonus Comptable (pièces ×2 ce tour) | Petit Trésor (2 cartes Chance, garde la meilleure) |
| 🌌 | Nébulia | Échange Cosmique (échange sa position) | Bulle Protectrice (annule un Coup dur) |
| 💥 | Boumbastien | Relance ! (relance le dé) | Turbo Case (+2 cases) |
| 👑 | La Duchesse Anecdote | Indice Royal (anecdote avant de répondre) | Indice Malin (indice sur la réponse) |

### Le narrateur

**Le Grand Héraut du Donjon** 📯 — mascotte 100 % originale (option B du §9
du cahier des charges), commentaires écrits + lecture vocale optionnelle via
la synthèse du navigateur (bouton 🔊 en haut). Aucune imitation de personne
réelle.

**Effets sonores** (bouton 🔕/🔔 en haut) : de petits bips **synthétisés** au
vol (Web Audio, aucun fichier, hors-ligne) ponctuent dé, pièces, bonne/mauvaise
réponse, achat d'étoile et victoire. Désactivés par défaut, muetables, et
l'écran de victoire fête l'événement d'une pluie de confettis (coupée si le
système demande de réduire les animations).

## La banque de questions

`data/questions.json` — **880 questions vérifiées** (chaque fait contrôlé
contre ≥ 2 sources indépendantes, citées sous chaque anecdote), 13 catégories,
6 formats, réparties en niveaux `tout_petit` / `enfant` / `ado` / `adulte`
(difficulté 1-5). Elle est générée depuis la banque fact-checkée du projet
frère `../grand-mogul` :

```bash
node tools/build-questions.mjs   # régénère data/questions.json
```

Pour l'étendre : enrichir la banque de `grand-mogul` (pipeline de génération +
fact-check adversarial) puis relancer le script — ou ajouter des entrées à la
main dans `data/questions.json` en respectant le schéma du cahier (§7), avec
2 sources minimum par question. Le contenu **2-5 ans** (`tout_petit`) s'ajoute
via `grand-mogul/scripts/add-tout-petit.mjs <candidats.json>` (revalidation :
≥ 2 sources https distinctes, choix cohérents, dédup sur toute la banque,
rejet par défaut), avant de relancer `build-questions.mjs`.

**Défis d'expression** : `data/wordgames.json` — un lot vérifié, **100 %
original et tout public** de défis 🚫 Tabou (mot + 5 mots interdits), 🔑 Password
et 🤫 Mime, répartis en niveaux enfant/ado/adulte (le niveau enfant convient à
toute la tablée). Aucun nom de marque, aucun personnage sous licence ; le mot
interdit du Tabou n'apparaît jamais dans le mot-cible (contrôlé par
`tools/test-wordgames.mjs`). Même registre de fraîcheur inter-parties que les
questions. Format volontairement simple pour être étendu à la main.

**Fraîcheur inter-parties** : un registre local (localStorage) mémorise les
questions déjà vues — une question ne revient que lorsque toutes les autres
ont été vues autant de fois. Avec le choix du donjon, le re-mélange des cases
à chaque partie et les modes appliqués aux QCM (≈15 % deviennent un Pari de
confiance, ≈20 % un CASH/CARRÉ/DUO), la même banque se rejoue très longtemps
sans lassitude.

**Questions maison** : l'écran « ✍️ Vos questions maison » (accueil) laisse la
table écrire ses propres questions (QCM ou Vrai/Faux, catégorie dont « Notre
famille », niveau enfant/ado/adulte). Elles sont stockées sur l'appareil et
mélangées à la banque comme les autres (adaptativité, fraîcheur, événements
collectifs), mais clairement marquées 🏠 « non vérifiée par le Donjon » en jeu
— rejouabilité littéralement sans fin.

## Tests

```bash
node tools/smoke.mjs             # E2E Chromium : setup → dés → cases →
                                 # question → anecdote → reprise → hors-ligne
node tools/smoke-shop.mjs        # E2E boutique + objets + toast d'ouverture
node tools/smoke-etoiles.mjs     # E2E mode Étoiles : achat d'étoile au passage,
                                 # sceptre du larcin, 3 étoiles bonus de fin
node tools/smoke-minigames.mjs   # E2E anagramme / pendu / bonus tablée / défi 🎭
node tools/test-bonus.mjs        # unitaire : tirage des étoiles bonus de fin
node tools/test-minigames.mjs    # unitaire : anagramme / pendu / plus proche
node tools/test-wordgames.mjs    # unitaire : contenu vérifié Tabou/Password/Mime
node tools/make-icons.mjs        # régénère les icônes PWA (vectoriel → PNG)
node tools/build-standalone.mjs  # → dist/donjon-standalone.html (un seul fichier)
node tools/smoke-standalone.mjs  # joue le fichier unique en headless (file://)
```

## Version « un seul fichier » (jouer sans serveur)

`node tools/build-standalone.mjs` assemble **tout le jeu dans un unique
`dist/donjon-standalone.html`** : modules concaténés (shim CommonJS, chaque
module garde son scope), CSS et banque de questions embarqués, aucun service
worker ni requête réseau. On l'ouvre directement (double-clic, `file://`) ou on
l'envoie tel quel — idéal pour tester vite sur un téléphone. Même source que la
PWA, donc rien à maintenir en double.

(`node_modules` est un lien vers `../grand-mogul/node_modules` pour
`playwright-core` — outillage de dev uniquement, le jeu lui-même n'a
**aucune dépendance**.)

### Icône de bureau (Windows / macOS / Linux)

`node tools/make-launcher.mjs` génère `dist/launcher-kit/` : une icône stylisée
aux formats **.ico** (Windows), **.icns** (macOS) et **.png** (Linux, produits
depuis `icons/icon-512.png` via Chromium), le jeu en un seul fichier renommé, un
**lanceur par système** (raccourci Bureau) et un `LISEZ-MOI`. Le kit se
décompresse n'importe où et lance le jeu **hors-ligne** d'un double-clic. (Sortie
de build ignorée par git — régénérable.)

## Conformité au cahier des charges (§12)

**Livré** : plateau interactif 42 cases (9 types, fréquences du §4), 6
personnages × 2 pouvoirs, tous les formats de questions, zéro chronomètre,
banque vérifiée avec anecdotes systématiques et sources, narrateur-mascotte
original + synthèse vocale, 1-20 joueurs pass-and-play, équipes avec
porte-parole tournant, difficulté adaptative (bonus : par score fin 1-5, pas
seulement par tranche d'âge), sauvegarde/reprise automatique, PWA hors-ligne,
**habillage illustré original complet** (portraits des 6 compagnons, mascotte
Héraut, 12 jetons de case, 12 décors, bannière d'accueil, 5 fonds de donjon et
icônes de l'app dans `assets/` — chaque image est posée par-dessus le médaillon
SVG / l'emoji / le dégradé d'origine, qui reste en **repli** si une image
manque ; gros fonds et bannière en WebP allégé).

**Pas encore fait** (conforme au §12) : voix professionnelle et architecture
multi-écrans façon Jackbox (un téléphone par joueur), assurance anti-malus
payante (v2). Banque : 824 questions vérifiées sur 6 formats et 13 catégories —
le pipeline de génération + fact-check peut produire les lots suivants vers
l'objectif 500-1000 du cahier.

**Notes IP** (décisions conformes aux §6 et §9 du cahier) : personnages et
narrateur 100 % originaux ; aucun nom, personnage ou élément du Donjon de
Naheulbeuk ni d'aucune licence dans le produit ; aucune imitation de voix ou
d'identité de personne réelle. Les mécaniques inspirées (Trivial Pursuit,
TTMC, etc.) ne reprennent aucun nom de marque dans l'interface.
