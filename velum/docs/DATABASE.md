# Base de données VELUM (Supabase Postgres)

> **État** : ce document décrit le schéma appliqué par `supabase/migrations/`. Les miroirs TypeScript de `packages/core` et les migrations doivent évoluer dans le même commit.

Convention générale : `id uuid primary key default gen_random_uuid()`, horodatages `timestamptz default now()`, données utilisateur protégées par **RLS** sur toutes les tables, accès par propriétaire direct ou via l’item parent.

## 1. Tables

### `profiles`
Profil applicatif, 1-1 avec `auth.users`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id`, cascade |
| `display_name` | `text` null | |
| `locale` | `text` not null default `'fr'` | |
| `a11y_mode` | `boolean` not null default `false` | Mode senior |
| `plan` | `text` | `free`, `premium`, `gold`, `platine` |
| `created_at` | `timestamptz` | |

RLS : `select/update` où `id = auth.uid()`. Création automatique par trigger sur `auth.users`.

### `items`
Un objet de collection, tous domaines confondus.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `owner_id` | `uuid` FK → `profiles` | index ; cascade |
| `domain` | enum `velum_domain` (`wine`, `coin`, `art`, `stamp`, `watch`) | cinq modules à part entière |
| `title` | `text` null | libellé affiché |
| `attributes` | `jsonb` not null default `'{}'` | attributs structurés du domaine |
| `confidence` | `real` null CHECK 0..1 | confiance d’identification |
| `acquired_at` / `acquired_price` | `date` / `numeric` null | suivi patrimonial |
| `condition` | `text` null | état ou grade |
| `notes` / `storage_location` | `text` null | |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` maintenu par trigger |

RLS : CRUD complet où `owner_id = auth.uid()`.

### `item_media`
Photos d’un item — références Storage uniquement, jamais d’URL signée persistée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK · `item_id` FK → `items` cascade | |
| `kind` | `text` CHECK | `label`, `capsule`, `obverse`, `reverse`, `edge`, `front`, `back`, `signature`, `frame`, `detail`, `dial`, `caseback`, `movement`, `clasp` — aligné sur `MediaRole` |
| `storage_path` | `text` not null | chemin dans le bucket privé `item-media` |
| `created_at` | `timestamptz` | |

La migration `20260717161000_watch_media_roles.sql` ajoute explicitement les quatre rôles Montres. RLS : via l’item parent.

### `analyses`
Fiches d’analyse produites par les moteurs (`zappa_vini`, `numis_v1`, `art_v1`, `phila_v1`, `watch_v1`).

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `engine` | `text` not null | nom + version du moteur |
| `payload` | `jsonb` not null | conforme à `packages/core/src/analysis/*.ts` |
| `created_at` | `timestamptz` | historisé, jamais écrasé |

RLS : via l’item parent. Écriture par les Edge Functions et lecture par le propriétaire.

### `valuations`
Estimations historisées — une ligne par exécution du moteur.

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `central` | `numeric` not null | médiane pondérée, EUR |
| `ci80_low/high` / `ci95_low/high` | `numeric` not null | intervalles de confiance |
| `reliability` | `integer` CHECK 0..100 | score de fiabilité |
| `sources` | `jsonb` not null | observations conservées et attribuées |
| `valued_at` | `timestamptz` | axe temporel |

RLS : via l’item parent.

### `alerts`

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `type` | `text` CHECK | `price_threshold`, `drink_window`, `opportunity` |
| `config` | `jsonb` | seuils, direction |
| `active` | `boolean` | évaluée par le cron |

### `listings`
Marketplace communautaire : annonce, vendeur, prix demandé, devise et statut. Les transitions de commande et de séquestre sont validées côté serveur.

### `notifications`
Notifications in-app créées par les alertes et protégées par `owner_id = auth.uid()`.
