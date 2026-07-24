# Pack de langues — ajouter une langue au Donjon du Savoir

La structure multilingue est en place : le manifeste `data/langues.json`
déclare les packs disponibles, `js/langues.js` choisit le pack actif
(préférence `langue`, réglage 🌍 visible dès qu'il existe **au moins deux**
packs) et `js/data.js` charge la banque de questions du pack.

## Ajouter une langue en 4 étapes

1. **La banque de questions traduite ET vérifiée** :
   `data/langues/<id>/questions.json`, même schéma que la banque française
   (`id`, `texte`, `format`, `categorie`, `niveau_age`, `difficulte`,
   `anecdote`, `sources`, …). Les règles du projet s'appliquent PAR LANGUE :
   - zéro fait inventé — chaque question garde **≥ 2 sources https**
     de domaines différents, valables pour la version traduite ;
   - adaptation culturelle bienvenue (une question sur l'Académie française
     peut devenir une question sur la Real Academia en espagnol), mais
     alors les sources doivent couvrir le NOUVEAU fait ;
   - paliers d'âge et difficultés inchangés (tout_petit → adulte, 1-5).
   Le garde-fou `tools/add-batch.mjs` peut servir tel quel pour valider
   un lot avant intégration.

2. **Les défis de mots** (facultatif mais recommandé) :
   `data/langues/<id>/wordgames.json` — Tabou/Password/Mime dans la langue
   cible (les mots interdits d'un Tabou ne se traduisent pas, ils se
   reconstruisent).

3. **L'entrée du manifeste** dans `data/langues.json` :

   ```json
   {
     "id": "es-ES",
     "nom": "Español",
     "drapeau": "🇪🇸",
     "banque": "data/langues/es-ES/questions.json",
     "wordgames": "data/langues/es-ES/wordgames.json"
   }
   ```

4. **Le service worker** : ajouter les nouveaux fichiers à la liste
   `SHELL` de `sw.js` et incrémenter `VERSION` (sinon le pack ne sera pas
   disponible hors-ligne).

## Ce qui est branché aujourd'hui

- `document.documentElement.lang` suit le pack actif (lecteurs d'écran et
  synthèse vocale choisissent la bonne voix).
- Le réglage 🌍 apparaît automatiquement dans « Réglages & accessibilité »
  dès que le manifeste compte 2 packs ou plus ; le changement recharge le
  jeu avec la banque de la nouvelle langue.

## Chantiers restants pour une langue complète (v2)

- **Textes d'interface** : l'interface (boutons, règles, Héraut, héros,
  PNJ) est en français dans les modules JS. L'extraction vers un
  dictionnaire par langue est le gros chantier v2 — le manifeste prévoit
  déjà l'emplacement (`ui: "data/langues/<id>/ui.json"`).
- **Fichier autonome** : `tools/build-standalone.mjs` inline la banque
  française et intercepte `questions.json` ; pour embarquer plusieurs
  packs, étendre l'interception pour servir chaque pack par son chemin
  (aujourd'hui, le fichier unique reste français).
- **Voix du Héraut** : les 36 clips (`assets/voix/`) sont en français ;
  prévoir un lot par langue (voir docs/BRIEF-DOUBLAGE-PNJ.md).
