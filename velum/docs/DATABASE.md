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

### Plateformes d'échange et de vente (Platine)

Spécification fonctionnelle : [COMMUNITY_MARKETPLACE.md](./COMMUNITY_MARKETPLACE.md). Migrations `0003`, `0004`, `0006` puis `20261023100000…100400_market_*.sql`. Principe : **aucune écriture directe** des tables d'échange, de certification et de messagerie par le client — uniquement des RPC qui vérifient l'acteur ; les **identifiants de l'autre partie** ne sont jamais lisibles (privilèges de colonnes + vues anonymisées).

#### `listings`
Annonce d'un objet, par catégorie.

| Colonne | Type | Notes |
|---|---|---|
| `id` PK · `item_id` FK → `items` · `seller_id` FK → `profiles` | | jamais exposés aux autres membres ; `seller_id` en cascade ; `item_id` **null** si l'objet est supprimé (annonce détachée et retirée, historique des transactions conservé) |
| `ask_price` / `currency` | `numeric` / `text` | prix (vente) ou valeur déclarée (échange, > 0) |
| `kind` | `text` CHECK | `sale`, `exchange`, `sale_or_exchange` (défaut `sale`) |
| `status` | `text` CHECK, défaut `active` | `draft`, `pending_certification`, `active`, `sold`, `exchanged`, `withdrawn` — décidé par le serveur |
| `title` / `domain` | dénormalisés de l'item | titre **expurgé** des coordonnées |
| `description` / `exchange_wishes` | `text` ≤ 4000 / ≤ 1000 | **expurgés** à l'écriture |
| `commission_rate` | `numeric(5,4)` | figé à la création (`commission_rate_for`) |
| `expert_appraisal_required` / `expert_appraisal_ref` | `boolean` / `text` | seuil de certification ; rapport posé **uniquement** par `decide_certification` (badge « authentifié VELUM ») |

RLS : lecture/écriture par le vendeur (insertion réservée Platine). Triggers : `enforce_listing_rules` (statuts réservés, termes figés pendant une transaction, seuil = max(prix, estimation)), `listing_after_change` (demande de certification d'office, propositions/commandes/certifications closes à la fin de vie), `guard_listing_delete`, `listings_redact_texts`. Une estimation (`valuations`) au-delà du seuil fait repasser l'annonce en `pending_certification`.

#### `orders` / `disputes`
Vente sous séquestre (`pending_payment → funds_held → shipped → released`, branches `disputed`, `refunded`, `cancelled`). Lecture client limitée aux colonnes non identifiantes (`buyer_id`, `seller_id`, `disputes.opened_by` retirés) ; mise à jour limitée à `escrow_state`, `carrier`, `tracking_number`, `delivered_at` (livraison attestée par l'acheteur ou le transporteur). Une seule commande non payée par acheteur et annonce ; l'annonce est réservée au paiement capturé. Expédition bloquée tant qu'une certification est ouverte.

#### `exchange_proposals`
Proposition d'échange : annonce visée, proposeur, destinataire (= vendeur), objet offert, valeurs déclarées (> 0), soulte (bornée par la plus grande valeur), message expurgé, `state` (`proposed`, `accepted`, `declined`, `withdrawn`, `expired`, `awaiting_certification`, `shipping`, `completed`, `disputed`, `cancelled`), `certification_required`, commissions figées par partie (`*_commission_rate`, `*_commission`), suivi / livraison / réception de chaque côté, litige, `expires_at` (7 jours). Machine à états par trigger (`enforce_exchange_transition`), effets par `exchange_after_change`. Une seule proposition en attente par membre et par annonce. RLS : parties ; colonnes identifiantes non lisibles.

#### `certification_requests`
Demande de certification par un expert : contexte (`listing_id` / `order_id` / `exchange_id`), objet (`item_id`, titre, domaine), `owner_id`, `requested_by`, `counterparty_id` (partie qui doit accepter), `reason` (`threshold`, `mutual_agreement`, `voluntary`), `status` (`awaiting_agreement`, `requested`, `in_review`, `certified`, `rejected`, `cancelled`), `fee_payer` (`seller`, `buyer`, `split`), `fee_amount`, `counterparty_agreed`, `report_ref`, `expert_note`, `decided_at`. Au plus une demande ouverte par annonce seule, par commande, par objet d'échange. Décision : `decide_certification` (service_role).

#### `market_aliases`
Pseudonyme `Collectionneur XXXX` par membre (aléatoire, stable, unique) ; attribué à l'inscription. RLS : sa propre ligne uniquement.

#### `market_messages`
Fil anonymisé d'une commande ou d'un échange (`thread_kind`, `thread_id`, `author_id` non lisible, `body` ≤ 2000 expurgé, `redacted`). RLS : parties ; écriture via `send_market_message` ; purge avec la transaction.

#### `platform_ledger`
Registre transparent : `member_id`, `kind` (`commission`, `certification_fee`, `payout`), `amount`, `rate`, `base_amount`, références commande / échange / certification, `source_key` (idempotence). Alimenté par triggers (libération, échange conclu, décision d'expert). RLS : le membre concerné.

#### Fonctions RPC
- **Lecture** : `market_catalogue(...)` et `member_reputation(alias)` (Platine), `my_market_orders`, `my_exchanges`, `my_certifications`, `thread_messages`, `my_market_alias`, `my_commission_summary`.
- **Actions client** : `market_buy`, `advance_market_order`, `open_order_dispute`, `propose_exchange`, `respond_exchange`, `withdraw_exchange`, `cancel_exchange`, `ship_exchange`, `confirm_exchange_receipt`, `dispute_exchange`, `request_certification`, `respond_certification`, `cancel_certification`, `send_market_message`.
- **Système (service_role)** : `assign_certification_expert`, `decide_certification`, `record_order_delivery`, `record_exchange_delivery`, `resolve_dispute`, `resolve_exchange_dispute`, `release_due_orders`, `expire_stale_exchanges`, `complete_due_exchanges` (cron horaire `velum-market-cron`).
- **Utilitaire** : `redact_contact_info(text)` — réplique exacte de `redactContactInfo` (`@velum/config`).

Codes d'erreur : `P0001` règle métier, `VL401` session/partie, `VL402` offre Platine requise, `42501` droit insuffisant.

### `notifications`
Notifications in-app créées par les alertes et protégées par `owner_id = auth.uid()`.
