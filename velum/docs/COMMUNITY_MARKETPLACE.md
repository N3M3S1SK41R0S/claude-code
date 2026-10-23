# VELUM — Plateformes d'échange et de vente (communauté à séquestre)

> Issu d'une session **grill-me** (interview relentless) — décisions verrouillées
> par Pierre, juillet 2026, complétées en **octobre 2026** par les plateformes
> **par catégorie** (vente ET échange), l'anonymat, le commissionnement et la
> certification par un expert. Accès **Platine uniquement**. Les rails d'argent
> réels (Stripe Connect) et le KYC/AML restent à câbler avec les identifiants du
> propriétaire : le flux applicatif complet est en place, la capture / libération
> des fonds est l'unique point d'intégration stubbé (marqué **STRIPE** dans le SQL).
>
> Sources de vérité : règles pures `packages/config/src/marketplace.ts` (répliquées
> à l'identique en SQL), contrats `packages/core/src/market.ts` et `items.ts`,
> schéma `supabase/migrations/20261023100000…100400_*.sql`, client
> `packages/api-client/src/marketplace.ts`. Tests : `supabase/tests/features/marketplace_checks.sql`.

## 1. Décisions verrouillées

1. **Anonymat pair-à-pair** : l'adresse réelle n'est jamais montrée à l'autre
   partie (étiquette d'expédition masquée, façon Vinted/eBay). VELUM, lui, détient
   les identités vérifiées (KYC) pour le séquestre et l'AML. Dans l'application,
   l'autre partie n'apparaît que sous un **pseudonyme** (§4).
2. **Deux rails logistiques selon le montant** :
   - **≤ 500 €** : étiquette masquée simple ; le séquestre couvre « objet non
     conforme ». Une expertise reste possible **sur accord des deux parties**.
   - **> 500 €** : l'**expert / coffre partenaire devient le tiers de confiance** —
     il **authentifie**, puis l'objet circule assuré (remise contre signature).
3. **Certification AVANT publication au-delà du seuil** : toute annonce dont la
   **valeur de référence = max(prix demandé ou valeur déclarée, dernière
   estimation VELUM)** dépasse **strictement 500 €** est retenue en
   `pending_certification` jusqu'à la décision de l'expert ; un faux n'atteint
   **jamais** le catalogue. Badge « **authentifié VELUM** » une fois certifiée.
   Sous-déclarer ne contourne pas le seuil : l'estimation compte.
4. **Libération du séquestre automatique à J+X après livraison prouvée** (suivi
   transporteur ; remise contre signature pour le high-value), **sauf litige**.
   X = `escrow_release_days()` = 5 jours. Le silence de l'acheteur ne bloque pas
   le vendeur ; le faux « non reçu » est cassé par la preuve de remise.
5. **Commission dégressive (5 % → 2 %) prélevée à la conclusion**, jamais à la
   mise en ligne ; taux **figé** (sur l'annonce à sa création, sur la commande à
   l'achat, sur l'échange à l'acceptation).

### Décisions tranchées en octobre 2026

| Question | Décision |
|---|---|
| Frais du rail high-value | **Vendeur** quand la certification est imposée par le seuil (`defaultCertificationFeePayer('threshold')`) ; **partagés** sur accord mutuel (`'split'`, moitié arrondie au centime pour le propriétaire de l'objet) ; le demandeur peut proposer `seller`/`buyer`, l'autre partie accepte les termes. |
| Commission d'un échange | Chaque partie paie **son** taux dégressif sur la **valeur déclarée de l'objet qu'elle cède** (symétrique d'une vente). La **soulte n'est pas commissionnée**. |
| Soulte | Bornée : `|soulte| ≤ max(valeurs déclarées)` — un échange porte d'abord sur des biens (sinon : vente déguisée hors commission). |
| Réservation | Une annonce est réservée dès le **paiement capturé** (`funds_held`) ou l'**échange accepté** — premier payé, premier servi ; une commande non payée ne bloque personne. |
| Attestation de livraison | **Acheteur ou transporteur** uniquement (`record_order_delivery`), jamais le vendeur — sinon il déclencherait lui-même l'auto-libération des fonds. |
| Refus de l'expert | Annonce **non publiée** (retour en brouillon), commande annulée (remboursement **STRIPE**), échange annulé. |
| Publication | Le **serveur** décide : une annonce créée sans statut naît `active`, ou `pending_certification` si le seuil l'exige. Le client ne déclare jamais un badge ni un taux. |

## 2. Plateformes par catégorie

Une annonce (`listings`) porte une **nature** : `sale`, `exchange` ou
`sale_or_exchange`, une **description** et des **souhaits d'échange** (textes
publics **expurgés** des coordonnées à l'écriture), dans l'une des cinq
catégories (`domain` : vin, pièce, art, timbre, montre).

Le **catalogue** (`market_catalogue`) filtre par catégorie, mode (vente :
`sale` + `sale_or_exchange` ; échange : `exchange` + `sale_or_exchange`),
texte (titre + description + souhaits, chaque mot requis, **insensible à la
casse et aux accents** via `unaccent`), fourchette de prix, certifiées
seulement, inclusion de mes annonces, tri (récent, prix ↑, prix ↓) et limite
bornée (1..100, défaut 50). Seules les annonces `active` et non réservées y
figurent.

Cycle d'une annonce :

```
draft ⇄ active ⇄ pending_certification          (serveur : seuil de certification)
  │        │  └─► sold        (libération du séquestre d'une commande)
  │        └────► exchanged   (échange conclu)
  └──────────────► withdrawn  (vendeur, hors transaction en cours)
```

- Le vendeur ne peut ni passer une annonce en `sold`/`exchanged`, ni modifier
  statut, prix ou nature d'une annonce **engagée** (commande payée ou échange
  accepté en cours), ni supprimer une annonce ayant un historique de transactions.
- Une **nouvelle estimation** au-delà du seuil fait repasser une annonce publiée
  non certifiée en `pending_certification` (le vendeur est notifié).
- Un objet engagé dans une transaction en cours ne peut pas être supprimé ;
  hors transaction, sa suppression **détache** ses annonces (retirées si
  ouvertes), propositions et certifications : l'historique de l'autre partie
  (commande, registre) est conservé. La suppression de compte (RGPD) purge tout.

## 3. Machines à états

### 3.1 Vente (`orders`, séquestre)

```
pending_payment ─► funds_held ─► shipped ─► released      (heureux)
      │               │  │          └─► disputed ─► released | refunded (arbitrage)
      └► cancelled ◄──┘  └─► disputed
```

| Transition | Acteur |
|---|---|
| `pending_payment → funds_held` | acheteur (**STRIPE** capture) — refusée si l'annonce a été réservée entre-temps |
| `pending_payment / funds_held → cancelled` | acheteur ou vendeur (avant expédition) |
| `funds_held → shipped` | vendeur, **suivi requis**, **bloquée tant qu'une certification est ouverte** |
| `funds_held / shipped → disputed` | acheteur |
| `shipped → released` | acheteur, ou système (auto-libération `release_due_orders`, **STRIPE** payout) |
| `disputed → released / refunded` | système (`resolve_dispute`, service_role) |

Prix, commission et parties sont **figés** (privilèges de colonnes + trigger).

### 3.2 Échange (`exchange_proposals`)

```
proposed ─► accepted ─► awaiting_certification ─► shipping ─► completed
   │            │               │       ▲            │  └─► disputed ─► completed | cancelled
   ├► declined  │               │       └────────────┤        (arbitrage)
   ├► withdrawn └───────────────┴──► cancelled ◄─────┘ (avant toute expédition)
   └► expired
```

| Transition | Acteur |
|---|---|
| `proposed → accepted / declined` | destinataire (vendeur de l'annonce) |
| `proposed → withdrawn` | auteur de la proposition |
| `proposed → expired` | système (`expire_stale_exchanges`, 7 jours) |
| `accepted → awaiting_certification / shipping` | système, immédiatement : certification exigée ou non |
| `awaiting_certification → shipping` | système, quand toutes les certifications demandées sont obtenues |
| `shipping → awaiting_certification` | système, accord mutuel conclu **avant toute expédition** |
| `accepted / awaiting_certification / shipping → cancelled` | une partie **avant toute expédition** ; système si l'expert refuse |
| `shipping → completed` | une partie, quand **les deux réceptions** sont confirmées ; système (`complete_due_exchanges`) J+X après livraison des **deux** colis |
| `shipping → disputed` | une partie (motif requis) |
| `disputed → completed / cancelled` | système (`resolve_exchange_dispute`) |

À l'acceptation : commissions **figées**, autres propositions en attente sur
l'annonce **déclinées**, propositions offrant les mêmes objets ailleurs
**retirées**, commandes non payées annulées, annonce **réservée**. Chacun ne
déclare que **son** envoi et ne confirme que la réception de l'objet **de
l'autre** (une fois expédié). À la conclusion : annonce `exchanged`, annonce
éventuelle de l'objet reçu en contrepartie retirée.

## 4. Anonymat

- **Pseudonyme** `Collectionneur XXXX` (`market_aliases`) : suffixe hexadécimal
  **aléatoire** (jamais dérivé de l'uuid), stable, unique, attribué à
  l'inscription. La table de correspondance n'est lisible que pour sa propre ligne.
- Le **catalogue n'est plus lisible en direct** (policy `listings_select_active`
  supprimée) : `market_catalogue()` ne renvoie ni `seller_id` ni `item_id`.
- `orders.buyer_id/seller_id`, `disputes.opened_by`, `exchange_proposals`
  (`proposer_id`, `recipient_id`, `offered_item_id`), `certification_requests`
  (`item_id`, `owner_id`, `requested_by`, `counterparty_id`) et
  `market_messages.author_id` : **privilèges de colonnes retirés** aux clients.
  Les vues de l'appelant (`my_market_orders`, `my_exchanges`,
  `my_certifications`, `thread_messages`) renvoient `role`,
  `counterparty_alias`, `mine`… et l'identifiant du seul utilisateur courant.
- **Masquage des coordonnées** (`redact_contact_info`, réplique exacte de
  `redactContactInfo`) : e-mails (y compris « arobase »), téléphones, URL et
  domaines, IBAN, pseudos de réseaux sociaux, adresses postales → jeton
  « [coordonnées masquées] ». Appliqué à l'écriture aux descriptions, souhaits,
  titres publics, messages d'échange, messages des fils et motifs de litige.
- **Messagerie** (`market_messages`) : un fil par commande ou échange, lu et
  alimenté par les **seules parties**, immuable, purgé avec la transaction.

## 5. Certification par un expert

| Motif | Qui demande | Statut initial | Frais |
|---|---|---|---|
| `threshold` | ouverte **d'office** par le serveur (annonce au-delà du seuil, ou objet d'un échange accepté au-delà du seuil) ; relançable par le propriétaire | `requested` | propriétaire de l'objet |
| `mutual_agreement` | une partie d'une **commande** (avant expédition) ou d'un **échange** (avant toute expédition ; l'objet certifié est celui que le demandeur **reçoit**) | `awaiting_agreement` → l'autre partie accepte (`requested`) ou refuse (`cancelled`) | partagés par défaut |
| `voluntary` | le propriétaire, sur sa propre annonce (badge) | `requested` | propriétaire |

Cycle : `awaiting_agreement → requested → in_review → certified | rejected`,
`cancelled` avant la décision (refus de l'accord, retrait par le demandeur,
abandon d'une certification de seuil d'annonce ⇒ annonce en brouillon ; une
certification de seuil d'**échange** ne s'annule qu'en annulant l'échange).
L'expert partenaire agit via des fonctions **service_role** :
`assign_certification_expert(id, frais)` puis
`decide_certification(id, certifié, rapport, avis, frais)` — comme
`resolve_dispute`. Une certification obtenue **suit l'objet** : une nouvelle
annonce du même objet par le même propriétaire naît certifiée.

## 6. Commissionnement transparent

- **Vente** : `saleBreakdown` — commission = prix × taux du vendeur (figé),
  prélevée **à la libération** ; versement net au vendeur.
- **Échange** : `exchangeCommission` — chaque partie, sur l'objet qu'elle cède.
- **Registre** `platform_ledger` (lecture : le membre concerné uniquement),
  alimenté par triggers, idempotent (`member_id, kind, source_key`) :
  `commission`, `certification_fee`, `payout` (net de vente, soulte reçue).
- `my_commission_summary()` : taux actuel, ventes conclues, totaux du registre
  (`fetchCommissionSummary()` côté client).

## 7. Surface API

Client : `MarketplaceRepo` (`@velum/api-client`) — contrat inchangé, toutes les
méthodes câblées sur les RPC ci-dessous.

| Lecture | Action (client) | Système (service_role) |
|---|---|---|
| `market_catalogue`, `member_reputation(alias)` *(Platine)* | `market_buy`, `advance_market_order`, `open_order_dispute` | `assign_certification_expert`, `decide_certification` |
| `my_market_orders`, `my_exchanges`, `my_certifications` | `propose_exchange`, `respond_exchange`, `withdraw_exchange`, `cancel_exchange`, `ship_exchange`, `confirm_exchange_receipt`, `dispute_exchange` | `record_order_delivery`, `record_exchange_delivery` (transporteur) |
| `thread_messages`, `my_market_alias`, `my_commission_summary` | `request_certification`, `respond_certification`, `cancel_certification`, `send_market_message` | `resolve_dispute`, `resolve_exchange_dispute`, `release_due_orders`, `expire_stale_exchanges`, `complete_due_exchanges` |

Codes d'erreur SQL → `VelumError` : `P0001` (règle métier) → `INVALID_INPUT`
avec le motif serveur en français ; `VL402` → `PLAN_REQUIRED` ;
`VL401`/`42501` → `UNAUTHORIZED` ; panne réseau / service →
`SOURCE_UNAVAILABLE`. Un refus n'est jamais présenté comme une panne.

Planification (`20261023100400_market_cron.sql`, gardée par pg_cron) : toutes
les heures, `expire_stale_exchanges`, `complete_due_exchanges`,
`release_due_orders`.

## 8. Intégrations externes à câbler (hors périmètre code, besoin comptes)

| Brique | Fournisseur pressenti | Rôle |
|---|---|---|
| Séquestre & paiements | **Stripe Connect** (comptes vendeurs) | capture, hold, release, split commission, soulte |
| KYC / AML | prestataire d'identité | vérification vendeurs, conformité DSP2 |
| Étiquettes masquées | transporteur (Chronopost/Mondial Relay…) | adresses masquées, suivi, signature → `record_*_delivery` |
| Réseau d'experts | partenaires numismates/œno/phila/horlogers | `assign_certification_expert` / `decide_certification`, rapports en Storage privé |

## 9. Reste-t-il à décider ?

- Réputation → module-t-elle le taux de commission ou seulement les privilèges ?
  (Aujourd'hui : signaux objectifs affichés, taux piloté par le volume de ventes.)
- Arbitrage des litiges ≤ 500 € (support humain sur pièces vs remboursement
  automatique sur retour tracké) ? Les fonctions d'arbitrage existent
  (`resolve_dispute`, `resolve_exchange_dispute`), l'outil back-office non.
- Les échanges conclus doivent-ils compter dans le palier de commission
  (aujourd'hui : ventes conclues uniquement) ?
- Transfert automatique de l'objet reçu dans la collection du destinataire
  (aujourd'hui : à ressaisir par le scan).
