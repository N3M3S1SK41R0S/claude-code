# Architecture — Le Grand Mogul

## Vue d'ensemble

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router, TypeScript strict, Tailwind v4)   │
│                                                            │
│  /            accueil, setup solo/party, réglages          │
│  /play        machine à états du match (client)            │
│  /scores      palmarès (IndexedDB)                         │
│  /api/questions  edge — Claude + web_search (optionnel)    │
│  /api/tts        edge — proxy ElevenLabs (optionnel)       │
└────────────────────────────────────────────────────────────┘
        │                          │
   public/sw.js               IndexedDB (grand-mogul)
   offline-first              questions / asked / flags /
   precache + runtime         scores / audio / meta
```

## Machine à états du match (`src/app/play/page.tsx`)

`boot → intro → [handoff] → wheel → teaser → question → reveal → …→ results`

- `handoff` n'existe qu'en mode party (pass-and-play).
- Un `turnToken` (ref) invalide les callbacks asynchrones périmés (TTS, timers de roue,
  chargement de question) quand on change de tour.
- Le chrono (`TimerBar`) est basé sur un horodatage de départ : MÉLISSANDRE ajoute 15 s
  en décalant l'échéance sans redémarrer le temps écoulé.

## Moteur de questions (`src/lib/bank.ts`)

1. **Seed** : `public/data/bank.json` (≥200 questions vérifiées, précaché par le SW)
   est chargé dans IndexedDB au premier lancement (versionné — un nouveau déploiement
   remplace le lot).
2. **Sélection** : thème demandé d'abord, difficulté la plus proche du palier du joueur,
   exclusion des questions déjà posées (`asked`) et signalées (`flags`). Banque épuisée →
   recyclage du registre `asked` (jamais des `flags`).
3. **Préchargement** : pendant l'écran de révélation, si le stock frais < 40 et que
   `/api/questions` est actif, un lot de 10 est récupéré et dédupliqué par hash SHA-256
   du texte normalisé.
4. **Signalement** : 🚩 → la question est mise en quarantaine locale et loggée.

La règle absolue de la banque : **zéro fait non vérifié**. Le pipeline de génération
(hors runtime) impose 2 sources indépendantantes minimum et un fact-check adversarial par
question ; en cas de conflit ou de confiance < 0,9, la question est rejetée.

## Audio (`src/lib/tts.ts`)

Chaîne de repli : **ElevenLabs** (si `ELEVENLABS_API_KEY`, via `/api/tts`, blobs mis en
cache dans IndexedDB) → **Web Speech API** (fr-FR, profils pitch/vitesse par personnage)
→ silence. Un échec 503 désactive ElevenLabs pour la session (quota épuisé = repli
immédiat). `speak()` ne bloque jamais le gameplay.

Profils : Mogul (pitch 0.9, lent-ironique), GRONK (0.5, très lent), LILUNE (1.35, aérien),
BARGOL (0.75, rapide), MÉLISSANDRE (1.1, précis), FIFRELIN (1.25, théâtral).

## PWA

- `public/manifest.webmanifest` : standalone, portrait, icônes 192/512 + maskable.
- `public/sw.js` (fait main) :
  - **precache** à l'installation : routes (`/`, `/play`, `/scores`), `bank.json`,
    manifest, icônes, page hors-ligne ;
  - `/_next/static` + icônes : cache-first (assets immuables) ;
  - `/data/` : stale-while-revalidate ;
  - navigations : network-first avec repli cache → `/` → `offline.html` ;
  - `/api/` : jamais mis en cache (le client a son propre repli).
- `next.config.ts` sert `sw.js` en `no-store` pour des mises à jour immédiates.

## Design & accessibilité

- Mobile-first (baseline 390 px), `max-w-md` centré, safe-area iOS (`env(safe-area-inset-top)`).
- Sombre par défaut ; `.light` sur `<html>` (persisté via localStorage + IndexedDB).
- `prefers-reduced-motion` : la roue ne tourne pas, les transitions deviennent instantanées.
- Rôles ARIA sur les groupes de choix, chrono en `aria-live`, focus visible doré.
- Haptique (`navigator.vibrate`) : patterns distincts correct/faux/joker, désactivable.

## Choix notables

- **DOUBLE OU RIEN littéral** : conformément à la spec (« ×2 points ou 0 »), un échec avec
  la mise de BARGOL ne retire pas de points — il annule simplement le gain potentiel.
  (Variante « mise à perte » envisagée puis écartée : la spec prime.)
- **Pas de dépendance PWA** (workbox, next-pwa) : le SW fait ~120 lignes lisibles.
- **IndexedDB sans wrapper externe** : ~80 lignes, promesses natives, repli mémoire si
  IndexedDB est indisponible (navigation privée).
- Les jokers restent utilisables plusieurs fois **par question différente** mais chaque
  personnage n'agit qu'**une fois par match et par joueur** ; l'échange animateur↔compagnon
  est limité à un par question (le premier joker utilisé).

## Tests

- `npm run typecheck` — TS strict (`noUncheckedIndexedAccess` inclus).
- `node scripts/smoke.mjs` — bout-en-bout Chromium headless : accueil, manifest, service
  worker, banque chargée, roue → question → joker VISION → révélation/anecdote, puis
  rechargement **hors-ligne** servi par le SW.
