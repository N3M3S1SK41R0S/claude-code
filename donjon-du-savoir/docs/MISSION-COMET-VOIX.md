# MISSION POUR COMET — Enregistrer les 178 voix du Donjon du Savoir
*(mission 100 % autonome : tu disposes du compte ElevenLabs déjà connecté
dans ce navigateur, et de deux fichiers fournis par l'utilisateur —
`MISSION-VOIX-V1.md` (le casting) et `REPLIQUES-A-ENREGISTRER.md` (le
script). Ta livraison : des ZIP de fichiers MP3 exactement nommés.)*

## 0. Ta mission en une phrase

Créer 12 voix de personnages ORIGINALES sur ElevenLabs, faire jouer à
chacune ses répliques du script (avec l'intention indiquée), télécharger
chaque audio, le renommer EXACTEMENT comme demandé, et livrer le tout en
ZIP — en commençant par le Héraut (57 répliques), à livrer seul d'abord.

## 1. Règles absolues (ne jamais y déroger)

1. **Voix ORIGINALES uniquement** : utilise l'outil de création de voix
   par description (« Voice Design »). N'utilise JAMAIS le clonage de
   voix, jamais une voix imitant une personne réelle ou un personnage
   connu.
2. **Ne modifie pas les textes** : chaque réplique doit être jouée MOT
   POUR MOT (les balises d'intention comme `[whispers]` se placent
   AVANT le texte et ne doivent pas être prononcées).
3. **Le nom de fichier est sacré** : `<id>.mp3`, exactement l'identifiant
   de la colonne « Fichier » du script (ex. `232e5b8b.mp3`), rangé dans
   `voix/<perso>/`. Un fichier mal nommé sera ignoré par le jeu.
4. Ne touche à rien d'autre sur le compte (pas de suppression de voix
   existantes, pas de changement d'abonnement, aucun achat).
5. Si le quota de caractères s'épuise ou qu'une page bloque : ARRÊTE,
   et rapporte précisément où tu en es (personnage, nombre de fichiers
   faits) au lieu d'improviser.

## 2. Étape A — Créer les 12 voix (une par personnage)

Sur https://elevenlabs.io → **Voices** → **Create a voice** →
**Voice Design** (création par description texte). Pour chaque
personnage, colle la description ci-dessous, génère quelques
propositions, ÉCOUTE, garde la plus vivante (jamais métallique), et
enregistre-la sous le nom indiqué.

| Nom à donner | Description à coller (anglais, meilleur rendu) |
|---|---|
| Donjon-Heraut | Warm French male baritone, theatrical old-time radio showman, medieval town crier energy, playful and knowing, lively pace, never robotic |
| Donjon-Cageot | Young French male voice, bright and boastful boy-scout energy, cracks slightly when unsure, endearing |
| Donjon-Etincelle | Sparkling young French female voice, quick and mischievous, crystal-clear, joyful |
| Donjon-Gobelin | Pinched precise French male voice, fussy bank-clerk tone, relishes numbers, nasal and finicky |
| Donjon-Nebulia | Calm velvety French female alto, dreamy and distant like an observatory at night, warm smile underneath |
| Donjon-Boumbastien | Excitable nasal French male voice, mad-inventor energy, speeds up when thrilled, little bursts of joy |
| Donjon-Duchesse | Impeccable aristocratic French female diction, long satisfied vowels, affectionate condescension |
| Donjon-Flaque | Gravelly jolly French male voice, miniature sea-dog, cascading laughs, salty warmth |
| Donjon-Pelote | Soft slightly quavering elderly French female voice, FULL of mischief, the grandma who always wins at cards |
| Donjon-Hibou | Hushed scholarly French male voice, deliberate little pauses as if turning pages, gentle owl-like ooh sounds |
| Donjon-Kribouille | High-pitched elastic funny French voice, bouncy almost sung sounds, playful alien creature |
| Donjon-Plomberoy | Proud hearty French male baritone, honest craftsman, rolls his shoulders in his voice, generous |

## 3. Étape B — Générer les répliques

Pour chaque personnage (COMMENCE PAR LE HÉRAUT, section « LE GRAND
HÉRAUT » du script) :

1. Ouvre **Text to Speech**, sélectionne la voix du personnage,
   modèle **Eleven v3** (ou à défaut Multilingual v2), langue française.
2. Réglages de départ : Stability basse-moyenne (~35 %), Style élevé
   (~60 %) — la vivacité prime sur la constance.
3. Pour CHAQUE ligne du tableau :
   - Colle la « Réplique à jouer », précédée si utile d'une balise tirée
     de la colonne « Intention » (ex. `[whispers]` pour les répliques
     chuchotées). L'intention te dit COMMENT jouer la ligne.
   - Génère, ÉCOUTE. Si le rendu est plat, robotique, mal prononcé ou
     précipité : régénère (2 essais max, garde le meilleur).
   - Télécharge le MP3 et renomme-le en `<id>.mp3` (colonne
     « Fichier »).
4. Range les fichiers dans `voix/heraut/`, `voix/cageot/`, etc.

Points de vigilance français : les nombres (« +3 », « 6 ») doivent être
DITS en français ; « 🪙 » et autres émojis ne se prononcent pas (ils ont
déjà été retirés du script) ; respecte les liaisons naturelles.

## 4. Étape C — Contrôles avant livraison

- Compte des fichiers : `voix/heraut/` = **57** ; chaque héros = **11**
  (cageot, etincelle, gobelin, nebulia, boumbastien, duchesse, flaque,
  pelote, hibou, kribouille, plomberoy). Total final = **178**.
- Aucun doublon, aucun fichier vide (< 5 Ko = suspect, réécoute).
- Noms STRICTEMENT identiques au script (pas de majuscules, pas
  d'espaces, pas de « (1) » de re-téléchargement).

## 5. Étape D — Livraison

1. **ZIP n° 1 : le Héraut seul** (`donjon-voix-heraut.zip` contenant
   `voix/heraut/*.mp3`) — livre-le dès qu'il est complet, il sera validé
   pendant que tu continues.
2. **ZIP n° 2 : les 11 héros** (`donjon-voix-heros.zip` contenant
   `voix/<perso>/*.mp3`).
3. Termine par un court rapport : fichiers générés par personnage,
   répliques régénérées, difficultés rencontrées, quota consommé.

Critère de réussite : on fait écouter trois répliques à quelqu'un qui ne
connaît pas le projet ; s'il demande « c'est quel comédien ? », c'est
gagné. S'il répond « c'est une IA ? », la voix est à refaire.
