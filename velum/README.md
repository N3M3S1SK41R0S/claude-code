# VELUM

> **Lever le voile sur la valeur cachée.** VELUM identifie, analyse et estime vos objets de collection à partir d'une simple photo — et transforme votre collection en patrimoine documenté.

VELUM est une application universelle (iOS / Android / web) construite avec Expo. Une photo, une saisie libre ou un import de fichier suffit : l'app reconnaît l'objet, produit une fiche d'analyse experte et calcule une estimation de valeur avec intervalle de confiance — toujours accompagnée de son score de fiabilité, jamais de fausse certitude.

---

## Les 4 modules — tous à part entière

| Module | Domaine | Moteur d'analyse | Sources de prix |
|---|---|---|---|
| 🍷 **Vin** | `wine` | **ZAPPA∴VINI∴SAPIENS** — 7 modules (identification, œnologie, notes critiques, marché & spéculation, comparatif, JSON strict, garde-fous) | Wine-Searcher, iDealwine, Cavissima, Vivino |
| 🪙 **Pièces** (numismatique) | `coin` | `numis_v1` — identification, grade (échelles FR & Sheldon), rareté, variétés | Numista, PCGS, NGC, CGB, Heritage, eBay sold, Catawiki |
| 🖼️ **Tableaux** (art) | `art` | `art_v1` — attribution qualifiée (jamais d'authentification ferme), état, provenance, comparables | Artprice, Drouot, Heritage, Artsy, Magnus |
| 📮 **Timbres** (philatélie) | `stamp` | `phila_v1` — catalogues Yvert & Tellier / Michel / Stanley Gibbons / Scott, état (gomme, centrage, défauts), rareté | Cote Yvert, Delcampe, eBay sold, Catawiki, Colnect |

La philatélie est un **module à part entière depuis juillet 2026** (révision produit du CDC v1.0 §0.1). Elle est activée par défaut et désactivable par feature flag (`enableStamps`, voir `packages/config/src/index.ts`).

Chaque module implémente le **même contrat** `DomainPlugin` (`packages/core/src/domain.ts`) : `recognize()` → `analyze()` → `valuate()`. Ajouter un domaine est purement additif — voir [AGENTS.md](./AGENTS.md) et [CONTRIBUTING.md](./CONTRIBUTING.md).

## Stack technique

- **App** : [Expo SDK 54](https://expo.dev) · React Native 0.81 · React 19.1 · Expo Router (file-based routing) · New Architecture activée
- **UI** : NativeWind 4 (Tailwind pour RN) · `@velum/ui` (composants partagés, mode senior)
- **État & données** : TanStack Query 5 (serveur) · Zustand 5 (client) · MMKV (cache local)
- **Backend** : [Supabase](https://supabase.com) — Auth (Sign in with Apple / Google / email), Postgres + **RLS**, Storage (bucket `item-media`), Edge Functions (Deno), Realtime, Cron
- **IA & recherche** : LLM multimodal (vision) appelé **uniquement côté Edge Functions** · [Qdrant](https://qdrant.tech) (similarité vectorielle, étage 2 de reconnaissance)
- **Monétisation** : [RevenueCat](https://www.revenuecat.com) (`react-native-purchases`) — 4 paliers : **Gratuit** (5 scans/semaine par module), **Premium** (scans illimités, sans carnet virtuel), **Gold** (+ carnet/bibliothèque virtuelle : cave avec emplacements, table de pièces, galerie, album), **Platine** (valorisation du carnet en continu vs marché + communauté de transactions anonymisées — commission dégressive de 5 % à 2 % selon l'activité du vendeur, expertise obligatoire à la charge du vendeur au-delà de 500 €)
- **Monorepo** : Turborepo + pnpm workspaces · TypeScript strict · Vitest · packages *source-first* (pas d'étape de build, `main: src/index.ts`)

## Arborescence du monorepo

```
velum/
├── apps/
│   └── mobile/                    # App universelle Expo (iOS / Android / web)
│       ├── app/                   # Routes Expo Router (écrans — en cours d'implémentation)
│       ├── app.config.ts          # Config Expo : privacyManifests iOS, feature flags, plugins
│       ├── eas.json               # Profils EAS (development / preview / production)
│       ├── assets/brand/          # velum-intro.mp4, splash-still.png, icon-provisional.png
│       └── .env.example           # Variables CLIENT publiques (EXPO_PUBLIC_*)
├── packages/
│   ├── core/                      # @velum/core — LES CONTRATS : domain.ts, pricing.ts,
│   │                              #   items.ts, errors.ts, analysis/{wine,coin,art,stamp}.ts
│   ├── valuation/                 # @velum/valuation — moteur de valorisation §7 (engine.ts)
│   ├── config/                    # @velum/config — feature flags, quotas freemium, env client
│   ├── api-client/                # @velum/api-client — client Supabase typé (en cours)
│   ├── ui/                        # @velum/ui — composants partagés + thème (en cours)
│   └── domains/
│       ├── wine/                  # @velum/domain-wine — plugin + ZAPPA + sources/
│       ├── coin/                  # @velum/domain-coin — plugin + grade.ts + sources/
│       ├── art/                   # @velum/domain-art — plugin + dimensions.ts + sources/
│       └── stamp/                 # @velum/domain-stamp — plugin + catalog.ts + sources/
├── supabase/
│   ├── migrations/                # DDL + RLS + triggers + consume_scan (en cours)
│   └── functions/                 # Edge Functions Deno (en cours) + .env.example (secrets)
├── docs/                          # ARCHITECTURE, DATABASE, DEPLOYMENT, PRIVACY, DEMO_ACCOUNT
├── turbo.json                     # Pipeline Turborepo (dev, test, typecheck, lint)
├── pnpm-workspace.yaml            # apps/* + packages/* + packages/domains/*
└── tsconfig.base.json             # TS strict, noUncheckedIndexedAccess, Bundler resolution
```

> Les répertoires marqués « en cours » sont produits par des chantiers parallèles ; leurs contrats sont décrits dans [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) et [docs/DATABASE.md](./docs/DATABASE.md).

## Démarrage développeur

> **Juste voir/tester ?** → [docs/QUICKSTART.md](./docs/QUICKSTART.md)
> (3 niveaux, du web sans compte au scan réel) et
> [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) (backend local en 4 commandes).

Prérequis : Node ≥ 20, pnpm 10, Supabase CLI, (optionnel) EAS CLI.

```bash
# 1. Installer les dépendances
pnpm install

# 2. Configurer l'environnement client
cp apps/mobile/.env.example apps/mobile/.env
# → renseigner EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
#   EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY

# 3. Base de données & fonctions (projet Supabase lié)
supabase db push                     # applique les migrations (DDL + RLS + triggers)
supabase secrets set --env-file supabase/functions/.env   # secrets SERVEUR uniquement
supabase functions serve             # Edge Functions en local

# 4. Lancer l'app
pnpm dev                             # turbo run dev → expo start
# ou directement :
pnpm --filter velum-mobile dev       # puis i (iOS), a (Android), w (web)
```

### Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | `turbo run dev` — démarre Expo |
| `pnpm test` | `turbo run test` — Vitest sur tous les packages |
| `pnpm typecheck` | `turbo run typecheck` — `tsc --noEmit` partout |
| `pnpm lint` | `turbo run lint` |
| `pnpm --filter @velum/valuation test` | tests d'un seul package |
| `pnpm --filter velum-mobile build:web` | export web statique |

### Tests

Chaque package embarque ses tests Vitest à côté du code (`*.test.ts`). Les plugins de domaine sont testés **sans réseau** : `VisionModel`, `Transport` et les horloges sont injectés (fakes déterministes). Le bootstrap du moteur de valorisation est seedé (`mulberry32`) — les intervalles de confiance sont rejouables à l'identique.

## Identité visuelle

- **Sceau bordeaux / or** sur fond sombre (`#1a0d10`) — l'app est en `userInterfaceStyle: dark`.
- **Vidéo d'intro** : `apps/mobile/assets/brand/velum-intro.mp4` (jouée via `expo-video` au premier lancement, image fixe `splash-still.png` en écran de démarrage).
- ⚠️ **NOTE — assets définitifs à déposer** : l'icône actuelle (`assets/brand/icon-provisional.png`) est un **frame provisoire extrait de la vidéo**. Avant soumission aux stores, déposer l'export final du logo en `apps/mobile/assets/brand/logo.png` ainsi que les icônes définitives (icône iOS, adaptive icon Android, favicon), puis mettre à jour les chemins dans `app.config.ts`.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Schéma macro, parcours cœur, pipeline de reconnaissance à étages, moteur de valorisation, feature flags |
| [docs/DATABASE.md](./docs/DATABASE.md) | Schéma Postgres, RLS, triggers, quota freemium (`consume_scan`), Storage, scalabilité |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Checklist complète soumission App Store / Play Store 2026, EAS, RevenueCat, Supabase |
| [docs/PRIVACY.md](./docs/PRIVACY.md) | Politique de confidentialité RGPD (à publier sur URL publique) |
| [docs/DEMO_ACCOUNT.md](./docs/DEMO_ACCOUNT.md) | Compte démo reviewers + notes de revue stores |
| [AGENTS.md](./AGENTS.md) | Instructions pour agents de code (conventions, pièges, checklist nouveau domaine) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Workflow Git, conventions de commit, ajout de sources et de domaines |

## Principes non négociables

1. **Jamais de fausse certitude** — la confiance (0..1) est toujours affichée ; sous 0,35, bascule en saisie assistée.
2. **Estimation indicative** — jamais une expertise légale ni un conseil d'investissement ; les `disclaimers` sont obligatoires sur chaque fiche.
3. **Aucun secret côté client** — les clés (LLM, catalogues, prix, FX, Qdrant) vivent uniquement dans les Edge Functions Supabase.
4. **Accessibilité** — mode senior (gros boutons, contraste renforcé), VoiceOver/TalkBack testés (European Accessibility Act).
