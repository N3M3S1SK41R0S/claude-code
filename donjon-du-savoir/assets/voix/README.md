# Lot voix — Le Grand Héraut v1

Ce lot fournit **36 accroches parlées originales** pour rythmer la partie sans
réseau : 12 introductions de question, 12 lancements d'anecdote, 6 réactions
positives et 6 réactions bienveillantes après une erreur.

## Intégration

- Format : WebM/Opus mono, 48 kHz, débit cible 20 kbit/s.
- Poids total : environ 280 Ko.
- Manifeste éditorial : `data/voix.json`.
- Manifeste exécutable à chemins littéraux : `js/host-voice.js`.
- Lecture d'une question : accroche locale, puis Web Speech lit le texte
  variable.
- Lecture d'une réponse : réaction locale positive/bienveillante, lancement
  local de l'anecdote, puis Web Speech lit l'anecdote. Les 36 clips participent
  donc réellement à la partie.
- Repli : si Opus/WebM ou la lecture audio sont indisponibles, Web Speech dit
  l'accroche et le texte. Si Web Speech manque, le bouton vocal est masqué et le
  jeu reste entièrement jouable.

Le constructeur `tools/build-standalone.mjs` remplace chaque chemin WebM
littéral par une data-URI. Le fichier autonome fonctionne donc en `file://`
sans requête réseau.

## Direction de voix et provenance

Le Grand Héraut est un personnage vocal original : timbre synthétique chaleureux,
débit vif, diction française claire, aucune imitation d'une personne réelle.
Les textes ont été écrits pour le jeu. Les masters ont été produits localement,
puis égalisés, compressés et normalisés avant encodage Opus. Aucun service de
synthèse ou asset distant n'est appelé par le jeu.

## Contrôle

```bash
node tools/test-voice.mjs
node tools/build-standalone.mjs
```

La planche `docs/previews/voix-animateur-lot-1.png` montre les spectres d'un
échantillon représentatif du lot.
