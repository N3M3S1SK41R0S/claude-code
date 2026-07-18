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
   équipe, porte-parole tournant), chacun avec un nom, un profil
   👶 enfant / 🎩 adulte et un personnage du Donjon — puis **choisissez votre
   donjon** parmi 5 plateaux :

   | Donjon | Cases | Caractère |
   |--------|-------|-----------|
   | 🕯️ La Crypte d'Initiation | 28 | clémente, sans trou noir — idéale enfants/découverte |
   | 🏰 Le Grand Donjon | 42 | le parcours classique équilibré |
   | 🗼 La Tour du Vertige | 48 | malus fréquents, DEUX trous noirs |
   | 💀 Les Catacombes du Chaos | 44 | trois gambits, événements collectifs à gogo |
   | 💰 Le Labyrinthe Doré | 56 | marathon à trésors, pièces et jokers abondants |

   Chaque partie re-mélange en plus les cases libres du plateau choisi.
2. À son tour : **lancer le dé** (1d6), avancer, subir la case.
3. Cases : ❓ Question · 🍀 Chance · 🎪 Événement collectif · 💀 Coup dur ·
   🪙 Pièces · 🃏 Joker · 🎲 Gambit (×2) · 🕳️ Trou Noir (fin de parcours) ·
   🏆 Trésor (arrivée).
4. **Après chaque question, l'anecdote s'affiche — toujours**, avec ses sources.
5. Premier pion au Trésor : victoire (jamais d'élimination).

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

- Profil 👶 : questions « enfant » uniquement (elles conviennent à tous).
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

## La banque de questions

`data/questions.json` — **494 questions vérifiées** (chaque fait contrôlé
contre ≥ 2 sources indépendantes, citées sous chaque anecdote), 13 catégories,
3 tranches d'âge, 6 formats. Elle est générée depuis la banque fact-checkée du
projet frère `../grand-mogul` :

```bash
node tools/build-questions.mjs   # régénère data/questions.json
```

Pour l'étendre : enrichir la banque de `grand-mogul` (pipeline de génération +
fact-check adversarial) puis relancer le script — ou ajouter des entrées à la
main dans `data/questions.json` en respectant le schéma du cahier (§7), avec
2 sources minimum par question.

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
node tools/smoke.mjs    # E2E Chromium headless : setup → dés → cases →
                        # question → anecdote → sauvegarde/reprise → hors-ligne
node tools/make-icons.mjs   # régénère les icônes PWA (vectoriel → PNG)
```

(`node_modules` est un lien vers `../grand-mogul/node_modules` pour
`playwright-core` — outillage de dev uniquement, le jeu lui-même n'a
**aucune dépendance**.)

## Conformité au cahier des charges (§12)

**Livré** : plateau interactif 42 cases (9 types, fréquences du §4), 6
personnages × 2 pouvoirs, tous les formats de questions, zéro chronomètre,
banque vérifiée avec anecdotes systématiques et sources, narrateur-mascotte
original + synthèse vocale, 1-20 joueurs pass-and-play, équipes avec
porte-parole tournant, difficulté adaptative (bonus : par score fin 1-5, pas
seulement par tranche d'âge), sauvegarde/reprise automatique, PWA hors-ligne.

**Pas encore fait** (conforme au §12) : illustrations riches dessinées
(les compagnons ont des médaillons SVG originaux — `js/portraits.js` — et les
prompts §6 restent prêts pour une passe de génération d'images), voix
professionnelle, architecture multi-écrans façon Jackbox (un téléphone par
joueur), assurance anti-malus payante (v2). Banque : 494 questions vérifiées
sur 6 formats et 13 catégories — le pipeline de génération + fact-check peut
produire les lots suivants vers l'objectif 500-1000 du cahier.

**Notes IP** (décisions conformes aux §6 et §9 du cahier) : personnages et
narrateur 100 % originaux ; aucun nom, personnage ou élément du Donjon de
Naheulbeuk ni d'aucune licence dans le produit ; aucune imitation de voix ou
d'identité de personne réelle. Les mécaniques inspirées (Trivial Pursuit,
TTMC, etc.) ne reprennent aucun nom de marque dans l'interface.
