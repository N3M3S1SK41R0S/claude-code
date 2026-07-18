# 🤝 Passation — Le Grand Mogul (pour la reprise par un autre agent / GPT-5.6)

> Document de reprise. Il décrit **l'état exact** du projet, ce qui est fait,
> ce qui reste, comment reprendre, et les pièges connus.
> Rédigé après interruption de la génération de banque par la **limite de
> dépense mensuelle** du compte (voir §4).

---

## 1. En une phrase

PWA mobile-first **Le Grand Mogul** : quiz de culture générale française,
jouable hors-ligne, solo ou en party pass-and-play, animé par un présentateur
parodique et 5 compagnons-jokers. Next.js 15 + TypeScript strict + Tailwind v4.
Le code est **complet et fonctionnel** ; le seul chantier ouvert est
l'**enrichissement de la banque de questions** sur 3 thèmes creux.

## 2. Où se trouve le projet

- Dépôt : `n3m3s1sk41r0s/claude-code`, branche **`claude/french-quiz-pwa-game-6mfzcw`**.
- Tout le jeu vit dans le sous-dossier **`grand-mogul/`** (le reste du dépôt =
  projet « velum », sans rapport).
- **Aucune PR ouverte** (personne ne l'a demandée). 4 commits poussés sur la
  branche. Développer et pousser **uniquement** sur cette branche.

```
grand-mogul/
├── spec.md              ← SPEC RÉCONCILIÉE (lire en premier), inclut le rapport
│                          d'ingestion du game_script et les conflits résolus (§11)
├── ARCHITECTURE.md      ← décisions techniques, machine à états, PWA, garde-fous
├── README.md            ← install / run / déploiement / variables d'env
├── HANDOFF.md           ← ce document
├── data/
│   ├── game-script.json           ← game_script client v1.0 (56 questions), verbatim
│   └── script-verification.json   ← 56 verdicts de fact-check + sources + corrections
├── public/data/bank.json          ← BANQUE EMBARQUÉE : 193 questions vérifiées
├── src/
│   ├── app/            ← page.tsx (accueil), play/page.tsx (match), scores/page.tsx,
│   │                      api/questions/route.ts, api/tts/route.ts
│   ├── components/     ← HostBubble, ThemeWheel, CastBar, InstallPrompt, SWRegister
│   └── lib/            ← types, engine (score/formats), bank, db (IndexedDB), tts,
│                          host (répliques Mogul), cast (5 compagnons), themes, etc.
├── sw/template.js       ← SOURCE du service worker (public/sw.js est GÉNÉRÉ, gitignoré)
└── scripts/            ← make-icons, stamp-sw, merge-bank, recover-forge, smoke
```

## 3. État par phase du pipeline (P1→P6)

| Phase | État | Détail |
|-------|------|--------|
| P1 Ingest | ✅ | game_script v1.0 ingéré, conflits résolus (`spec.md` §11). |
| P2 Core | ✅ | Boucle solo + party, roue, score, 6 formats de question, sans chrono. |
| P3 Engine | ✅ code / ⚠️ données | Moteur, IndexedDB, cache, API, offline OK. Banque : **193 questions** (cible 200) avec 3 thèmes creux. |
| P4 Audio | ✅ | `/api/tts` ElevenLabs (optionnel) → Web Speech fr-FR fallback, profils par personnage, cache IndexedDB, muet. |
| P5 Polish | ✅ | framer-motion, prefers-reduced-motion, haptique, dark mode, a11y (26 constats de revue corrigés). |
| P6 Ship | ⚠️ à faire | Config Vercel prête (`vercel.json`), **déploiement effectif non fait** (requiert le compte du propriétaire). |

## 4. Banque de questions — ✅ 342 vérifiées, 13 thèmes, 5 formats

> **Mise à jour 3 (finale)** : après quatre vagues de forge, la banque
> embarquée compte **342 questions vérifiées** — 237 qcm, 52 vrai_faux,
> 35 gambit_numerique, 16 equipe, 2 cash_carre_duo — réparties sur les
> 13 thèmes (min. 14/thème). Le fact-check adversarial (seuil 0,9, ≥2 sources)
> a été appliqué à chaque question. Pour les prochains lots vers l'objectif
> 500-1000 : relancer le workflow `mogul-bank-formats-v2` (VERSION RÉSILIENTE :
> chaque thème est écrit sur disque dès sa vérification — c'est celle-là qu'il
> faut réutiliser), listes anti-doublons à régénérer depuis la banque courante.
> En cas de coupure budget, les questions vérifiées non écrites se récupèrent
> via `scripts/recover-forge.mjs` sur le dossier de transcripts du workflow.
> Le jeu frère `donjon-du-savoir/` consomme cette banque via son
> `tools/build-questions.mjs` (344 questions : 342 + S7/B4 corrigées).

### Historique de l'incident (résolu)

**Ce qui s'est passé.** La génération de banque tournait via un workflow
multi-agents (fan-out par thème → fact-check adversarial par question). Le
compte a atteint sa **limite de dépense mensuelle** en cours de route :
`gastronomie`, `sport`, `langue` n'ont jamais été traités et `musique` s'est
arrêté à 2 questions. Pire, les agents *d'écriture sur disque* ont eux aussi
échoué → les 143 questions déjà vérifiées n'avaient pas atteint le disque.

**Ce qui a été récupéré.** `scripts/recover-forge.mjs` reconstruit ces 143
questions depuis les prompts des agents d'écriture (chaque prompt embarquait
son payload `<json>`), **sans aucun appel modèle**. Fusionnées avec 50
questions du game_script (vérifiées, sourcées), la banque compte **193
questions** intègres.

**Distribution actuelle** (`public/data/bank.json`) :

| Thème | Nb | | Thème | Nb |
|-------|----|----|-------|----|
| sciences | 30 | | insolite | 13 |
| histoire | 29 | | sport | 7 |
| geographie | 29 | | pop-culture | 7 |
| litterature | 24 | | general | 6 |
| arts | 23 | | **musique** | **2** |
| cinema | 23 | | **gastronomie** | **0** |
| | | | **langue** | **0** |

**➡️ Ce qui reste à faire (priorité 1) :** générer et vérifier ~20 questions
chacune pour **gastronomie, langue, musique** (et idéalement compléter à 20+
partout) pour dépasser la cible de 200 et couvrir les 13 thèmes de la roue.
Les 3 thèmes creux ne plantent pas le jeu (la sélection retombe sur le pool
global via `nextQuestion` dans `src/lib/bank.ts`), mais un joueur qui tombe
sur « Gastronomie » recevra une question hors-thème.

**Comment reprendre la génération** (deux options) :

1. **Recréer le workflow de forge** (quand le budget est rétabli). Le script
   original est sauvegardé :
   `/root/.claude/projects/.../workflows/scripts/mogul-question-bank-wf_b3fa190b-0e6.js`
   (hors dépôt). Le relancer en le limitant aux thèmes manquants, sortie vers
   un dossier temporaire, puis :
   ```bash
   node scripts/merge-bank.mjs <dossier-forge>   # refusionne forge + script
   npm run build && node scripts/smoke.mjs
   ```
   `merge-bank.mjs` lit **à la fois** le dossier forge fourni ET
   `data/game-script.json` + `data/script-verification.json` : il reconstruit
   toujours la banque complète, pas seulement les manquants. Déduplication par
   hash du texte normalisé, donc réexécuter est idempotent.

2. **À la main / autre modèle** : ajouter des objets au tableau `questions` de
   `public/data/bank.json` en respectant le schéma (§6). **Règle absolue** :
   aucun fait non vérifié, ≥ 2 sources canoniques réelles par question.

**Contrat qualité de la banque** (non négociable, cf. `spec.md` §7/§10) :
2 sources indépendantes minimum, fact-check adversarial, confiance ≥ 0,9,
sinon rejet. Zéro fait fabriqué. Le game_script d'origine n'avait aucune
source : chaque question a été sourcée + vérifiée avant admission
(`data/script-verification.json`). 3 rejets consignés : **V2** (7 continents —
faux pour l'enseignement français), **S7** et **B4** (confiance 0,85 < seuil).

## 5. Schéma d'une question (`public/data/bank.json`)

```jsonc
{
  "id": "histoire-001",
  "theme": "histoire",          // 13 thèmes, voir src/lib/themes.ts
  "format": "qcm",              // qcm | vrai_faux | cash_carre_duo | pari_confiance | gambit_numerique | equipe
  "age": "ado",                // enfant | ado | adulte  (filtre le public)
  "difficulty": 2,             // 1-5 (score + adaptatif ; mapping âge: enfant=1, ado=3, adulte=4)
  "question": "…",
  "choices": ["…","…","…","…"], // qcm/cash_carre_duo/pari_confiance = 4, vrai_faux = 2
  "answerIndex": 0,             // index de la bonne réponse dans choices
  // OU, selon le format :
  "acceptedAnswers": ["…"],    // equipe : liste des réponses acceptées
  "numericAnswer": 193,        // gambit_numerique : valeur exacte
  "anecdote": "…",             // 1-2 phrases, factuelle, lue après la révélation
  "sources": ["https://…","https://…"]   // ≥ 2 URLs vérifiées
}
```

Validation exécutée par `isValidQuestion()` dans `src/lib/bank.ts` (le jeu
ignore silencieusement toute entrée malformée — tester après édition).

## 6. Règles de jeu implémentées (à préserver)

- **Aucun chrono** : règle cardinale du game_script — le temps n'influence
  jamais le score. Ne pas réintroduire de timer.
- **Score** : `100 × difficulté` + série `+50 × min(série−1, 5)`, × multiplicateur
  de format (cash ×3, carré ×2, duo ×1 ; gambit exact ×2 / proche ×1 / presque
  ×0,5 ; pari SÛR ×2) × BARGOL (×2). Adaptatif : série ≥ 3 → palier +1 ;
  2 échecs → palier −1. Logique dans `src/lib/engine.ts` (testable en isolation).
- **Compagnons** (1 usage/personnage/match) : GRONK (élimine 2 mauvaises),
  LILUNE (indice), BARGOL (double ou rien), **MÉLISSANDRE (annule une mauvaise
  réponse — ex « temps gelé », resémantisé car plus de chrono)**, FIFRELIN
  (passe, série conservée). Personas et répliques dans `src/lib/cast.ts`.
- **Le Grand Mogul** : répliques dans `src/lib/host.ts`. Piques ≤ 15 mots,
  1 par question, échecs célébrés. **Original** : aucune imitation de personne
  réelle, aucun personnage/lore/réplique sous licence (Naheulbeuk/Kaamelott/
  Astérix interdits).

## 7. Comment lancer / vérifier

```bash
cd grand-mogul
npm install
npm run dev                     # dev http://localhost:3000
# ou build + prod + tests :
npm run build
npx next start -p 3111
SMOKE_EXTERNAL_SERVER=1 node scripts/smoke.mjs   # E2E Chromium headless
npm run typecheck               # tsc strict
```

**Piège environnement** : Chromium sur cette machine hérite de `HTTP(S)_PROXY`
et route `localhost` par le proxy CI → le test pend. Le smoke lance déjà
Chromium avec `--no-proxy-server` ; si vous scriptez du curl/fetch vers
localhost, utilisez `--noproxy localhost` ou dé-settez les variables proxy.
Le port 3111 reste parfois occupé après un run : `kill` le PID via
`ss -tlnp | grep 3111` avant de relancer.

## 8. Déploiement (P6, à finaliser par le propriétaire)

- `vercel.json` prêt (framework Next.js, région `cdg1`). Importer le repo dans
  Vercel avec **root directory = `grand-mogul`**, ou `vercel --cwd grand-mogul`.
- Variables d'env **optionnelles** (le jeu marche sans, en offline + Web Speech) :
  - `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) → active `/api/questions`
    (génération à la volée, runtime **nodejs**, `maxDuration=60`).
  - `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_*` (un id de voix par personnage,
    ou `ELEVENLABS_VOICE_DEFAULT`) → active `/api/tts`.
- **Aucun secret dans le dépôt** — tout par variable d'environnement.

## 9. Sécurité / garde-fous déjà en place

- `src/lib/apiGuard.ts` : contrôle d'origine (fetch cross-site refusé) + rate
  limit en mémoire par IP (6/min questions, 30/min tts). C'est une mitigation
  par isolat serverless, **pas** un quota global → poser un WAF/KV devant en prod.
- Service worker **estampillé au build** (`sw/template.js` + `scripts/stamp-sw.mjs`,
  hook `prebuild`/`predev`) : chaque déploiement réinstalle le SW et rafraîchit
  le precache (y compris les chunks `/_next/static`, pour un hors-ligne réel dès
  la 1re visite). Pas de `skipWaiting` destructeur.
- `public/sw.js` est **généré** (gitignoré) : ne jamais l'éditer à la main,
  modifier `sw/template.js`.

## 10. Historique & artefacts de raisonnement (hors dépôt, même session)

- Revue de code multi-agents : **26 constats confirmés** (contre-expertise
  adversariale), tous corrigés dans le commit d'ingestion. Résultat brut :
  `/tmp/claude-0/.../tasks/wsagjnk44.output`.
- Vérification du game_script : `data/script-verification.json` (dans le dépôt).
- Journaux des workflows de forge/vérif :
  `/root/.claude/projects/.../subagents/workflows/wf_b3fa190b-0e6/` et
  `.../wf_b9f722d6-ed1/` (contiennent les questions générées, réutilisables par
  `recover-forge.mjs`). **Éphémères** : le conteneur est reclamé après inactivité
  — si la banque doit être re-récupérée, le faire avant la fin de session.

## 11. TODO priorisé pour la reprise

1. **Compléter la banque** : générer + vérifier ~20 questions pour
   **gastronomie**, **langue**, **musique** (et remonter les thèmes < 20).
   Cible ≥ 200. Respecter le contrat qualité (§4).
2. (Optionnel) Rejuger **S7/B4** (confiance 0,85) : anecdotes corrigées
   disponibles dans `script-verification.json` si on veut les réintégrer.
3. **Déployer sur Vercel** (P6) + rédiger les captures d'install iOS/Android.
4. (Optionnel) Ajouter des tests unitaires sur `src/lib/engine.ts` (score,
   multiplicateurs, tolérance gambit, matching de réponses libres).
5. (Optionnel) Générer de vraies voix ElevenLabs par personnage et pré-cacher
   les répliques fixes du Mogul en sprite audio.
```
