# 🏰 Le Donjon du Savoir — Plan directeur v2 « façon Mario Party »

> Vision de la v2 demandée par Pierre + mes recommandations (« ce que je ferais
> de mieux »). Le socle est implémenté par incréments **testés** ; ce document
> est la boussole. Règles d'or intactes : **zéro chronomètre**, **jamais
> d'élimination**, contenu **fact-checké**, personnages/narrateur **100 %
> originaux** (humour esprit Burger Quiz, jamais l'imitation d'une personne réelle).

## 1. Le grand changement : du sprint au marathon d'étoiles

| | v1 « Course » (conservée) | v2 « Étoiles » (nouvelle, façon Mario Party) |
|---|---|---|
| Plateau | chemin, arrivée au trésor | **boucle** : on tourne, on repasse au Départ (prime d'or) |
| Fin | 1er au trésor | **nombre de tours fixé au départ** (court 8 / normal 12 / épique 18) |
| Victoire | arrivé le 1er | **le plus d'étoiles, puis le plus d'or** |
| Étoiles | — | achetées à l'**Étoile itinérante** (le marchand se déplace après chaque achat) |

Les deux modes coexistent : la v1 reste jouable telle quelle (rien de cassé),
la v2 devient le mode vedette. Objets, dés spéciaux, boutique, toast d'ouverture
et humour enrichi profitent **aux deux modes**.

## 2. Économie (valeurs à caler avec le panel de design, tuning facile)

- **Or** : bonne réponse `+ base×difficulté` ; cases Pièces ; **prime de tour de
  plateau** (repasser au Départ) ; mini-jeux ; ventes.
- **Étoile** : prix de base (≈ 20–30 or), **qui monte légèrement à chaque étoile
  déjà possédée** pour resserrer la fin. L'Étoile se déplace après chaque achat.
- **Vol d'étoile** : possible contre **beaucoup d'or** (objet « Sceptre du
  larcin », cher) ou **très rarement** via une case Chance/Événement — mémorable
  mais pas systématique, jamais cruel (l'esprit party, pas le grief).
- **Anti-dernier (esprit 99 %)** : le dernier au classement touche des primes
  d'or plus généreuses et des coups de pouce ; l'étoile reste toujours
  atteignable pour lui.

## 3. Boutique & objets (inventaire 3, ou **6 avec la Besasse Badass**)

Cases **Boutique** (et objet parfois en Chance). On dépense l'or, on cumule des
objets **utilisables quand on veut** (à son tour, avant/après le dé selon l'objet).

**Dés spéciaux**
- **Dé Double / Dé Triple** : lance 2 / 3 dés, on additionne (avancer plus vite).
- **Dé Choisi** : on choisit la valeur 1-6 (viser une case précise). Plus cher /
  usage unique pour éviter la domination.
- **Dé de Téléportation aléatoire** : atterrit sur une case au hasard.
- **Dé de Téléportation doré** : échange de place avec **un adversaire choisi**
  (la version « simple aléatoire » échange avec un adversaire au hasard).
- **Tuyau d'Or** : téléporte **juste devant l'Étoile** (précieux, cher).

**Jokers (sur soi)** : Bouclier (annule un malus ou un vol), Relance, Indice,
Aimant à or (double l'or du tour), Deuxième chance sur une question.

**Malus (sur autrui, toujours récupérables — anti-grief)** : Sabotage (recule un
adversaire), Racket (lui prend un peu d'or), Brouillard (il perd un choix
d'indice au prochain tour), Échange surprise. Un Bouclier peut toujours parer.

**Besasse Badass** : chère, fait passer la capacité de 3 → 6 objets. Vrai puits
d'or et choix stratégique (thésauriser des objets vs acheter des étoiles).

## 4. Cases du plateau (selon le donjon)

Existantes : Question, Chance, Événement, Coup dur, Pièces, Joker, Gambit, Trou
Noir, Départ. **Nouvelles v2** : **Boutique** 🛒, **Étoile** ⭐ (position
courante du marchand), **Insolite** 🦩 (savoir surprenant dédié), **Tuyau** 🌀,
et **Événement de plateau** 🎲 dont l'effet dépend du donjon (ex. éruption dans
la Tour, pluie d'or dans le Labyrinthe).

## 5. Questions & mini-jeux (le sel du jeu)

Le tirage varie le format et parfois **impose ou laisse choisir le thème**.
Dérivés de la banque **déjà vérifiée** (zéro contenu neuf, zéro risque factuel) :
- **QCM / Vrai-Faux / Cash-Carré-Duo / Pari de confiance / Gambit / Équipe** (déjà là).
- **Anagramme** : remettre dans l'ordre les lettres de la bonne réponse.
- **Pendu** : deviner la bonne réponse lettre par lettre.
- **Le plus proche** (esprit *Une Famille en Or* / *99 %*) : réponse numérique,
  le plus proche gagne — utilise les questions Gambit.
- **Motus-lite** : la réponse en N lettres, on propose, on révèle les bonnes places.
- **Question bonus de fin de tour** : **équipes aléatoires** qui s'entraident.
- Case **Insolite** dédiée.

Contenu original **à générer et fact-checker** (étape suivante, forge dédiée) :
Taboo, Mot de passe, Mime/Dessin (*Times Up* / *Pictionary*) — nécessitent des
listes de mots sûrs ; je ne les improvise pas sans vérification.

## 6. Étoiles bonus de fin de partie (×3, tirées aléatoirement)

Mesurées sur des **compteurs réels** du match, elles récompensent des styles et
gardent tout le monde en jeu jusqu'au bout :
- 🐇 **Le Lièvre / Roi des questions** — le plus de bonnes réponses.
- 🐢 **La Tortue** — le moins de cases parcourues mais des étoiles quand même.
- 🎯 **La Victime** — le plus de malus subis (on est récompensé d'avoir souffert).
- 🍀 **Le Chanceux / Le Malchanceux** — extrêmes de tirages Chance/Coup dur.
- 💰 **Le Grippe-sou** — le plus d'or amassé sans le dépenser.
Chaque étoile bonus peut renverser le classement : suspense garanti à la révélation.

## 7. Rituel d'ouverture (toast) — original, esprit absurde

Le Héraut désigne qui commence par une épreuve **loufoque mais réelle et
vérifiable à la table**, tirée au hasard, ex. :
- « Celui qui a mangé le plus récemment ouvre le bal. »
- « Celui dont l'anniversaire est le plus proche d'aujourd'hui. »
- « Le plus grand commence… ou le plus petit, le Héraut hésite. Le plus petit. »
- « Celui qui a le pouce le plus large. Oui, comparez. »
Puis l'ordre se déduit dans le sens des aiguilles d'une montre. Aucune donnée
personnelle n'est saisie : c'est un prétexte à rire, décidé par la table.

## 8. Ce que je ferais de mieux (mes ajouts)

1. **Deux modes, rien de cassé** : garder « Course » et ajouter « Étoiles » —
   on ne sacrifie pas le jeu déjà testé, on l'augmente.
2. **Mini-jeux dérivés de la banque vérifiée** : anagramme/pendu/plus-proche
   sortent des vraies réponses → variété maximale, **zéro fait non vérifié**.
3. **Malus toujours parables et récupérables** : en famille, un malus doit faire
   rire, pas dégoûter — Bouclier universel + effets bornés.
4. **Étoiles bonus branchées sur de vrais compteurs** : elles créent le twist
   final de *99 %* (« ne pas finir dernier ») sans jamais éliminer personne.
5. **Prix de l'étoile légèrement croissant** : évite qu'un joueur en tête fasse
   boule de neige ; la partie reste ouverte jusqu'au dernier tour.
6. **Économie lisible** : un seul HUD montre or 🪙, étoiles ⭐, objets (avec la
   capacité), tour X/N — indispensable à 20 joueurs.
7. **Humour dosé** : 1 pique du Héraut par événement, jamais deux d'affilée —
   l'esprit Burger Quiz vient du **timing**, pas du volume.
8. **Bonus « photo-souvenir »** : en fin de partie, un petit palmarès partageable
   (déjà l'écran victoire, à enrichir des étoiles bonus).
9. **Accessibilité d'abord** : tout au tour-par-tour, gros boutons, aucun
   clignotement, `prefers-reduced-motion`, lecture vocale du Héraut.

## 9. Ordre d'implémentation (incréments testés)

1. **Socle objets + dés + boutique + besasse + usage « quand on veut »** (additif,
   marche dans les deux modes) ← *premier livrable*.
2. **Toast d'ouverture** + enrichissement humour du Héraut.
3. **Mode Étoiles** : boucle, tours fixes, Étoile itinérante, achat, prime de
   tour, HUD, cases Boutique/Étoile/Insolite/Tuyau.
4. **Vol d'étoile** + **étoiles bonus de fin**.
5. **Mini-jeux dérivés** : anagramme, pendu, plus-proche, Motus-lite.
6. **Question bonus de fin de tour en équipes aléatoires**.
7. **Forge de contenu vérifié** pour Taboo / Mot de passe / Mime (listes sûres).
8. **Événements de plateau** thématiques par donjon.

Chaque incrément : `node tools/smoke.mjs` + `node tools/smoke-standalone.mjs`,
rebuild du fichier unique, commit + push.
