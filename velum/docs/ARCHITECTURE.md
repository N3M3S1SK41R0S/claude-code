# Architecture VELUM

Ce document décrit l'architecture réelle du dépôt. Les briques marquées **(en cours)** sont produites par des chantiers parallèles : leur contrat est figé (décrit ici), leur implémentation arrive.

## 1. Schéma macro

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT — apps/mobile (Expo)                       │
│  Expo Router · NativeWind · TanStack Query · Zustand · MMKV              │
│  Plugins de domaine : @velum/domain-{wine,coin,art,stamp}                │
│  @velum/core (contrats) · @velum/valuation · @velum/config (flags)       │
│  @velum/api-client (client Supabase typé) · @velum/ui                    │
│  ⚠ AUCUN secret : EXPO_PUBLIC_* uniquement                               │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ HTTPS (supabase-js, anon key + JWT utilisateur)
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                     │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────┐            │
│  │   Auth    │ │  Postgres    │ │   Storage   │ │  Realtime  │            │
│  │ Apple /   │ │  + RLS       │ │ bucket      │ │ (alertes,  │            │
│  │ Google /  │ │  (owner_id)  │ │ item-media  │ │  notifs)   │            │
│  │ email     │ │  triggers    │ │ (privé)     │ │            │            │
│  └──────────┘ └──────────────┘ └─────────────┘ └────────────┘            │
│  ┌───────────────────────────────────────────┐ ┌────────────┐            │
│  │        Edge Functions (Deno)              │ │    Cron    │            │
│  │  recognize · analyze-{wine,coin,art,stamp}│ │ revalorisa-│            │
│  │  valuate · consume_scan (RPC SQL)         │ │ tion, FX,  │            │
│  │  → SEULES détentrices des clés API        │ │ alertes    │            │
│  └───────────────┬───────────────────────────┘ └────────────┘            │
└──────────────────┼───────────────────────────────────────────────────────┘
                   │ HTTPS (secrets : supabase secrets set)
        ┌──────────┼──────────────┬───────────────────┬──────────────┐
        ▼          ▼              ▼                   ▼              ▼
  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐
  │ LLM      │ │ Qdrant   │ │ Catalogues   │ │ Sources prix │ │ FX API  │
  │ vision   │ │ (vecteurs│ │ Numista,     │ │ Wine-Searcher│ │ (taux   │
  │ (Anthro- │ │ similari-│ │ Colnect,     │ │ Artprice,    │ │  → EUR) │
  │ pic…)    │ │ té)      │ │ Yvert…       │ │ eBay sold…   │ │         │
  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘ └─────────┘

  RevenueCat (abonnements) ←→ client (clés publiques) + webhooks serveur
```

## 2. Parcours cœur : capture → collection

```
capture ──► recognize ──► candidats (top-3) ──► analyze ──► valuate ──► collection
```

1. **Capture** (`CaptureInput`, `packages/core/src/domain.ts`) — trois entrées équivalentes :
   - `photo` : un ou plusieurs clichés typés par `MediaRole` (étiquette/capsule pour le vin, avers/revers/tranche pour les pièces, œuvre/verso/signature/cadre pour les tableaux, `detail` libre). Upload dans le bucket `item-media` (chemin stocké, jamais d'URL signée persistée) ; un `base64` éphémère part vers l'appel vision et n'est **jamais stocké**.
   - `text` : saisie libre éventuellement imprécise (« pièce argent Napoléon »).
   - `file` : lignes d'un import CSV/Excel/JSON déjà parsé (`fileRows`).
2. **Recognize** — le plugin du domaine retourne un `RecognitionResult` : au plus **3 candidats** triés par confiance décroissante. Si la meilleure confiance < 0,35 (`ASSISTED_ENTRY_THRESHOLD`), `needsAssistedEntry: true` → l'UI bascule en **saisie assistée** (jamais de fausse certitude).
3. **Candidats** — l'utilisateur confirme ou corrige. Le candidat retenu (avec ses `attributes` structurés) devient la base de l'item.
4. **Analyze** — l'Edge Function du domaine appelle le LLM (prompt système du moteur : ZAPPA∴VINI∴SAPIENS pour le vin, `numis_v1`, `art_v1`, `phila_v1`) et retourne un `AnalysisResult` : payload structuré + confiance + sources citées + **disclaimers obligatoires**. La coercition est défensive : tout module manquant reçoit un défaut neutre **et** une entrée dans `uncertainties`.
5. **Valuate** — fan-out sur les adaptateurs `PriceSource` du domaine, puis moteur §7 (voir ci-dessous). Résultat : valeur centrale EUR, IC 80/95 %, score de fiabilité 0..100, observations conservées (traçabilité affichée).
6. **Collection** — item + médias + analyses + valorisations persistés (RLS par `owner_id`) ; alertes (seuil de prix, fenêtre de consommation, opportunité) et export PDF (premium).

## 3. Pipeline de reconnaissance par étages

Chaque étage n'est tenté que si le précédent n'a pas produit de candidat suffisamment fiable ; l'étage ayant produit le résultat est tracé (`RecognitionStage`, §10.1) :

| # | Étage | `stage` | Description |
|---|---|---|---|
| 1 | **LLM vision** | `llm_vision` | Le LLM multimodal reçoit les photos + prompt de reconnaissance du domaine et répond en JSON strict (candidats + confiance honnête). Implémenté dans les plugins (`recognize`), la clé API vit dans l'Edge Function. |
| 2 | **Similarité vectorielle** | `vector_similarity` | Embedding de l'image → `VectorIndex.searchSimilar()` sur Qdrant (collections par domaine : étiquettes de vin, types de pièces, timbres…). Injecté via `RecognizeDeps.vectorIndex` (optionnel). |
| 3 | **APIs catalogues** | `catalog_api` | Recoupement avec les catalogues structurés : Numista (pièces), Colnect / cote Yvert (timbres), bases producteurs (vin). |
| 4 | **Communauté** | `community` | Soumission aux collectionneurs experts de la communauté (asynchrone, phase ultérieure). |
| 5 | **Saisie assistée** | `assisted` | Repli systématique : formulaire guidé par domaine (jamais d'impasse). Aussi le chemin nominal des imports fichier. |

## 4. Moteur de valorisation (§7 — `packages/valuation/src/engine.ts`)

Pipeline commun aux 4 domaines : `valuate(obs, fx, options) → ValuationResult`.

1. **Normalisation devise** — `toEUR()` via `FxRates` (taux manquant → `VelumError('INVALID_INPUT')`).
2. **Rejet d'outliers (MAD)** — conserve les points où `|x − med| / MAD ≤ k` (k = 3,5). **Cas MAD = 0 (majorité de prix identiques) : tout est conservé** — aucune information d'échelle, plutôt que de rejeter arbitrairement tout point divergent comme le ferait un repli `|| 1e-9`.
3. **Pondération** — poids effectif = fiabilité de la source × récence :
   - fiabilité par `SourceKind` (`DEFAULT_SOURCE_WEIGHTS`) : ventes réalisées 1.0 > cotes officielles 0.9 > ventes marketplaces 0.7 > annonces 0.4 ;
   - récence : décroissance exponentielle, demi-vie 365 jours.
4. **Médiane pondérée** — valeur centrale ; si la masse de poids est nulle, repli médiane simple.
5. **Bootstrap déterministe** — 1 000 rééchantillonnages ; RNG **injectable et seedé** (`mulberry32`) → IC 80 % et 95 % rejouables à l'identique en test comme en production.
6. **Score de fiabilité 0..100** — moitié nombre de sources (saturation à 8), moitié resserrement de l'IC 80 % relatif à la valeur centrale.

Aucune observation exploitable → `VelumError('NO_OBSERVATIONS')` : l'UI affiche « estimation indisponible », **jamais un zéro trompeur**.

Ajouter une source de prix = écrire un adaptateur `PriceSource` ; **le cœur du moteur ne change jamais**.

## 5. Feature flags (`packages/config/src/index.ts`)

| Flag | Défaut | Rôle |
|---|---|---|
| `enableStamps` | `true` | Philatélie — module à part entière (décision produit juillet 2026), désactivable par flag. |
| `artDomain` | `'tableaux'` | Bascule paramétrable du module art (`'tableaux'` \| `'art_de_la_table'`). |
| `enableMarketplace` | `true` | Plateformes d'échange et de vente par catégorie (décision produit juillet 2026) — accès réservé à l'offre Platine ; paiement réel (Stripe Connect) et KYC à brancher. |

Les flags sont exposés côté app via `extra.features` dans `app.config.ts` et lus par `@velum/config`. `activeDomains(features)` dérive la liste des domaines visibles. La grille d'abonnement (`PLAN_LIMITS`) vit au même endroit : **free** = 5 scans/semaine par module ; **premium** = scans illimités sans carnet virtuel ; **gold** = + carnet/bibliothèque virtuelle (emplacements de cave, table de pièces…) ; **platine** = + valorisation continue du carnet et communauté de transactions anonymisées (commission **dégressive** selon l'activité du vendeur via `commissionRateFor` / `COMMISSION_TIERS` — de `MARKETPLACE_COMMISSION_MAX` = 5 % à `MARKETPLACE_COMMISSION_MIN` = 2 %, répliquée côté SQL par `commission_rate_for` dans la migration `0004_commission_degressive.sql` ; expertise obligatoire au-delà de `EXPERT_APPRAISAL_THRESHOLD_EUR` = 500 €). Le quota est appliqué côté serveur par `consume_scan(p_domain)` (voir [DATABASE.md](./DATABASE.md)).

## Cave virtuelle transversale (Gold+) — mets ⇄ vins dans les deux sens

La cave virtuelle n'est pas un simple inventaire : elle est interrogeable
dans les deux sens.

- **Sens 1 — plat → vin de MA cave** : Edge Function `cellar-pairing`
  (offre Gold/Platine). L'inventaire réel (items `wine` + analyses ZAPPA
  persistées + emplacements saisis) est transmis à un prompt sommelier
  contraint : le modèle ne peut recommander que des `itemId` présents en
  cave, et le parseur serveur écarte toute recommandation hors inventaire
  (`parsePairingResponse`, testé). Réponse : top-3 avec score, justification,
  conseil de service, et l'emplacement physique de la bouteille.
- **Sens 2 — apogée → « à boire »** : `price-cron` évalue les alertes
  `drink_window` avec `isInDrinkWindow` (module 2 ZAPPA) et joint les accords
  mets-vins de l'analyse au corps de la notification (« Ce vin est à son
  apogée — servez-le avec un pigeon rôti »). Côté app, le même calcul est
  fait localement (`drinkNowSuggestions`) pour afficher le bandeau « à boire »
  de l'onglet Collection, fenêtres les plus urgentes d'abord.

## 6. Sécurité & vie privée (rappels structurants)

- **RLS partout** : chaque table porteuse de données utilisateur est filtrée par `owner_id = auth.uid()` (directement ou via l'item parent).
- **Secrets** : uniquement `supabase secrets set` (voir `supabase/functions/.env.example`) — LLM, Numista, Artprice, eBay, Colnect, Delcampe, FX, Qdrant. Le client ne connaît que l'URL Supabase, l'anon key et les clés publiques RevenueCat.
- **Médias** : bucket `item-media` privé, URLs signées générées à la volée, `base64` de capture jamais persisté.
- **Erreurs typées** : `VelumError` avec codes stables (`NO_OBSERVATIONS`, `RATE_LIMITED`, `BUDGET_EXCEEDED`…) → messages i18n côté client, pas de fuite de détails serveur.

## 7. Couche de différenciation (paris 2026)

Extensions additives, dans le style source-first (paquets purs testés sans réseau,
Edge Functions à deps injectées). Voir le tableau récapitulatif du [README](../README.md#différenciation--moteur-des-paris-2026).

### 7.1 Extensions du moteur §7 — `@velum/valuation`

- `explain.ts` — décompose une valorisation (sources retenues/écartées par la
  règle MAD, poids fiabilité × récence, dispersion, score de fiabilité) pour
  l'écran « pourquoi cette fourchette ». Réutilise `valuate()` : explication et
  estimation ne peuvent jamais diverger.
- `calibration.ts` — `calibrate()` mesure la couverture des IC 80/95 % vs prix
  réalisé ; `backtest()` rejoue le moteur sur des ventes **publiques** (cold-start
  J1) ; statut honnêtement borné (`calibrating` sous le seuil d'échantillon).
- `portfolio.ts` — agrégation patrimoniale multi-actifs ; les IC sont sommés de
  façon **comonotone** (borne large, honnête) plutôt que sous hypothèse
  d'indépendance ; instantanés datés + mouvement.
- `arbiter.ts` — croise fenêtre d'apogée × trajectoire de valeur ; le signal de
  vente exige le **garde-fou** (apogée proche ET IC 80 % disjoints sur ≥ 3 points).

### 7.2 Nouveaux paquets purs

- `@velum/scan` — `capture.ts` (décision accepter/refuser + séquence multi-angle),
  `cert.ts` (PCGS/NGC + slab-swap), `authenticity.ts` (drapeau de risque
  déterministe, jamais un verdict ; registre Qdrant injectable).
- `@velum/carnet` — `hash.ts` (SHA-256 pur/portable), `provenance.ts` (passeport
  à hash chaîné + vérif d'intégrité), `report.ts` (rapport assurance/succession),
  `card.ts` (cartes de confiance + musée de poche).

### 7.3 Extensions de domaine

`domain-stamp/grading.ts` (état → multiplicateur de cote), `domain-coin/variety.ts`
(variétés cotées), `domain-wine/recalibrate.ts` (apogée recalibrée par les
ouvertures réelles).

### 7.4 Edge Functions & tables

- Fonctions : `arbiter` (Gold+ : lit l'apogée + la trajectoire de la table
  existante `valuations` → `arbitrate`), `calibration` (GET score public par
  domaine ; POST cron protégé par `CRON_SECRET` → recalcule depuis
  `calibration_outcomes`).
- Tables (migration `0007`, sous RLS) : `calibration_outcomes` (service-role) et
  `calibration_runs` (score **public** en lecture authentifiée). La trajectoire
  réutilise `valuations` (0001) ; le passeport à hash chaîné de `@velum/carnet`
  est un **sceau d'intégrité dérivé** de `provenance_entries` (0005), pas une
  table parallèle.

## 8. Évolutions d'octobre 2026

### 8.1 Scan éclair, fiche complète à la demande, mode classeur

- **Scan éclair (mode par défaut)** : un seul appel de reconnaissance, compact
  (`RECOGNITION_MAX_TOKENS` = 768), renvoie pour chaque candidat
  l'identification, un **classement** (`Candidate.classification`, ex.
  `['France', 'Cérès', '1849–1850']`) et une **fourchette indicative**
  (`Candidate.quickEstimate`), toujours libellée « indicative », jamais
  présentée comme une cote §7 et absente sous la confiance 0,35.
  « Enregistrer » crée l'objet immédiatement (`attributes.analysisStatus =
  'pending'`) ; la valorisation §7 part en arrière-plan.
- **Fiche complète à la demande** : la fiche objet propose « Charger la fiche
  complète » (appel `analyze`, lent) ; conventions dans
  `apps/mobile/lib/analysisState.ts` (`analysis`, `analysisEngine`,
  `analyzedAt`, `quickEstimate`, `classification`, `corrections`). Une
  correction d'identité postérieure à `analyzedAt` rend la fiche **périmée**
  et propose de la régénérer.
- **Mode classeur** (`/capture/batch`) : « Série » (une photo par objet, file
  traitée en arrière-plan, concurrence 2, « Tout enregistrer » au-delà de la
  confiance 0,6) et « Planche » (UNE photo de page de classeur ou de plateau →
  jusqu'à 24 objets). Contrat additif : `DomainPlugin.recognizeSheet?()` →
  `SheetRecognitionResult` (implémenté pour timbres et pièces), Edge
  `recognize` avec `mode: 'sheet'`, budget `SHEET_RECOGNITION_MAX_TOKENS` =
  3 072. **Une photo de planche = un scan** du quota freemium.

### 8.2 Correction en texte de l'identification

`apps/mobile/lib/identityFields.ts` est la source unique des champs
d'identité par domaine (clés identiques à `items.attributes`). La correction
est possible avant l'enregistrement (écran Candidats, mode classeur) et après
(fiche objet). Chaque changement est **tracé** dans `attributes.corrections`
(valeur lue → valeur corrigée, horodatée, 30 dernières conservées) ; la
relance de l'estimation est proposée immédiatement.

### 8.3 Cave : apogée, rappels, plat → vins

- `@velum/domain-wine` `peak.ts` : statut d'urgence `past` (fenêtre dépassée),
  `closing` (dernière année), `peak`, `soon`, tri par urgence, emplacement
  lisible. Écran **« Mes vins à leur apogée »** (`/cellar-peak`), à la demande,
  avec la position physique de chaque bouteille.
- `localPairing.ts` : appariement **déterministe** plat → vins de la cave
  (familles de vins, accords ZAPPA, bonus apogée), instantané, hors-ligne et
  gratuit ; le sommelier IA (`cellar-pairing`, Gold+) affine ensuite.
- **Alerte ponctuelle** : notification locale unique (`lib/drinkReminders.ts`)
  avec le vin le plus urgent, sa position et un plat ; rappel hebdomadaire
  facultatif ; le lien profond est validé par liste blanche
  (`lib/notificationLinks.ts`). Côté serveur, `price-cron` enrichit l'alerte
  `drink_window` (position + plats) sans perdre son idempotence.

### 8.4 Plateformes d'échange et de vente, liste d'envies

Voir [COMMUNITY_MARKETPLACE.md](./COMMUNITY_MARKETPLACE.md) (catalogue
anonymisé par catégorie, échanges, commission, certification, messagerie
expurgée) et [WISHLIST.md](./WISHLIST.md). Les règles pures (commission,
seuil de certification, masquage des coordonnées) vivent dans
`@velum/config` (`marketplace.ts`) et sont répliquées en SQL avec des
vecteurs de test partagés.

### 8.5 Navigation et recherche

- En-tête unifié de `Screen` : « ‹ Retour » sur tous les écrans, avec repli
  sûr (`useGoBack`, `lib/backNavigation.ts`) quand l'historique est vide
  (lien direct, notification). Routes partagées : `lib/routes.ts`.
- Recherche insensible aux accents et multi-mots (`lib/search.ts`) dans la
  collection, le carnet, les envies et le catalogue, plus une **recherche
  globale** (`/search`).
