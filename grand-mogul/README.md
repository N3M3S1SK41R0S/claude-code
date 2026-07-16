# 🎩 LE GRAND MOGUL

> Quiz de culture générale française, animé par un présentateur à la solennité feinte
> et cinq compagnons d'heroic-fantasy qui servent de jokers.
> **PWA mobile-first, installable, 100 % jouable hors-ligne.**

## Le jeu

- **Solo** : 10 questions (5/10/15 au choix), difficulté adaptative, séries de bonnes réponses.
- **Party** : 2 à 8 joueurs en *pass-and-play* sur un seul appareil.
- **Roue des thèmes** : 10 thèmes de culture générale (histoire, géographie, littérature,
  sciences, arts, cinéma, musique, gastronomie, sport, langue française).
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
| 📜 | **MÉLISSANDRE**, magicienne bureaucrate | TEMPS GELÉ | +15 s au chrono |
| 🪕 | **FIFRELIN**, barde lâche | JOKER CHANTÉ | passe la question, série conservée |

### Score

`100 × difficulté` + bonus de série (`+50 × min(série−1, 5)`) ; la difficulté s'adapte :
3 bonnes réponses d'affilée → palier +1, deux échecs consécutifs → palier −1.

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

- `public/data/bank.json` — questions vérifiées embarquées (voir `scripts/merge-bank.mjs`).
- Chaque question : `{ theme, difficulty 1-5, question, 4 choices, answerIndex, anecdote, sources[≥2] }`.
- En jeu : cache IndexedDB, déduplication par hash, préchargement de lots via l'API quand
  une clé est configurée, bouton 🚩 pour signaler une erreur (mise en quarantaine locale).

## Architecture

Voir [ARCHITECTURE.md](./ARCHITECTURE.md). Spécification du jeu : [spec.md](./spec.md).
