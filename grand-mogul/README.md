# 🎩 LE GRAND MOGUL

> Quiz de culture générale française, animé par un présentateur à la solennité feinte
> et cinq compagnons d'heroic-fantasy qui servent de jokers.
> **PWA mobile-first, installable, 100 % jouable hors-ligne.**

## Le jeu

- **Solo** : 5/10/15 questions, difficulté adaptative, séries de bonnes réponses.
- **Party** : 2 à 8 joueurs en *pass-and-play* sur un seul appareil.
- **Sélecteur de public** : enfant / ado / adulte (les questions « enfant » conviennent à tous).
- **Aucun chrono** : le temps n'influence jamais le score (règle du game_script).
- **6 formats de question** : QCM, Vrai/Faux, Cash-Carré-Duo (réponse libre ×3, 4 choix ×2,
  2 choix ×1), Pari de confiance, Gambit numérique (estimation), Équipe (« Citez un… »).
- **Roue des thèmes** : 13 thèmes de culture générale (histoire, géographie, littérature,
  sciences, arts, cinéma, musique, gastronomie, sport, langue française, pop culture,
  insolite, général).
- **Anecdote sourcée après chaque question** — chaque question de la banque embarquée a été
  vérifiée contre au moins deux sources indépendantes, citées dans le jeu.
- **LE GRAND MOGUL** commente tout : teaser avant la question, pique après la réponse
  (les échecs sont célébrés autant que les victoires).

### Les compagnons (1 usage par personnage et par match)

| | Compagnon | Compétence | Effet |
|---|-----------|------------|-------|
| 🪓 | **GRONK**, barbare | CASSE-TOUT | élimine 2 mauvaises réponses |
| 🌙 | **LILUNE**, elfe mystique | VISION | révèle un indice |
| ⛏️ | **BARGOL**, nain râleur | DOUBLE OU RIEN | ×2 points si correct |
| 📜 | **MÉLISSANDRE**, magicienne bureaucrate | TEMPS GELÉ | annule une mauvaise réponse, rejouez |
| 🪕 | **FIFRELIN**, barde lâche | JOKER CHANTÉ | passe la question, série conservée |

### Score

`100 × difficulté` + bonus de série (`+50 × min(série−1, 5)`), multiplié par le format
(cash ×3, carré ×2, gambit exact ×2…) et par BARGOL ; la difficulté s'adapte :
3 bonnes réponses d'affilée → palier +1, deux échecs consécutifs → palier −1.
Le temps n'entre jamais dans le score.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

Build de production et tests :

```bash
npm run build
npm start
node scripts/smoke.mjs   # test bout-en-bout (Chromium headless requis)
```

## Installer sur téléphone

- **Android (Chrome)** : ouvrir le site → bannière « Installer » (ou menu ⋮ → *Installer l'application*).
- **iPhone/iPad (Safari)** : bouton **Partager** → **Sur l'écran d'accueil**.

Une fois installé et ouvert une première fois, le jeu fonctionne **entièrement hors-ligne** :
la banque de questions vérifiées est embarquée et servie par le service worker + IndexedDB.

## Déployer sur Vercel

```bash
npm i -g vercel
vercel --cwd grand-mogul   # ou : importer le repo dans Vercel, root directory = grand-mogul
```

Variables d'environnement **optionnelles** (le jeu fonctionne sans) :

| Variable | Rôle |
|----------|------|
| `ANTHROPIC_API_KEY` | active `/api/questions` : génération de questions fraîches via Claude + recherche web |
| `ANTHROPIC_MODEL` | modèle utilisé (défaut : `claude-fable-5`) |
| `ELEVENLABS_API_KEY` | active `/api/tts` : voix ElevenLabs pour l'animateur et les compagnons |
| `ELEVENLABS_VOICE_MOGUL`, `ELEVENLABS_VOICE_GRONK`, `ELEVENLABS_VOICE_LILUNE`, `ELEVENLABS_VOICE_BARGOL`, `ELEVENLABS_VOICE_MELISSANDRE`, `ELEVENLABS_VOICE_FIFRELIN`, `ELEVENLABS_VOICE_DEFAULT` | identifiants de voix ElevenLabs par personnage |

Sans clé ElevenLabs, le jeu utilise la **Web Speech API** du navigateur (voix fr-FR,
profils pitch/vitesse par personnage). Sans clé Anthropic, la banque locale suffit.

## Banque de questions

- `public/data/bank.json` — questions vérifiées embarquées, fusion de deux sources
  (voir `scripts/merge-bank.mjs`) :
  1. la **forge** : questions QCM générées puis fact-checkées adversarialement (2 sources min) ;
  2. le **game_script** client (`data/game-script.json`), admis uniquement avec un verdict
     de vérification + sourçage (`data/script-verification.json`).
- Schéma : `{ theme, format, age, difficulty 1-5, question, choices?/acceptedAnswers?/numericAnswer?, anecdote, sources[≥2] }`.
- En jeu : cache IndexedDB, déduplication par hash, préchargement de lots via l'API quand
  une clé est configurée, bouton 🚩 pour signaler une erreur (mise en quarantaine locale).

## Architecture

Voir [ARCHITECTURE.md](./ARCHITECTURE.md). Spécification du jeu : [spec.md](./spec.md).
