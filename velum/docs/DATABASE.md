# Base de données VELUM (Supabase Postgres)

> **État** : les migrations (`supabase/migrations/`) sont en cours d'écriture dans un chantier parallèle. Ce document est le **contrat de schéma** qu'elles implémentent — il est aligné sur les miroirs TypeScript de `packages/core/src/items.ts` (source de vérité côté app, camelCase ↔ snake_case en base). Toute divergence entre migration et ce contrat doit être arbitrée en faveur de `items.ts` + ce document, ou ceux-ci mis à jour dans le même commit.

Convention générale : `id uuid primary key default gen_random_uuid()`, horodatages `timestamptz default now()`, données utilisateur protégées par **RLS** (activée sur toutes les tables), accès par `owner_id = auth.uid()` directement ou via l'item parent.

## 1. Tables

### `profiles`
Profil applicatif, 1-1 avec `auth.users`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id` (FK `on delete cascade`) |
| `display_name` | `text` null | |
| `locale` | `text` not null default `'fr'` | |
| `a11y_mode` | `boolean` not null default `false` | **Mode senior** : gros boutons, contraste renforcé, police majorée |
| `created_at` | `timestamptz` | |

RLS : `select/update` où `id = auth.uid()`. Création automatique par **trigger** sur `auth.users` (`handle_new_user`, `security definer`).

### `items`
Un objet de collection, tous domaines confondus.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `owner_id` | `uuid` FK → `auth.users` | index ; clé de partitionnement cible |
| `domain` | `text` CHECK in (`'wine'`,`'coin'`,`'art'`,`'stamp'`) | 4 modules à part entière |
| `title` | `text` null | libellé affiché |
| `attributes` | `jsonb` not null default `'{}'` | attributs structurés du domaine (millésime, atelier, n° catalogue…) |
| `confidence` | `numeric` null CHECK 0..1 | confiance d'identification |
| `acquired_at` | `date` null · `acquired_price` `numeric` null | suivi patrimonial |
| `condition` | `text` null | état/grade (« TTB », « MS65 », « neuf sans charnière »…) |
| `notes` / `storage_location` | `text` null | |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` maintenu par trigger `set_updated_at` |

RLS : CRUD complet où `owner_id = auth.uid()`.

### `item_media`
Photos d'un item — références Storage uniquement, jamais d'URL signée persistée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK · `item_id` FK → `items` `on delete cascade` | |
| `kind` | `text` CHECK in (`label`,`capsule`,`obverse`,`reverse`,`edge`,`front`,`back`,`signature`,`frame`,`detail`) | = `MediaRole` |
| `storage_path` | `text` not null | chemin dans le bucket `item-media` |
| `created_at` | `timestamptz` | |

RLS : via l'item parent (`exists (select 1 from items where items.id = item_id and items.owner_id = auth.uid())`).

### `analyses`
Fiches d'analyse produites par les moteurs (`zappa_vini`, `numis_v1`, `art_v1`, `phila_v1`).

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `engine` | `text` not null | nom + version du moteur |
| `payload` | `jsonb` not null | conforme à `packages/core/src/analysis/*.ts` (dont `uncertainties` jamais vide) |
| `created_at` | `timestamptz` | historisé — on n'écrase pas, on ajoute |

RLS : via l'item parent. Écriture par les Edge Functions (service role) et lecture par le propriétaire.

### `valuations`
Estimations historisées — jamais de mise à jour en place, une ligne par exécution du moteur §7.

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `central` | `numeric` not null | médiane pondérée, EUR |
| `ci80_low` / `ci80_high` / `ci95_low` / `ci95_high` | `numeric` not null | intervalles de confiance |
| `reliability` | `integer` CHECK 0..100 | score de fiabilité |
| `sources` | `jsonb` not null | `PriceObservation[]` conservées (traçabilité affichée) |
| `valued_at` | `timestamptz` not null default `now()` | axe temporel (graphique d'évolution, partitionnement cible) |

RLS : via l'item parent.

### `alerts`
| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK cascade | | |
| `type` | `text` CHECK in (`price_threshold`,`drink_window`,`opportunity`) | `drink_window` : déclenchée par la fenêtre de consommation ZAPPA (module 2) |
| `config` | `jsonb` not null default `'{}'` | seuils, direction… |
| `active` | `boolean` not null default `true` | |

RLS : via l'item parent. Évaluées par un job **pg_cron** qui insère dans `notifications`.

### `listings`
Marketplace — **phase 2** (`enableMarketplace: false`), table présente pour figer le contrat.

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK · `seller_id` FK → `auth.users` | | |
| `ask_price` `numeric` · `currency` `text` | | |
| `status` | `text` CHECK in (`draft`,`active`,`sold`,`withdrawn`) | |
| `created_at` | `timestamptz` | |

RLS : vendeur = `auth.uid()` pour l'écriture ; lecture publique uniquement des annonces `active` (quand la marketplace ouvrira).

### `notifications`
File de notifications utilisateur (alimentée par cron/alertes, consommée par l'app via Realtime).

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `owner_id` FK | | |
| `kind` | `text` | ex. `alert_fired`, `valuation_updated`, `drink_window` |
| `payload` | `jsonb` | contenu affichable (item, valeurs) |
| `read_at` | `timestamptz` null | non lu = null |
| `created_at` | `timestamptz` | |

RLS : `select/update(read_at)` où `owner_id = auth.uid()` ; insertion réservée au service role.

### `usage_counters`
Compteurs de consommation freemium — un enregistrement par utilisateur, par module et par semaine ISO.

| Colonne | Type | Notes |
|---|---|---|
| `owner_id` | `uuid` FK | PK composite (`owner_id`, `domain`, `week`) |
| `domain` | `velum_domain` | le quota gratuit est PAR module (5 scans/semaine) |
| `week` | `text` | semaine ISO `IYYY-IW` (`to_char(now(), 'IYYY-IW')`) |
| `scans` | `integer` not null default 0 | incrémenté par `consume_scan(p_domain)` |
| `updated_at` | `timestamptz` | |

RLS : lecture par le propriétaire ; **écriture uniquement via la fonction `consume_scan`** (aucun `insert/update` direct client).

## 2. Fonction `consume_scan` — quota freemium

RPC SQL `security definer`, appelée par l'Edge Function `recognize` **avant** tout appel LLM (le quota est appliqué côté serveur, jamais côté client) :

```sql
-- Contrat : consume_scan(p_plan text) returns boolean
-- 1. upsert du compteur (owner_id = auth.uid(), period = to_char(now(), 'YYYY-MM'))
-- 2. si plan = 'free' et scans_used >= 10  → retourne false (l'Edge Function
--    répond alors VelumError 'BUDGET_EXCEEDED' → écran d'upsell premium)
-- 3. sinon incrémente scans_used de façon atomique et retourne true
```

Les limites par plan sont celles de `PLAN_LIMITS` (`packages/config/src/index.ts`) : free = 5 scans/semaine **par module** (compteur `usage_counters(owner_id, domain, week)` en semaine ISO `IYYY-IW`) ; premium/gold/platine = illimité. Le carnet virtuel est réservé à Gold+, la valorisation continue et la marketplace communautaire à Platine (cf. `0003_marketplace_platine.sql` puis `0004_commission_degressive.sql` : commission **dégressive** de 5 % à 2 % selon les ventes conclues du vendeur — `commission_rate_for(seller)` figée sur l'annonce par trigger `before insert`, le client ne pouvant pas choisir son taux —, trigger d'expertise obligatoire > 500 €, insertion d'annonces réservée aux profils platine). Le plan effectif provient des entitlements RevenueCat (vérifiés serveur via webhook/API RevenueCat, pas sur la seule foi du client).

## 3. Triggers

| Trigger | Table | Rôle |
|---|---|---|
| `handle_new_user` | `auth.users` (after insert) | crée la ligne `profiles` (locale par défaut `fr`) |
| `set_updated_at` | `items` (before update) | maintient `updated_at = now()` |
| `enforce_media_quota` (optionnel) | `item_media` (before insert) | borne le nombre de médias par item (anti-abus Storage) |

## 4. Storage — bucket `item-media`

- Bucket **privé** ; chemins convention `"{owner_id}/{item_id}/{role}-{uuid}.jpg"`.
- Policies Storage alignées RLS : lecture/écriture/suppression uniquement si le premier segment du chemin = `auth.uid()`.
- Le client uploade directement (supabase-js), stocke le `storage_path` dans `item_media`, et affiche via **URL signée à courte durée** générée à la demande — jamais persistée.
- La suppression d'un item cascade sur `item_media` ; une purge périodique (cron) supprime les objets Storage orphelins.

## 5. Realtime & Cron

- **Realtime** : publication sur `notifications` (badge et toasts en direct) et `valuations` (rafraîchissement de la fiche après revalorisation).
- **pg_cron** (+ Vault pour les secrets appelés par les jobs) :
  - revalorisation périodique des items actifs (appel de l'Edge Function `valuate` par lots) ;
  - rafraîchissement des taux `FxRates` ;
  - évaluation des `alerts` → insertion `notifications` ;
  - purge Storage des médias orphelins et des comptes supprimés (voir [PRIVACY.md](./PRIVACY.md)).

## 6. Stratégie de scalabilité

1. **Index d'abord** : `items(owner_id, domain)`, `valuations(item_id, valued_at desc)`, `notifications(owner_id, read_at)` — suffisant jusqu'à plusieurs millions de lignes.
2. **Partitionnement par `owner_id`** (hash) sur `items` et `item_media` quand la volumétrie l'exige : toutes les requêtes app sont déjà filtrées par propriétaire, le pruning est naturel.
3. **Partitionnement temporel de `valuations`** (range sur `valued_at`, partitions mensuelles) : table à croissance la plus rapide (revalorisations cron) ; les vieilles partitions sont compressées/archivées, les graphiques long terme lisent des agrégats matérialisés (`valuations_monthly`).
4. `usage_counters` reste petite par construction (1 ligne/utilisateur/mois) ; purge des périodes > 24 mois.
5. Les payloads JSONB volumineux (`analyses.payload`, `valuations.sources`) restent en TOAST — ne pas les dupliquer dans des colonnes dérivées ; extraire en colonnes générées uniquement ce qui est filtré/trié.

## Validation locale sans Docker

Le harnais `supabase/tests/` rejoue tout le SQL sur un PostgreSQL 16 nu
(stub minimal des schémas `auth`/`storage` de la plateforme) :

```bash
sudo -u postgres bash supabase/tests/run-local.sh
```

Il applique `0001` + `0003` + `0004` + `seed.sql` puis `rls_checks.sql` — 10
vérifications de comportement : isolation RLS (items, profils, valuations),
quota freemium 5 scans/semaine **par module** puis illimité en premium,
marketplace réservée Platine (commission **dégressive** 5 % → 2 % figée par
trigger et non choisie par le client, trigger d'expertise obligatoire au-delà
de 500 €), cloisonnement storage par préfixe `uid/`, purge RGPD en cascade. La CI
(`velum-ci.yml`, job `sql`) l'exécute à chaque push. La migration `0002`
(pg_cron/pg_net) est volontairement hors périmètre du harnais : ces
extensions n'existent que sur la plateforme Supabase.
