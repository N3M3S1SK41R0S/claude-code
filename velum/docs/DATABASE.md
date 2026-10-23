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
| `plan` | `text` | `free`, `premium`, `gold`, `platine` — écrit par le **serveur seul** (`revenuecat-webhook`, service_role) |
| `expo_push_token` | `text` null | jeton de notification push |
| `created_at` | `timestamptz` | |

RLS : `select/update` où `id = auth.uid()`. Création automatique par trigger sur `auth.users`. Privilèges de colonnes (`20261023130000_profiles_plan_guard.sql`) : le client ne modifie que `display_name`, `locale`, `a11y_mode`, `expo_push_token` (ni INSERT ni DELETE) ; le trigger `profiles_guard_plan` refuse en outre tout changement d'offre hors acteur de confiance. Fin d'abonnement Platine (`profiles_after_plan_change`) : annonces publiées ou en attente de certification retirées (hors transaction en cours — retirées à leur tour, même notification, si la transaction se termine sans vente : `_market_recheck_freed_listings`), propositions d'échange en attente retirées, membre notifié.

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

RLS : **lecture** via l’item parent ; **aucune écriture client** (`20261023131000_valuations_server_writes.sql`) — écrites par l’Edge Function `valuate` (service-role, après contrôle de propriété de l’objet par le client utilisateur) et par `price-cron`. Elles fondent le seuil de certification des plateformes : jamais falsifiables par le propriétaire.

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
| `ask_price` / `currency` | `numeric` / `text` | prix (vente) ou valeur déclarée, **1 € minimum** ; devise **`EUR` uniquement** (trigger à la création, à la publication et au changement de devise ; commandes : `set_order_defaults` ; échanges : CHECK `exchange_proposals_currency_eur`) |
| `kind` | `text` CHECK | `sale`, `exchange`, `sale_or_exchange` (défaut `sale`) |
| `status` | `text` CHECK, défaut `active` | `draft`, `pending_certification`, `active`, `sold`, `exchanged`, `withdrawn` — décidé par le serveur |
| `title` / `domain` | dénormalisés de l'item | titre **expurgé** des coordonnées |
| `description` / `exchange_wishes` | `text` ≤ 4000 / ≤ 1000 | **expurgés** à l'écriture |
| `commission_rate` | `numeric(5,4)` | figé à la création (`commission_rate_for`) |
| `expert_appraisal_required` / `expert_appraisal_ref` | `boolean` / `text` | seuil de certification ; rapport posé **uniquement** par `decide_certification` (badge « authentifié VELUM ») |

RLS : lecture/écriture par le vendeur (insertion et (re)publication réservées Platine). **Une seule annonce ouverte** (`draft`, `pending_certification`, `active`) **par objet** : index unique `listings_one_open_per_item_idx`. Triggers : `enforce_listing_rules` (statuts réservés, date de publication posée par le serveur, termes figés pendant une transaction, prix plancher, euro, objet déjà cédé refusé, seuil = max(prix, plus haute estimation VELUM des 18 derniers mois — à défaut, dernière estimation passée) ou refus d'expert antérieur ; à toute (re)publication ou réouverture par le vendeur, titre expurgé et catégorie recopiés de l'objet, puis référence de certification recalculée), `listing_after_change` (demande de certification d'office, au titre et à la catégorie actuels de l'objet ; commandes non payées annulées dès que l'annonce est suspendue, dépubliée, close ou que ses termes changent ; propositions/certifications closes à la fin de vie), `guard_listing_delete` (historique : transactions ou expertise engagée/décidée), `listings_redact_texts`. Une estimation (`valuations`) au-delà du seuil fait repasser l'annonce en `pending_certification`.

#### `orders` / `disputes`
Vente sous séquestre (`pending_payment → funds_held → shipped → released`, branches `disputed`, `refunded`, `cancelled`). Lecture client limitée aux colonnes non identifiantes (`buyer_id`, `seller_id`, `disputes.opened_by` retirés) ; mise à jour limitée à `escrow_state`, `carrier`, `tracking_number`, `delivered_at` (livraison attestée par l'acheteur ou le transporteur). Suivi (`carrier`, `tracking_number`) écrit par le **seul vendeur, à l'expédition** (`funds_held → shipped`), jamais réécrit : transporteur de `market_carriers()` ou null, numéro `[A-Z0-9-]` de 4 à 40 caractères (`market_normalize_*`). Une seule commande non payée par acheteur et annonce ; création refusée sous le prix plancher ou pour un objet dont la dernière décision d'expert est un refus ; l'annonce est réservée au paiement capturé, qui revérifie que l'annonce est toujours publiée, au même prix, en euros, ouverte à la vente, et que l'objet n'a pas été refusé par un expert. Rattrapage des suivis 0006 (texte libre) : transporteur hors liste effacé, numéro non conforme effacé avant expédition et masqué après. Expédition bloquée tant qu'une certification est ouverte sur la commande ou sur son annonce (`has_open_certification` ; pour un échange : l'échange, l'annonce visée et les annonces de l'objet offert par l'auteur ; une demande « seuil » d'annonce devenue sans objet — objet certifié depuis — ne compte pas). Commande **payée** annulée ou remboursée (une commande jamais payée ne libère rien) alors que l'objet a été refusé par un expert : ses annonces non réservées passent en brouillon, sans référence de certification (`order_after_change` ; `exchange_after_change` pour un échange annulé). Sinon, les annonces publiées libérées sont réévaluées (`_market_recheck_freed_listings`) : seuil recalculé ; référence conservée si elle vient d'une décision d'expert (`certified`) sur l'objet du vendeur, reprise de la certification qui suit l'objet (`_market_item_certification_ref`, obtenue pendant la réservation), effacée après un refus ou sans décision d'expert. `disputes` : **aucune écriture client** — ouverture par `open_order_dispute` (litige toujours `open`, sur une commande en litige, trigger `disputes_set_defaults`), arbitrage par `resolve_dispute`.

#### `exchange_proposals`
Proposition d'échange : annonce visée, proposeur, destinataire (= vendeur), objet offert (ni déjà cédé, ni refusé par un expert), valeurs déclarées (> 0), soulte (bornée par la plus grande valeur), message expurgé, suivi au format contrôlé (comme `orders`), acceptation réservée Platine, `state` (`proposed`, `accepted`, `declined`, `withdrawn`, `expired`, `awaiting_certification`, `shipping`, `completed`, `disputed`, `cancelled`), `certification_required`, commissions figées par partie (`*_commission_rate`, `*_commission`), suivi / livraison / réception de chaque côté, litige, `expires_at` (7 jours). Machine à états par trigger (`enforce_exchange_transition`), effets par `exchange_after_change`. Une seule proposition en attente par membre et par annonce. RLS : parties ; colonnes identifiantes non lisibles.

#### `certification_requests`
Demande de certification par un expert : contexte (`listing_id` / `order_id` / `exchange_id`), objet (`item_id`, titre, domaine), `owner_id`, `requested_by`, `counterparty_id` (partie qui doit accepter), `reason` (`threshold`, `mutual_agreement`, `voluntary`), `status` (`awaiting_agreement`, `requested`, `in_review`, `certified`, `rejected`, `cancelled`), `fee_payer` (`seller`, `buyer`, `split`), `fee_amount`, `counterparty_agreed`, `report_ref`, `expert_note`, `decided_at`. Au plus une demande ouverte par annonce seule, par commande, par objet d'échange ; pendant une expertise de l'annonce seule, l'accord mutuel sur le même objet (commande, échange) est refusé. Décision : `decide_certification` (service_role). Une certification n'est réutilisée par une nouvelle annonce du même objet que si c'est la **dernière décision** d'expert sur l'objet **et** que son titre public et sa catégorie sont inchangés ; un **refus**, quel que soit le motif ou le contexte, annule toute transaction non expédiée sur l'objet (commandes `pending_payment`/`funds_held`, acheteur prévenu ; échanges acceptés sans envoi, parties prévenues), dépublie l'objet (toutes ses annonces ouvertes), efface la référence d'une certification antérieure de ses annonces non closes et reste mémorisé (`_market_item_rejected`) ; une transaction déjà expédiée (ou en litige) reste en place, l'acheteur ou l'autre partie de l'échange est prévenu, et l'annonce qu'elle réserve n'est pas modifiée jusqu'à sa fin. Le titre d'une demande d'annonce (« seuil », volontaire) est celui de l'objet au moment de la demande (titre expurgé et catégorie actuels, même renommé depuis la publication) ; il n'est jamais réécrit à la décision. Une **certification** qui suit l'objet publie ses annonces en `pending_certification` sans référence (référence reprise, statut recalculé), puis annule ses autres demandes « seuil » de l'annonce seule encore ouvertes (jamais facturées) ; une telle demande restée ouverte sur un objet certifié ne bloque pas l'expédition (`has_open_certification`). « Dernière décision » : ordre déterministe (`decided_at`, `created_at`, refus d'abord à égalité, `id`).

#### `market_aliases`
Pseudonyme `Collectionneur XXXX` par membre (aléatoire, stable, unique) ; attribué à l'inscription. RLS : sa propre ligne uniquement.

#### `market_messages`
Fil anonymisé d'une commande ou d'un échange (`thread_kind`, `thread_id`, `author_id` non lisible, `body` ≤ 2000 expurgé, `redacted`). RLS : parties ; écriture via `send_market_message` ; purge avec la transaction.

#### `platform_ledger`
Registre transparent : `member_id`, `kind` (`commission`, `certification_fee`, `payout`), `amount`, `rate`, `base_amount`, références commande / échange / certification, `source_key` (idempotence). Alimenté par triggers (libération, échange conclu, décision d'expert). RLS : le membre concerné.

#### Rattrapages des données 0006
Migration `20261023100100`, avant ses index et garde-fous : **un seul paiement capturé par objet** (la commande expédiée ou en litige, sinon le plus ancien paiement ; les autres `funds_held → cancelled`, remboursement **STRIPE**, acheteur et vendeur prévenus) ; annonces hors euro ou sous le plancher retirées, sauf transaction en cours ; une seule annonce ouverte par objet (`listings_one_open_per_item_idx` : paiement capturé, puis annonce publiée portant une commande en attente, puis publiée, puis en attente de certification, puis la plus récente) ; une seule commande `pending_payment` par acheteur et annonce, la plus récente (`orders_one_pending_per_buyer_idx`) ; commandes `pending_payment` d'une annonce non publiée, hors euro ou sous le plancher annulées, acheteur prévenu — la capture (`enforce_escrow_transition`) exige de toute façon l'euro et le prix plancher. En fin de migration, après les triggers de `certification_requests`, sur les annonces ouvertes **non engagées** : annonces publiées ou en attente de certification d'un membre dont l'offre Platine a expiré sous 0006 **retirées** (comme à la fin d'abonnement, vendeur et acheteurs prévenus ; jamais suspendues ni soumises à une expertise à ses frais), puis `expert_appraisal_ref` saisi par le vendeur sous 0003/0006 sans décision d'expert effacé, puis toute annonce publiée non certifiée au-delà du seuil (prix ou estimation VELUM, repli compris) suspendue en `pending_certification` — contenu public de l'objet recopié, demande « seuil » ouverte, commandes non payées annulées, vendeur et acheteurs prévenus. Une annonce engagée poursuit sa transaction. Sans effet sur une base vierge, idempotent ; éprouvé par `supabase/tests/upgrade/legacy_0006_*.sql` (base intermédiaire de `run-local.sh`, contrôles U1 à U10).

#### Fonctions RPC
- **Lecture** : `market_catalogue(...)` et `member_reputation(alias)` (Platine), `market_listing(id)` (annonce par identifiant, mêmes colonnes que le catalogue ; hors catalogue — réservée, suspendue, close — pour ses seules parties), `my_market_orders`, `my_exchanges` (avec `listing_certified` : l'objet de l'annonce est déjà certifié — référence de l'annonce ou certification qui suit l'objet ; pour un échange, `offered_item_certified` : l'objet offert est déjà certifié, `offered_item_id` : l'objet offert, pour l'auteur seulement, et `shipment_blocked` : une expertise en cours bloque l'expédition, `has_open_certification` — y compris sur l'annonce de l'autre partie), `my_certifications`, `thread_messages`, `my_market_alias`, `my_commission_summary` (ventes retenues pour le palier : commandes libérées ≥ 20 €, 3 au plus par acheteur — `commission_qualifying_sales`).
- **Actions client** : `market_buy`, `advance_market_order`, `open_order_dispute`, `propose_exchange`, `respond_exchange`, `withdraw_exchange`, `cancel_exchange`, `ship_exchange`, `confirm_exchange_receipt`, `dispute_exchange`, `request_certification`, `respond_certification`, `cancel_certification`, `send_market_message`.
- **Système (service_role)** : `assign_certification_expert`, `decide_certification`, `record_order_delivery`, `record_exchange_delivery`, `resolve_dispute`, `resolve_exchange_dispute`, `release_due_orders`, `expire_stale_exchanges`, `complete_due_exchanges` (cron horaire `velum-market-cron`).
- **Utilitaire** : `redact_contact_info(text)` — réplique exacte de `redactContactInfo` (`@velum/config`) ; `market_carriers()`, `market_normalize_carrier(text)`, `market_normalize_tracking(text)` (répliqués par `MARKET_CARRIERS`, `normalizeCarrier`, `normalizeTrackingNumber` dans `@velum/api-client`).

Codes d'erreur : `P0001` règle métier, `VL401` session/partie, `VL402` offre Platine requise, `42501` droit insuffisant ; `22003` (montant hors `numeric(14,2)`) et `22001` (texte trop long) sont des refus de saisie (`INVALID_INPUT`), jamais des pannes.

### `notifications`
Notifications in-app créées par les alertes et protégées par `owner_id = auth.uid()`.
