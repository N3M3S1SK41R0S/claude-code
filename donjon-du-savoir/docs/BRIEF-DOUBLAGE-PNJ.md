# Brief de doublage — PNJ, héros et Héraut du « Donjon du Savoir »

Mission pour l'équipe audio (ChatGPT 5.6 / Sol / GEN 2 ou tout studio) :
donner une VRAIE voix enregistrée à chaque personnage du jeu, dans la
continuité des 36 clips du Grand Héraut déjà livrés (lot 1).

## 1. Règles d'or (non négociables)

1. **Voix 100 % originales.** Aucune imitation d'une personne réelle,
   d'un comédien, d'un personnage de marque ou d'une voix connue. On vise
   des *timbres de personnages* : chaleureux, contrastés, théâtraux.
2. **Tout public / familial.** Ton bienveillant, drôle sans moquerie.
   Le jeu se joue de 2 à 99 ans, souvent avec de jeunes enfants.
3. **Français impeccable**, articulation claire (des enfants écoutent),
   rythme posé — le jeu n'a AUCUN chronomètre, rien ne presse jamais.
4. **Hors-ligne absolu.** Les fichiers sont embarqués dans le jeu ;
   aucun service réseau, aucune API de voix à l'exécution.
5. **Textes fournis = textes enregistrés.** Ne pas improviser de
   nouvelles répliques sans les faire valider (zéro contenu inventé).

## 2. Spécifications techniques (identiques au lot 1)

| Paramètre        | Valeur                                    |
|------------------|-------------------------------------------|
| Conteneur/codec  | WebM / Opus                               |
| Fréquence        | 48 000 Hz                                 |
| Canaux           | mono                                      |
| Débit            | ~20 kbps (voix parlée, fichier léger)     |
| Durée par clip   | ≤ 6 s (accroches) ; silence < 80 ms aux bords |
| Niveau           | ≈ −16 LUFS intégré, crête < −1 dBTP       |
| Nommage          | `<slug>-<moment>-<NN>.webm` (minuscules, tirets) |

Budget de poids : le jeu vise un fichier unique < 12 Mo au total —
**l'ensemble du lot doit rester sous ~1,5 Mo**. En Opus 20 kbps mono,
cela laisse environ 8 à 10 minutes de voix : largement assez.

## 3. Arborescence de livraison

```
livraison/
  voix-pnj/
    merlinouche-intro-01.webm
    merlinouche-bravo-01.webm
    merlinouche-rate-01.webm
    …
  voix-heros/
    cageot-tour-01.webm
    cageot-bonne-01.webm
    …
  manifest.json   ← id, fichier, slug, moment, texte exact enregistré
```

Le `manifest.json` suit le format de `data/voix.json` (déjà dans le
dépôt) : un objet par clip avec `id`, `categorie` (= `slug:moment`),
`fichier`, `texte`. C'est lui qui permet l'intégration automatique.

## 4. Qui parle, et comment — les 15 PNJ

Les répliques exactes vivent dans `js/game.js` (table `NPCS` : champs
`intro`, `demande`, `bravo`, `rate` pour les PNJ à quiz ; `intro` seul
pour les autres). Les profils de synthèse actuels (`js/voices.js`,
table `VOICE`) donnent l'intention de timbre : `pitch` haut = voix
aiguë, `rate` bas = débit lent.

| Slug | Personnage | Timbre voulu | Moments à enregistrer |
|------|------------|--------------|-----------------------|
| `merlinouche` | Merlinouche l'Étourdi, mage gaffeur | Grave, ampoulé, s'embrouille avec tendresse | intro, bravo, rate |
| `biscornu` | Biscornu le Dragonnet | Aigu, râpeux-mignon, gronde puis ronronne | intro, bravo, rate |
| `hibou-passage` | Maître Hibou de Passage | Posé, professoral, « hou hou » discret | intro, bravo, rate |
| `barnabe` | Barnabé le Bateleur | Bonimenteur de foire, roule des « r » | intro, bravo, rate |
| `groumf` | Groumf le Troll Gentil | Très grave, lent, syntaxe simplifiée | intro, bravo, rate |
| `ratichon` | Ratichon le Chapardeur Repenti | Vif, chuchoté, faux air innocent | intro, bravo, rate |
| `sylvette` | Sylvette la Sylphide | Aérien, cristallin, un souffle de vent | intro, bravo, rate |
| `roquefort` | Roquefort le Mulot Marchand | Nasillard pressé, bon camelot | intro |
| `fee-bricole` | Fée Bricole | Pétillant, malicieux, très léger | intro |
| `boubou` | Boubou le Fantôme Timide | Doux, hésitant, fin de phrase qui s'excuse | intro |
| `gerard` | Gérard le Squelette Poli | Cérémonieux, courtois à l'excès | intro |
| `turbo` | Turbo l'Escargot | Trrrès lent, chaque syllabe savourée | intro |
| `coassin` | Coassin le Crapaud Bavard | Coassant, enjoué, un peu vantard | intro |
| `piquot` | Piquot le Hérisson Pressé | Débit mitraillette, s'excuse en courant | intro |
| `zebulon` | Zébulon le Génie Distrait | Grandiose… puis perd le fil, rêveur | intro |

Prévoir **2 variantes** par moment quand c'est possible (`-01`, `-02`) :
le jeu tire au hasard pour éviter la répétition.

## 5. Les 11 héros (optionnel, lot suivant)

Répliques dans `js/voices.js` (table `HERO_LINES`) : moments `tour`,
`bonne`, `mauvaise`, `pouvoir`, `victoire` (2-3 variantes existent déjà
par moment — les enregistrer telles quelles). Timbres voulus dans la
table `VOICE` du même fichier. Ordre de priorité si le budget de poids
est serré : `victoire` > `tour` > `bonne` > `mauvaise` > `pouvoir`.

## 6. Le Grand Héraut (déjà livré — pour extension)

36 clips existent (`assets/voix/*.webm`, manifeste `data/voix.json`) :
accroches `question`, `anecdote`, `bonne`, `mauvaise`. Extensions
bienvenues au même format : accroches `duel`, `evenement`, `boutique`,
`victoire` (6 variantes chacune). Même voix, même énergie : animateur
généreux, complice, jamais moqueur, humour au premier degré.

## 7. Intégration côté jeu (pour information)

- Aujourd'hui : les PNJ et héros parlent via la synthèse du navigateur
  (`js/tts.js`, profils `VOICE`). Le Héraut joue d'abord un clip
  enregistré puis lit le texte long (`js/host-voice.js`).
- Demain : même mécanique pour les PNJ — le jeu jouera le clip
  `<slug>-<moment>` s'il existe dans le manifeste, sinon repli sur la
  synthèse. Les chemins d'assets restent des chaînes littérales pour que
  `tools/build-standalone.mjs` les inline en data-URI.

## 8. Checklist qualité avant livraison

- [ ] Tous les fichiers lisibles (`ffprobe` : WebM/Opus 48 kHz mono).
- [ ] Silences d'attaque/queue < 80 ms ; pas de clic ni de souffle.
- [ ] Niveaux homogènes entre personnages (± 1 LU).
- [ ] `manifest.json` complet : chaque fichier y figure, texte exact.
- [ ] Poids total du lot < 1,5 Mo.
- [ ] Aucune réplique hors des textes du dépôt (ou validée à part).
