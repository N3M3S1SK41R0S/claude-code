# CORRECTIF IMMÉDIAT POUR COMET — 100 % FRANÇAIS, sans exception

Des clips sont sortis EN ANGLAIS. Arrêt sur image, voici la correction.
Rien d'autre ne change : ordre strict, mêmes tableaux, mêmes réglages.

## La règle d'or (à appliquer à chaque génération)

Le texte que tu fais PARLER est TOUJOURS et UNIQUEMENT la colonne
« **Réplique à jouer** » des tableaux — jamais la description de voix
(elle est en anglais !), jamais l'intention, jamais un texte d'exemple
de l'interface. Toutes les répliques du jeu sont en français : si tu
t'apprêtes à générer une phrase en anglais, c'est que le mauvais texte
est dans le champ.

## D'où vient le bug

1. **Voice Design** : le champ « texte d'aperçu » propose par défaut une
   phrase en ANGLAIS. Si on la garde, la voix s'auditionne (et parfois
   s'enregistre) en anglais.
2. **Text to Speech** : si le texte collé est la description anglaise de
   la voix (ou un reste d'aperçu), le clip sort en anglais.

## Correction en Voice Design (étape A)

- La **description** de la voix RESTE en anglais (elle pilote le timbre,
  elle n'est jamais prononcée dans les clips finaux).
- Le **texte d'aperçu**, lui, doit être REMPLACÉ par la phrase française
  du personnage ci-dessous. Tu dois entendre chaque proposition de voix
  PARLER FRANÇAIS avant de la garder.

| Voix | Texte d'aperçu à coller (français) |
|---|---|
| Donjon-Cageot | En avant, pour le carton et la gloire ! Mon casque-casserole est bien vissé, et un chevalier en carton n'a peur de rien… ou presque. |
| Donjon-Etincelle | Abracadabra, mes étincelles pétillent déjà ! Quelle malice allons-nous inventer aujourd'hui, dites-moi ? |
| Donjon-Gobelin | Deux pièces d'or plus deux pièces d'or, cela fait quatre trésors. Chaque centime compte, et je compte chaque centime ! |
| Donjon-Nebulia | Les étoiles murmurent ce soir… et je crois bien qu'elles connaissent déjà la réponse. |
| Donjon-Boumbastien | Eurêka ! Ma nouvelle invention fonctionne… enfin presque, à trois boulons et une explosion près ! |
| Donjon-Duchesse | Mon petit, la connaissance est un bijou que l'on porte en toute saison. Et il me va, n'est-ce pas ? |
| Donjon-Flaque | Moussaillon, hissez la grand-voile ! L'aventure sent bon l'eau de flaque et la victoire ! |
| Donjon-Pelote | Approche, mon trésor. Mémé va te tricoter une petite victoire bien chaude, maille après maille. |
| Donjon-Hibou | Hou… hou… Chapitre premier : le savoir se déguste page après page, sans jamais se presser. |
| Donjon-Kribouille | Bing, badaboum, kribouille-bouille ! On joue, on rebondit, et on gagne en rigolant ! |
| Donjon-Plomberoy | Une fuite de questions ? Sire Plomberoy répare ça d'un bon coup de clé à molette, parole d'artisan ! |

## Correction en Text to Speech (étapes B et C)

- Modèle **Eleven v3** (à défaut Multilingual v2).
- Le champ de texte contient la **réplique française**, mot pour mot,
  rien d'autre.
- ÉCOUTE chaque clip : s'il sort en anglais, ou en français avec un fort
  accent anglais, régénère. Si l'accent persiste sur une voix, recrée-la
  en ajoutant à sa description : `native French speaker, speaks French`.

## Les clips anglais déjà générés

Ils sont BONS À JETER : ne les télécharge pas, ne les mets pas dans
l'export. Régénère leur version française immédiatement, à leur place
dans l'ordre, puis continue la liste. Mentionne dans ton rapport
combien de clips ont dû être refaits.

## Contrôle final avant chaque export

Réécoute 3 clips au hasard du lot : français naturel, voix du bon
personnage, texte conforme. Un seul clip anglais dans l'export = lot
refusé.
