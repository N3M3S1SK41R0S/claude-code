# AGENTS.md — instructions pour agents de code

Ce fichier est le contrat de travail des agents (Claude Code et autres) intervenant sur VELUM. Lis-le en entier avant de modifier quoi que ce soit.

## Avant tout : lire les contrats

Le cœur de VELUM tient dans `packages/core/src/` — **tout part de là** :

- `domain.ts` — `DomainPlugin` (recognize/analyze/valuate), `CaptureInput`, `Candidate`, `RecognitionResult`, `AnalysisResult`, `VisionModel`, `VectorIndex`, `RecognizeDeps`/`AnalyzeDeps`/`ValuateDeps`
- `pricing.ts` — `PriceSource`, `PriceObservation`, `PriceQuery`, `SourceKind`, `DEFAULT_SOURCE_WEIGHTS`, `FxRates`, `ValuationResult`
- `items.ts` — miroirs TypeScript du schéma Postgres (camelCase côté app)
- `errors.ts` — `VelumError` avec codes stables (i18n côté client)
- `analysis/{wine,coin,art,stamp}.ts` — payloads d'analyse par domaine

Et `packages/valuation/src/engine.ts` — le moteur §7 : `valuate(obs, fx, options)`.

## Conventions (non négociables)

1. **TypeScript STRICT** — `tsconfig.base.json` active `noUncheckedIndexedAccess` : **toute indexation de tableau/objet retourne `T | undefined`**. Gère l'`undefined` explicitement (garde, `??`, narrowing) ; les assertions `as` ne sont tolérées qu'après vérification prouvée (voir `engine.ts` pour le style).
2. **Packages source-first** — `type: "module"`, `main: "src/index.ts"`, **pas de build** : la source TS est consommée directement par Metro et Vitest. N'ajoute jamais d'étape `tsc --build` ni de `dist/`.
3. **Contrats `@velum/core` d'abord** — un plugin de domaine implémente `DomainPlugin`, point. Si un besoin ne rentre pas dans le contrat, on fait évoluer le contrat dans `core` (de façon additive), jamais de bypass.
4. **Adaptateurs `PriceSource` + `Transport` injecté** — aucun adaptateur ne touche le réseau directement. Le `Transport` (`getJson`) est injecté : implémentation réelle côté Edge Function, fake côté tests. Une source indisponible ou une réponse malformée → `[]` (dégradation gracieuse), **jamais de throw**.
5. **Secrets uniquement dans les Edge Functions** — `supabase secrets set`. Côté client, seuls les `EXPO_PUBLIC_*` (publics par conception : URL Supabase, anon key, clés publiques RevenueCat). Ajouter un secret dans `apps/mobile` = faute bloquante.
6. **Identifiants en anglais ; commentaires et chaînes visibles utilisateur en FRANÇAIS.**
7. **Testabilité par injection** — LLM (`VisionModel`), transport HTTP, horloge (`now`), RNG (`rng`) : tout est injectable. Aucun test ne doit dépendre du réseau, de l'heure réelle ni du hasard.
8. **Jamais de fausse certitude** — chaque `Candidate` porte une `confidence` honnête ; chaque `AnalysisResult` porte des `disclaimers` non vides ; `valuate` jette `VelumError('NO_OBSERVATIONS')` plutôt que de retourner un zéro trompeur.

## Commandes de vérification (obligatoires avant de terminer)

Depuis la racine `velum/` :

```bash
pnpm --filter <ton-package> typecheck   # ex. pnpm --filter @velum/domain-stamp typecheck
pnpm --filter <ton-package> test
# ou tout le monorepo :
pnpm typecheck && pnpm test
```

`node_modules` est déjà installé — **ne lance jamais `pnpm install` ni `pnpm add`**. Ne modifie pas `package.json` / `tsconfig.json` / `vitest.config.ts` sauf indication contraire. N'écris que dans le répertoire qui t'est assigné.

## Ajouter un 6e domaine — checklist plugin

> Le 5e domaine, montres (`watch`), a été implémenté en juillet 2026 en suivant
> exactement cette checklist — `packages/domains/watch/` sert désormais de
> second modèle de référence à côté de `stamp/`. L'exemple ci-dessous est
> conservé tel quel.

Exemple : montres (`watch`). Tout est additif :

1. **Contrats** (`packages/core/`) :
   - [ ] Étendre `VelumDomain` dans `domain.ts` (`'wine' | 'coin' | 'art' | 'stamp' | 'watch'`) et le champ `domain` de `PriceQuery` dans `pricing.ts`.
   - [ ] Ajouter les `MediaRole` spécifiques si besoin (ex. `'dial'`, `'caseback'`).
   - [ ] Créer `analysis/watch.ts` (payload du moteur `watch_v1`, avec `uncertainties: string[]` obligatoire) et l'exporter depuis `index.ts`.
2. **Package** `packages/domains/watch/` (`@velum/domain-watch`) — copier la structure de `stamp/` :
   - [ ] `package.json` / `tsconfig.json` / `vitest.config.ts` calqués sur un domaine existant (`type: module`, `main: src/index.ts`).
   - [ ] `src/transport.ts` (ou réutilise le motif existant), `src/guards.ts`, `src/json.ts` (parsing défensif du JSON modèle).
   - [ ] `src/plugin.ts` : implémente `DomainPlugin<WatchAnalysisPayload>` — `recognize` (photo/texte/fileRows, seuil saisie assistée 0,35, top-3 trié), `analyze` (prompt système + coercition défensive, `disclaimers` constants), `valuate` (fan-out sources → `deps.valuate(obs, deps.fx)`), `buildPriceQuery`.
   - [ ] `src/sources/*.ts` : ≥ 2 adaptateurs `PriceSource` avec `kind` correct (`auction_realized` 1.0 > `official_quote` 0.9 > `marketplace_sold` 0.7 > `listing` 0.4).
   - [ ] Tests : `plugin.test.ts` + `sources.test.ts` avec fakes (vision, transport, horloge).
3. **Configuration** (`packages/config/`) :
   - [ ] Feature flag (ex. `enableWatches`) + `activeDomains()` + défauts.
4. **Backend** :
   - [ ] Edge Function `analyze-watch` (porte la clé LLM), enregistrement du plugin dans le routeur de reconnaissance.
   - [ ] Vérifier que la contrainte `CHECK` du champ `domain` en base accepte la nouvelle valeur (migration).
5. **App** :
   - [ ] Enregistrer le plugin dans le registre des domaines, tuile de capture, i18n FR.
6. **Vérification** : `pnpm typecheck && pnpm test` verts sur tout le monorepo.

## Ajouter une source de prix

Voir la section dédiée de [CONTRIBUTING.md](./CONTRIBUTING.md). Résumé : un fichier dans `src/sources/`, classe `implements PriceSource`, `kind` honnête, transport injecté, parsing défensif (`isRecord`, `asFiniteNumber`, `asNonEmptyString`), erreurs → `[]`, tests avec transport fake. **Le moteur de valorisation ne change jamais.**

## Pièges connus

- **`noUncheckedIndexedAccess`** — `xs[i]` est `T | undefined` même après un `for (let i = 0; i < xs.length; i++)`. Idem `Record<string, T>[key]`. Préfère `for...of`, `.at()`, ou une garde ; en dernier recours `as T` avec commentaire justifiant l'invariant (voir `median()` dans `engine.ts`).
- **Imports Deno dans `supabase/functions/`** — les Edge Functions sont du **Deno**, pas du Node : imports **avec extension `.ts` explicite** (`import { x } from './lib.ts'`) et dépendances via `npm:`/`jsr:` ou l'`import_map.json` de la fonction. Ne pas y importer les packages workspace par chemin relatif hors du dossier `functions/` sans passer par l'import map — Metro et Deno ne résolvent pas pareil.
- **`import_map.json`** — si une fonction mappe `@velum/core`, garde la map synchronisée avec les exports réels du package ; une entrée obsolète casse `supabase functions serve` silencieusement.
- **Pas de build** — n'importe jamais depuis `dist/` ni ne référence des types générés ; tout se résout sur `src/`.
- **Bootstrap seedé** — dans les tests du moteur, injecte `rng: mulberry32(seed)` ; ne compare jamais des IC issus de `Math.random`.
- **MAD = 0** — quand la majorité des prix sont identiques, `rejectOutliers` conserve tout (pas d'information d'échelle). Ne « corrige » pas ce comportement en réintroduisant un epsilon : c'est un choix documenté (voir commentaire dans `engine.ts`).
- **JSONB défensif** — tout payload relu depuis Postgres (`analyses.payload`, `items.attributes`) est du `unknown` déguisé : valide avec les guards avant usage (voir `cellar.ts`).
- **Apostrophes françaises** — les chaînes utilisateur utilisent l'apostrophe typographique (’) ; attention aux comparaisons de chaînes dans les tests.
