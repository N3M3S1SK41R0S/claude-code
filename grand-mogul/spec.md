# LE GRAND MOGUL — Spécification du jeu

> **📜 GAME_SCRIPT REÇU EN COURS DE BUILD** (v1.0, 56 questions, 8 catégories) et ingéré.
> Le document ci-dessous est la spec réconciliée. Rapport d'ingestion et conflits en fin de document (§11).
> Règle cardinale du script, appliquée partout : **AUCUNE question n'est chronométrée —
> la variable temps n'influence jamais le score.**

## 0. Formats de question (schéma du script)

| Format | Mécanique | Multiplicateur |
|--------|-----------|----------------|
| `qcm` | 4 choix | ×1 |
| `vrai_faux` | 2 choix | ×1 |
| `cash_carre_duo` | réponse libre (CASH ×3), 4 choix (CARRÉ ×2) ou 2 choix (DUO ×1) — le joueur choisit sa mise avant de répondre | ×1 à ×3 |
| `pari_confiance` | QCM + pari : SÛR DE MOI (×2, gage −50 % de la base si faux) ou PRUDENT (×1) | ×1 ou ×2 |
| `gambit_numerique` | estimation numérique : exact ×2, proche ×1, presque ×0,5, sinon 0 (tolérance absolue ±3/±10 pour les années, relative 10 %/25 % sinon) | 0 à ×2 |
| `equipe` | question ouverte à réponses multiples acceptées (« Citez un… ») | ×1 |

`niveau_age` : `enfant` (convient à tous) < `ado` (convient aussi aux adultes) < `adulte`.
Un sélecteur de **public** filtre la banque : enfant → enfant seul ; ado → enfant+ado ; adulte → tout.

## 1. Concept

Quiz de culture générale française, mobile-first, installable (PWA), jouable hors-ligne.
Animé par **LE GRAND MOGUL**, présentateur à la solennité feinte et au flegme absurde,
épaulé par 5 compagnons d'archétype héroïc-fantasy (100 % originaux) qui servent de jokers.

## 2. Modes de jeu

| Mode | Joueurs | Déroulé |
|------|---------|---------|
| **Solo** | 1 | 10 questions, difficulté adaptative, série (streak) |
| **Party** | 2–8, pass-and-play | tour par tour sur un seul appareil, 10 questions chacun |

## 3. Thèmes (13 = 10 du bootstrap ∪ 8 catégories du script)

1. **Histoire** · 2. **Géographie** · 3. **Littérature** · 4. **Sciences & Nature** · 5. **Arts**
6. **Cinéma** · 7. **Musique** · 8. **Gastronomie** · 9. **Sport** · 10. **Langue française**
11. **Pop Culture** (script) · 12. **Insolite** (script ; absorbe « Burger Loufoque », voir §11)
13. **Général** (script)

## 4. Boucle de jeu

1. Roue des thèmes (animée) → thème du tour
2. Teaser du Mogul (1 ligne, pré-question)
3. Question au format du tirage — **sans chrono** (règle du script)
4. Jokers (compagnons) utilisables avant de répondre
5. Révélation → **anecdote sourcée obligatoire** + 1 pique du Mogul (≤15 mots, 1/question max)
6. Score, adaptation de difficulté, joueur/question suivant
7. Écran de résultats, sauvegarde IndexedDB

## 5. Score

- Base : `100 × difficulté (1–5)` — mapping âge→difficulté : enfant=1, ado=3, adulte=4
  (les questions de la forge conservent leur difficulté fine 1–5)
- Bonus de série : `+50 × min(streak−1, 5)` à partir de 2 bonnes réponses d'affilée
- Multiplicateur de format (§0) × BARGOL (×2) — composés
- Adaptatif : streak ≥ 3 → palier +1 ; 2 échecs consécutifs → palier −1 (bornes 1–5)
- **Le temps n'entre jamais dans le calcul** (aucun chrono n'existe)

## 6. Le casting (jokers — 1 usage/personnage/match)

| Personnage | Archétype | Compétence | Effet |
|------------|-----------|------------|-------|
| GRONK | barbare, QI d'enclume | CASSE-TOUT | élimine 2 mauvaises réponses (formats à ≥4 choix) |
| LILUNE | elfe mystique à côté de la plaque | VISION | révèle un indice (première lettre / nb de chiffres) |
| BARGOL | nain râleur, expert autoproclamé | DOUBLE OU RIEN | ×2 points ou 0 |
| MÉLISSANDRE | magicienne bureaucrate | TEMPS GELÉ | annule rétroactivement UNE mauvaise réponse (rejouez le coup) — voir conflit §11 |
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

## 11. Rapport d'ingestion du game_script (v1.0) — conflits & décisions

| # | Conflit / constat | Décision (safest) |
|---|-------------------|-------------------|
| 1 | Le script interdit tout chrono ; le bootstrap avait un timer 20 s et MÉLISSANDRE donnait +15 s | **Script prioritaire** : timer supprimé partout. MÉLISSANDRE conserve nom, persona et « TEMPS GELÉ », resémantisé en annulation rétroactive d'une mauvaise réponse (le temps est rembobiné) |
| 2 | 8 catégories script vs 10 thèmes bootstrap | Fusion en 13 thèmes ; « Burger Loufoque » (7 questions, profil identique) absorbé par « Insolite » |
| 3 | `niveau_age` (script) vs difficulté 1–5 (bootstrap) | Les deux coexistent : `age` filtre le public, `difficulty` sert au score et à l'adaptatif (enfant=1, ado=3, adulte=4 ; la forge garde 1–5) |
| 4 | Les 56 questions du script n'ont **aucune source** | Fact-check adversarial + sourçage (≥2 URLs) par agent dédié pour CHAQUE question avant entrée en banque ; rejet si confiance < 0,9 (conforme §7) |
| 5 | `pari_confiance` défini dans le schéma mais absent des 56 questions | Implémenté (SÛR ×2 / gage −50 % ; PRUDENT ×1), dormant tant que la banque n'en contient pas |
| 6 | Anomalies factuelles détectées : V2 (« 7 continents enseignés en France » — contredit l'usage scolaire français), S2 (anecdote « couleurs complémentaires » inexacte), B2 (coquille « so parfaitement »), G6 (RDC absente des réponses acceptées) | Traitées par le pipeline de vérification : correction quand réparable, quarantaine sinon ; verdicts consignés dans `data/script-verification.json` |
| 7 | Réponses libres (cash/equipe) : la correspondance automatique peut rejeter une formulation valable | Correspondance normalisée indulgente (articles, accents, inclusion) + bouton d'honneur « compter comme bonne » sur les formats à saisie |
