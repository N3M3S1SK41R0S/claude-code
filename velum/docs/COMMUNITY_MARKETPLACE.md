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
> schéma `supabase/migrations/20261023100000…100400_*.sql` et `20261023130000…132000_*.sql`
> (garde de l'offre, estimations serveur, paliers de commission), client
> `packages/api-client/src/marketplace.ts`. Tests : `supabase/tests/features/marketplace_checks.sql`,
> `marketplace_hardening_checks.sql` (contournements rejoués et refusés) et
> `supabase/tests/upgrade/legacy_0006_*.sql` (rattrapages des données 0006,
> rejoués par `run-local.sh` sur une base intermédiaire).

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
   **valeur de référence = max(prix demandé ou valeur déclarée, plus haute
   estimation VELUM des 18 derniers mois — à défaut, la dernière estimation
   passée, quel que soit son âge)** dépasse **strictement 500 €** est
   retenue en `pending_certification` jusqu'à la décision de l'expert ; un faux
   n'atteint **jamais** le catalogue. Badge « **authentifié VELUM** » une fois
   certifiée. Sous-déclarer ne contourne pas le seuil : l'estimation compte. Les
   estimations sont écrites par le **serveur seul** (`valuate` après contrôle de
   propriété, `price-cron`) ; une estimation basse postérieure (candidat
   trompeur soumis à `valuate`) ne masque pas une estimation haute récente, une
   date future est ignorée ; une estimation ancienne n'est écartée que par une
   estimation plus récente (dans la fenêtre), jamais par le seul passage du
   temps. Limite assumée : un objet **jamais estimé** n'est jugé que sur son
   prix déclaré.
4. **Libération du séquestre automatique à J+X après livraison prouvée** (suivi
   transporteur ; remise contre signature pour le high-value), **sauf litige**.
   X = `escrow_release_days()` = 5 jours. Le silence de l'acheteur ne bloque pas
   le vendeur ; le faux « non reçu » est cassé par la preuve de remise.
5. **Commission dégressive (5 % → 2 %) prélevée à la conclusion**, jamais à la
   mise en ligne ; taux **figé** (sur l'annonce à sa création, sur la commande à
   l'achat, sur l'échange à l'acceptation). Le palier ne compte que des ventes
   **réelles** : commandes **libérées** d'au moins **20 €**, **3 au plus par
   acheteur** (`commission_qualifying_sales`) — des ventes fictives à 0 € entre
   comptes complices ne font plus baisser le taux.

### Décisions tranchées en octobre 2026

| Question | Décision |
|---|---|
| Frais du rail high-value | **Vendeur** quand la certification est imposée par le seuil (`defaultCertificationFeePayer('threshold')`) ; **partagés** sur accord mutuel (`'split'`, moitié arrondie au centime pour le propriétaire de l'objet) ; le demandeur peut proposer `seller`/`buyer`, l'autre partie accepte les termes. |
| Commission d'un échange | Chaque partie paie **son** taux dégressif sur la **valeur déclarée de l'objet qu'elle cède** (symétrique d'une vente). La **soulte n'est pas commissionnée**. |
| Soulte | Bornée : `|soulte| ≤ max(valeurs déclarées)` — un échange porte d'abord sur des biens (sinon : vente déguisée hors commission). |
| Réservation | Une annonce est réservée dès le **paiement capturé** (`funds_held`) ou l'**échange accepté** — premier payé, premier servi ; une commande non payée ne bloque personne. **Une seule annonce ouverte par objet** (index unique) : un objet unique ne se paie pas deux fois, ni ne se paie et s'échange en même temps. |
| Capture du paiement | Revérifie l'annonce : toujours **publiée**, au **même prix**, en euros, ouverte à la vente. Toute suspension (certification exigée par une nouvelle estimation), dépublication ou modification des termes **annule** les commandes non payées. |
| Objet cédé | Un objet vendu ou cédé dans un échange conclu ne se **remet plus en vente** et ne s'**offre plus à l'échange** (il reste dans la collection du cédant, sans lui appartenir). |
| Devise, prix | **Euro uniquement** (seuil, commissions et registre en EUR) ; prix ou valeur déclarée **1 € minimum**. Une annonce historique (0006) hors euro ou sous le plancher est retirée à la migration (vendeur prévenu), sauf transaction en cours ; libérée ensuite, elle n'est ni exposée aux autres membres, ni achetable, ni ouverte à l'échange (refus explicite). |
| Suivi d'expédition | Lisible par l'autre partie : écrit par le **seul expéditeur, à l'expédition**, jamais réécrit ; transporteur choisi dans une **liste fermée** (`market_carriers()` / `MARKET_CARRIERS`) ou absent ; numéro `[A-Z0-9-]`, 4 à 40 caractères — jamais un texte libre (canal de coordonnées). Suivis historiques (0006) rattrapés à la migration : transporteur hors liste effacé, numéro non conforme effacé avant expédition (un suivi conforme est alors exigé) et masqué après, numéros conformes normalisés. |
| Fin d'abonnement Platine | Annonces publiées ou en attente de certification **retirées** (les transactions en cours se poursuivent ; une annonce qu'elles réservaient est retirée à son tour si elles se terminent sans vente, jamais suspendue ni soumise à une expertise « seuil » à ses frais), propositions en attente retirées ; plus de (re)publication, d'acceptation d'échange ni de demande de certification sur annonce (`VL402`) ; annonces d'un vendeur hors Platine absentes du catalogue et non achetables. L'offre n'est écrite que par le serveur (webhook RevenueCat). |
| Attestation de livraison | **Acheteur ou transporteur** uniquement (`record_order_delivery`), jamais le vendeur — sinon il déclencherait lui-même l'auto-libération des fonds. |
| Refus de l'expert | **Quel que soit le motif** (seuil, accord mutuel, volontaire) **et le contexte** (annonce, commande, échange) : **toute transaction non expédiée** sur l'objet tombe — commandes en attente de paiement ou payées annulées (remboursement **STRIPE**, acheteur prévenu), échanges acceptés sans aucun envoi annulés (les deux parties prévenues) ; une transaction déjà expédiée relève du litige. Puis **toute annonce ouverte de l'objet** repasse en brouillon, ses propositions d'échange en attente sont retirées et la référence d'une certification antérieure est **effacée** de ses annonces non closes. Le refus est **mémorisé** sur l'objet : republier exige une nouvelle certification, même sous le seuil ; l'objet ne s'offre plus à l'échange ; achat et capture du paiement le refusent (défense en profondeur). |
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
bornée (1..100, défaut 50). Seules les annonces `active`, non réservées,
en euros et au moins au prix plancher, d'un vendeur Platine y figurent ;
l'ordre « récent » suit une date de publication **posée par le serveur**.

`market_listing(id)` (`getListing` côté client) renvoie **une** annonce, mêmes
colonnes anonymisées que le catalogue, y compris **hors catalogue** (réservée,
suspendue, vendue, échangée, retirée) pour ses **seules parties** : vendeur,
acheteur d'une de ses commandes, parties d'un échange qui la vise. Pour les
autres membres, mêmes règles que le catalogue : annonce publiée d'un vendeur
Platine, **non réservée** (paiement capturé ou échange accepté par un autre
membre), en euros, au moins au prix plancher ; offre Platine requise.
Aucune ligne (`null`) si l'annonce n'existe pas ou n'est pas visible.

Cycle d'une annonce :

```
draft ⇄ active ⇄ pending_certification          (serveur : seuil de certification)
  │        │  └─► sold        (libération du séquestre d'une commande)
  │        └────► exchanged   (échange conclu)
  └──────────────► withdrawn  (vendeur, hors transaction en cours)
```

- Le vendeur ne peut ni passer une annonce en `sold`/`exchanged`, ni modifier
  statut, prix ou nature d'une annonce **engagée** (commande payée ou échange
  accepté en cours), ni supprimer une annonce ayant un historique de
  transactions ou d'expertise (engagée ou décidée) — il la retire.
- Une seule annonce ouverte (`draft`, `pending_certification`, `active`) par
  objet ; un objet déjà cédé ne se réannonce pas.
- Une **nouvelle estimation** au-delà du seuil fait repasser une annonce publiée
  non certifiée en `pending_certification` (le vendeur est notifié). Une
  annonce **réservée** est épargnée (statut figé, même quand le vendeur en
  retouche la description) ; si la transaction se termine **sans vente**
  (commande **payée** annulée ou remboursée, échange annulé — une commande
  jamais payée ne réservait rien et ne libère rien), elle est réévaluée comme
  une annonce neuve : seuil recalculé, référence d'expertise qu'aucune
  décision d'expert ne confirme effacée (ou après un refus). Une
  certification VELUM n'est jamais effacée : la référence posée par l'expert
  reste, et une certification de l'objet obtenue **pendant** la réservation
  (accord mutuel) est reprise par l'annonce, qui reste publiée sans nouvelle
  expertise « seuil ».
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
| `pending_payment → funds_held` | acheteur (**STRIPE** capture) — refusée si l'annonce a été réservée entre-temps, ou n'est plus celle qui a été commandée (statut, prix, devise, nature) |
| `pending_payment / funds_held → cancelled` | acheteur ou vendeur (avant expédition) ; système quand l'annonce change avant paiement |
| `funds_held → shipped` | vendeur, **suivi requis** (format contrôlé, transporteur de la liste ou aucun), **sans date de livraison** (posée par l'acheteur ou le transporteur), **bloquée tant qu'une certification est ouverte** sur la commande ou sur l'annonce elle-même (seuil, volontaire) |
| `funds_held / shipped → disputed` | acheteur |
| `shipped → released` | acheteur, ou système (auto-libération `release_due_orders`, **STRIPE** payout) |
| `disputed → released / refunded` | système (`resolve_dispute`, service_role) |

Prix, commission et parties sont **figés** (privilèges de colonnes + trigger).
Le suivi n'est écrit qu'à l'expédition, par le vendeur. Un litige ne s'ouvre
que par `open_order_dispute` (aucune écriture directe dans `disputes` : un
litige forgé « déjà arbitré », ou fantôme bloquant l'auto-libération, est
impossible).

**Données historiques (0006).** La migration rattrape les ventes antérieures
avant de poser ses garde-fous : un objet payé plusieurs fois ne garde qu'un
paiement (la commande déjà expédiée ou en litige, sinon le premier payé ; les
autres sont annulés et remboursés, acheteur et vendeur prévenus) ; une seule annonce ouverte par
objet (la plus engagée : paiement capturé, puis annonce publiée portant une
commande en attente, puis publiée) ; une seule commande en attente par
acheteur et annonce (la plus récente) ; les commandes en attente d'une
annonce dépubliée, hors euro ou sous le plancher sont annulées (acheteur
prévenu) — la capture les refuse de toute façon. En fin de migration, les
annonces ouvertes non engagées repassent par les règles de publication : la
référence d'expertise saisie par le vendeur lui-même (0003) est effacée faute
de décision d'expert, et toute annonce publiée dont la valeur de référence
(prix ou estimation VELUM, repli compris) dépasse le seuil est suspendue
jusqu'à sa certification (contenu public de l'objet recopié, demande
« seuil » ouverte, vendeur et acheteurs prévenus). Une annonce engagée
poursuit sa transaction.

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
| `proposed → accepted / declined` | destinataire (vendeur de l'annonce) ; accepter exige l'offre Platine |
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
l'autre** (une fois expédié). Aucun envoi tant qu'une certification est
ouverte sur l'échange, sur l'annonce visée ou sur une annonce de l'objet
offert par l'auteur. À la conclusion : annonce `exchanged`, annonce
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
  `my_market_orders` et `my_exchanges` exposent aussi `listing_certified`
  (`listingCertified`) : l'objet de l'annonce est **déjà certifié** —
  référence posée sur l'annonce, ou certification qui **suit l'objet** du
  vendeur (§ 5 ; par exemple obtenue sur une commande ensuite annulée) —
  distinct de `certification_required` (demande portée par la transaction) ;
  aucune nouvelle expertise n'est alors recevable sur la commande, ni à la
  demande de l'auteur d'une proposition d'échange. `my_exchanges` expose en
  outre `offered_item_certified` (`offeredItemCertified` : l'objet **offert**
  est déjà certifié, le destinataire ne peut plus en demander l'expertise) et
  `offered_item_id` (`offeredItemId`) : **mon** objet offert, renseigné pour
  l'**auteur** seulement (null pour le destinataire — jamais l'objet d'autrui),
  et `shipment_blocked` (`shipmentBlocked`) : une expertise en cours bloque
  l'expédition (`has_open_certification`), y compris celle de l'annonce de
  l'**autre** partie, absente de `my_certifications` — un booléen, jamais
  l'expertise ni son demandeur.
- **Masquage des coordonnées** (`redact_contact_info`, réplique exacte de
  `redactContactInfo`) : e-mails ENTIERS, partie locale comprise (accents,
  majuscules, maquillages « arobase », « (at) », « [at] », « point »,
  « (dot) »), téléphones (+33 / 0033 / 0X, parenthèses, séparateurs
  « . - / _ » ou blancs, numéros étrangers), URL et domaines (www, sous-domaines,
  `.co.uk`, liens wa.me / t.me), IBAN quelle que soit la casse, pseudos de
  réseaux sociaux, adresses postales (le code postal qui suit peut rester) →
  jeton « [coordonnées masquées] ». Jamais les années ni plages d'années
  (1868-1870), prix (1.250,00 €, 12 500 €), cotes (YT 1234), tirages (125/500),
  références ou dates. Sortie identique au caractère près en TypeScript et en
  SQL (vecteurs partagés, bloc M1 de `marketplace_checks.sql`) et idempotente.
  Appliqué à l'écriture aux descriptions, souhaits, titres publics, messages
  d'échange, messages des fils et motifs de litige.
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
annonce du même objet par le même propriétaire naît certifiée — **seulement**
si c'est la dernière décision d'expert sur l'objet et que son **titre public et
sa catégorie sont inchangés** (renommer un objet certifié ne lui transmet pas le
badge). La même règle est **recalculée** à toute (re)publication ou
réouverture par le vendeur (retirée → brouillon ou publiée, brouillon →
publiée) : une annonce ne garde jamais un badge que la dernière décision ou le
contenu de l'objet démentent. Cette (re)publication **recopie d'abord** le
contenu public de l'objet (titre expurgé, catégorie) dans l'annonce, avant le
calcul : l'annonce montre l'objet tel qu'il sera expertisé. Toute demande
d'expertise de l'annonce (volontaire, ou « seuil » ouverte d'office — y
compris quand une estimation suspend l'annonce sans republication)
enregistre le titre **actuel de l'objet** — un objet renommé avant sa
certification garde donc son badge aux republications suivantes ; renommé
après, il exige **une** nouvelle expertise, une seule (le titre d'une demande
n'est jamais réécrit à la décision de l'expert). Une certification qui suit
l'objet (sur l'annonce, une commande ou un échange) publie aussi ses annonces
en attente de certification avec la référence, puis **annule** ses autres
demandes « seuil » d'annonce encore ouvertes, devenues sans objet (aucune
seconde expertise facturée) ; une telle demande ne bloque jamais
l'expédition. Deux décisions ex aequo (même horodatage) : le refus
l'emporte. Un **refus** annule toute transaction non
expédiée sur l'objet, le dépublie quel que soit le motif ou le contexte et
reste mémorisé : toute republication passe par une nouvelle certification.
L'expédition étant bloquée tant qu'une expertise est ouverte sur la
transaction **ou sur l'annonce qu'elle engage**, un refus trouve normalement
la transaction non expédiée ; pendant une expertise de l'annonce seule
(volontaire, « seuil »), une seconde expertise du même objet sur la commande
ou l'échange est refusée. Une transaction **déjà expédiée** (ou en litige)
reste en place : son acheteur, ou l'autre partie de l'échange, est prévenu du
refus pour ouvrir un litige, et l'annonce qu'elle réserve n'est pas modifiée
(ni statut, ni référence, aucune demande « seuil ») ; si elle se termine
**sans vente** (commande annulée ou remboursée, échange annulé), l'annonce de
l'objet refusé passe en **brouillon**, sans référence de certification.

## 6. Commissionnement transparent

- **Vente** : `saleBreakdown` — commission = prix × taux du vendeur (figé),
  prélevée **à la libération** ; versement net au vendeur.
- **Échange** : `exchangeCommission` — chaque partie, sur l'objet qu'elle cède.
- **Registre** `platform_ledger` (lecture : le membre concerné uniquement),
  alimenté par triggers, idempotent (`member_id, kind, source_key`) :
  `commission`, `certification_fee`, `payout` (net de vente, soulte reçue).
- `my_commission_summary()` : taux actuel, ventes **retenues pour le palier**
  (commandes libérées ≥ 20 €, 3 au plus par acheteur), totaux du registre
  (`fetchCommissionSummary()` côté client — base du palier à afficher).
- Montants affichés et registre concordent **au centime** : `roundCents`
  arrondit le demi-centime au supérieur, comme `round(numeric, 2)` en SQL
  (vecteurs partagés : 20,70 € × 5 % = 1,04 € ; frais de 2,01 € partagés en
  1,01 € / 1,00 €).

## 7. Surface API

Client : `MarketplaceRepo` (`@velum/api-client`) — contrat inchangé, toutes les
méthodes câblées sur les RPC ci-dessous.

| Lecture | Action (client) | Système (service_role) |
|---|---|---|
| `market_catalogue`, `market_listing(id)`, `member_reputation(alias)` *(Platine)* | `market_buy`, `advance_market_order`, `open_order_dispute` | `assign_certification_expert`, `decide_certification` |
| `my_market_orders`, `my_exchanges`, `my_certifications` | `propose_exchange`, `respond_exchange`, `withdraw_exchange`, `cancel_exchange`, `ship_exchange`, `confirm_exchange_receipt`, `dispute_exchange` | `record_order_delivery`, `record_exchange_delivery` (transporteur) |
| `thread_messages`, `my_market_alias`, `my_commission_summary` | `request_certification`, `respond_certification`, `cancel_certification`, `send_market_message` | `resolve_dispute`, `resolve_exchange_dispute`, `release_due_orders`, `expire_stale_exchanges`, `complete_due_exchanges` |

Codes d'erreur SQL → `VelumError` : `P0001` (règle métier), `22003` (montant
hors `numeric(14,2)`), `22001` (texte trop long) → `INVALID_INPUT` avec le
motif serveur en français ; `VL402` → `PLAN_REQUIRED` ; `VL401`/`42501` →
`UNAUTHORIZED` ; panne réseau / service → `SOURCE_UNAVAILABLE`. Un refus n'est
jamais présenté comme une panne. Le client refuse aussi localement (sans appel)
un montant > `MARKET_MAX_AMOUNT`, une devise ≠ EUR, un prix < 1 €, un
transporteur inconnu ou un numéro de suivi hors format (`normalizeCarrier`,
`normalizeTrackingNumber`).

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
