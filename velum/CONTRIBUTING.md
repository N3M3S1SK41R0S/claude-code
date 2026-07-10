# Contribuer à VELUM

Merci de contribuer ! Ce guide couvre le workflow Git, les conventions de commit, et les deux extensions les plus fréquentes : ajouter une **source de prix** et ajouter un **domaine**. Les agents de code doivent aussi lire [AGENTS.md](./AGENTS.md).

## 1. Workflow branches

- `main` — toujours vert (typecheck + tests), toujours livrable. **Jamais de commit direct.**
- Branches de travail courtes, nommées `type/sujet-court` :
  - `feat/stamp-yvert-cote`, `fix/valuation-mad-zero`, `docs/deployment-checklist`, `chore/expo-54-upgrade`
- Une PR = un sujet. Rebase sur `main` avant ouverture ; squash-merge par défaut.
- Toute PR doit passer : `pnpm typecheck && pnpm test` (l'équivalent local de la CI), et un pas de revue humaine.

## 2. Conventions de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
type(portée): résumé à l'impératif, ≤ 72 caractères

Corps optionnel : le POURQUOI, pas le comment.
```

- **Types** : `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`.
- **Portées usuelles** : `core`, `valuation`, `config`, `wine`, `coin`, `art`, `stamp`, `mobile`, `supabase`, `ui`, `api-client`.
- Exemples :
  - `feat(stamp): adaptateur cote Yvert (official_quote)`
  - `fix(valuation): conserver l'échantillon quand MAD = 0`
  - `docs(deployment): checklist Play Store API 36`
- Le message est en français (comme les commentaires) ; les identifiants de code restent en anglais.

## 3. Règles de code (rappel)

- TypeScript **strict**, `noUncheckedIndexedAccess` actif — voir les pièges dans [AGENTS.md](./AGENTS.md).
- Packages **source-first** : pas de build, `main: src/index.ts`.
- Commentaires et chaînes visibles utilisateur en **français** ; identifiants en anglais.
- Jamais de secret côté client (uniquement Edge Functions / `supabase secrets set`).
- `node_modules` est géré à la racine (pnpm workspaces) ; toute nouvelle dépendance se discute en PR dédiée.

## 4. Ajouter une source de prix (adaptateur)

Le moteur de valorisation ne change **jamais** : une source = un adaptateur `PriceSource` dans le package du domaine concerné.

1. Créer `packages/domains/<domaine>/src/sources/<maSource>.ts` en copiant le modèle d'un adaptateur existant (ex. `wine/src/sources/wineSearcher.ts`) :
   - classe `implements PriceSource` avec `name` lisible et `kind` **honnête** :
     `auction_realized` (ventes réalisées, poids 1.0) · `official_quote` (cotes officielles, 0.9) · `marketplace_sold` (ventes conclues, 0.7) · `listing` (annonces en cours, 0.4) ;
   - constructeur `SourceAdapterOptions` : `transport` injecté (jamais de `fetch` direct), `apiKey` optionnelle (instanciation côté Edge Function uniquement), horloge `now` injectable ;
   - `fetch(query)` : parsing **défensif** (`isRecord`, `asFiniteNumber`, `asNonEmptyString`), prix ≤ 0 ignorés, `ageDays` via `isoToAgeDays`, `matchedLabel` pour la traçabilité ;
   - **toute erreur ou réponse malformée → `[]`** (dégradation gracieuse, jamais de throw).
2. Documenter en tête de fichier l'URL appelée et un exemple de réponse (comme les adaptateurs existants).
3. Exporter depuis `src/index.ts` du package et brancher dans la liste de sources du `valuate` du plugin (et dans l'Edge Function qui instancie les sources avec les vraies clés).
4. Si une clé API est requise : l'ajouter à `supabase/functions/.env.example` (nom seul, pas de valeur).
5. **Tests** (`sources.test.ts`) avec un `Transport` fake : cas nominal, réponse malformée → `[]`, erreur réseau → `[]`, devise et `ageDays` corrects, `sourceWeight` = poids du `kind`.

## 5. Ajouter un domaine

Checklist complète et ordonnée dans [AGENTS.md — « Ajouter un 5e domaine »](./AGENTS.md#ajouter-un-5e-domaine--checklist-plugin). Résumé : étendre les contrats dans `@velum/core` (additif), créer `packages/domains/<nouveau>/` sur le modèle de `stamp/` (plugin `DomainPlugin` + ≥ 2 sources + tests), ajouter le feature flag dans `@velum/config`, l'Edge Function `analyze-<domaine>`, la migration du `CHECK` de `items.domain`, et l'enregistrement côté app.

## 6. Exigences de tests

- **Tout comportement nouveau est testé** ; tout bug corrigé reçoit d'abord un test qui le reproduit.
- Aucun test ne dépend du réseau, de l'heure réelle ni du hasard : injecter `Transport`/`VisionModel` fakes, `now`, et `rng: mulberry32(seed)` pour le bootstrap.
- Les plugins de domaine testent au minimum : reconnaissance (photo, texte, fichier, bascule saisie assistée < 0,35), analyse (coercition défensive, `uncertainties` jamais vide, disclaimers présents), valorisation (fan-out sources, propagation `NO_OBSERVATIONS`).
- Vérification locale obligatoire avant PR :

```bash
pnpm --filter <package> typecheck && pnpm --filter <package> test   # ciblé
pnpm typecheck && pnpm test                                          # monorepo complet
```

## 7. Documentation

Toute évolution de contrat (`packages/core`), de schéma (migrations) ou de pipeline met à jour le document correspondant dans `docs/` **dans la même PR** — la doc fait partie de la définition de « terminé ».
