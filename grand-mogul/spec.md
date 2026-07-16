# LE GRAND MOGUL — Spécification du jeu

> **⚠️ ASSOMPTION FLAGGÉE** : aucun bloc `<game_script>` n'a été transmis par Claude Sonnet 5.
> Cette spec est le **bootstrap par défaut** prévu par le pipeline NEMESIS-LUDUS :
> solo + party pass-and-play, 10 thèmes de culture générale française.
> Toute divergence avec le script original devra être réconciliée à réception.

## 1. Concept

Quiz de culture générale française, mobile-first, installable (PWA), jouable hors-ligne.
Animé par **LE GRAND MOGUL**, présentateur à la solennité feinte et au flegme absurde,
épaulé par 5 compagnons d'archétype héroïc-fantasy (100 % originaux) qui servent de jokers.

## 2. Modes de jeu

| Mode | Joueurs | Déroulé |
|------|---------|---------|
| **Solo** | 1 | 10 questions, difficulté adaptative, série (streak) |
| **Party** | 2–8, pass-and-play | tour par tour sur un seul appareil, 10 questions chacun |

## 3. Thèmes (10)

1. **Histoire** — Histoire de France et grands repères mondiaux
2. **Géographie** — France, Europe, monde
3. **Littérature** — auteurs, œuvres, courants (domaine francophone en priorité)
4. **Sciences & Nature** — physique, biologie, astronomie, inventions
5. **Arts** — peinture, sculpture, architecture, musées
6. **Cinéma** — films, réalisateurs, festivals (faits, jamais de dialogues protégés)
7. **Musique** — classique, chanson française, instruments
8. **Gastronomie** — cuisine française, produits, AOP, chefs historiques
9. **Sport** — JO, Tour de France, football, records
10. **Langue française** — expressions, étymologie, grammaire piégeuse

## 4. Boucle de jeu

1. Roue des thèmes (animée) → thème du tour
2. Teaser du Mogul (1 ligne, pré-question)
3. Question + 4 choix + timer 20 s
4. Jokers (compagnons) utilisables avant de répondre
5. Révélation → **anecdote sourcée obligatoire** + 1 pique du Mogul (≤15 mots, 1/question max)
6. Score, adaptation de difficulté, joueur/question suivant
7. Écran de résultats, sauvegarde IndexedDB

## 5. Score

- Base : `100 × difficulté (1–5)`
- Bonus de série : `+50 × min(streak−1, 5)` à partir de 2 bonnes réponses d'affilée
- BARGOL (Double ou rien) : ×2 ou 0 sur la question
- Adaptatif : streak ≥ 3 → palier +1 ; 2 échecs consécutifs → palier −1 (bornes 1–5)

## 6. Le casting (jokers — 1 usage/personnage/match)

| Personnage | Archétype | Compétence | Effet |
|------------|-----------|------------|-------|
| GRONK | barbare, QI d'enclume | CASSE-TOUT | élimine 2 mauvaises réponses |
| LILUNE | elfe mystique à côté de la plaque | VISION | révèle un indice (première lettre) |
| BARGOL | nain râleur, expert autoproclamé | DOUBLE OU RIEN | ×2 points ou 0 |
| MÉLISSANDRE | magicienne bureaucrate | TEMPS GELÉ | +15 s au chrono |
| FIFRELIN | barde lâche et vantard | JOKER CHANTÉ | passe la question, série conservée |

Chacun parle uniquement dans son registre, interventions ≤ 2 lignes,
1 échange animateur↔personnage max par question. Zéro emprunt à des licences existantes.

## 7. Moteur de questions

- Banque embarquée : **≥ 200 questions vérifiées** (2 sources indépendantes minimum,
  conflit → rejet, confiance < 0,9 → rejet, zéro fait fabriqué).
- `/api/questions` (edge) : génération à la demande via Claude + web_search si
  `ANTHROPIC_API_KEY` présent ; sinon 503 → la banque locale prend le relais.
- Cache IndexedDB avec hash de déduplication ; préchargement du lot suivant pendant la partie.
- Signalement joueur → question mise en quarantaine locale + loggée.

## 8. Audio

- TTS : ElevenLabs (si clé) via `/api/tts`, sinon Web Speech API (fr-FR), sinon silence.
- 6 profils de voix (Mogul grave/lent-ironique pitch 0.9 + 5 compagnons).
- Cache des blobs audio en IndexedDB. Bouton muet global.

## 9. PWA / plateforme

- Next.js 15 + TypeScript strict + Tailwind, mobile-first (base 390 px).
- `manifest.webmanifest` + service worker offline-first, installable iOS/Android.
- Dark mode (défaut sombre), haptique (`navigator.vibrate`), framer-motion,
  `prefers-reduced-motion` respecté, cible Lighthouse PWA ≥ 90.
- Déploiement : Vercel (config fournie ; le déploiement effectif requiert le compte du propriétaire).

## 10. Contraintes absolues

- Zéro fait fabriqué dans questions/anecdotes (invérifiable = rejeté).
- Zéro imitation de personne réelle, zéro personnage/lore/réplique sous licence.
- Zéro secret en clair (uniquement variables d'environnement).
- Contenu FR, code/commentaires EN, commits conventionnels.
