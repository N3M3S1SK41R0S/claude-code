# Secrets Montres — fiche de vérification (module `watch`)

> À poser **uniquement** côté serveur via `supabase secrets set` — **jamais** dans
> le client ni dans une variable `EXPO_PUBLIC_*`. Cette fiche décrit exactement ce
> que lit `supabase/functions/_shared/domains.ts` (`buildSources('watch', …)`).

## 1. Le principe : double verrou

Chaque source de prix Montres ne s'active **que si les DEUX conditions sont vraies** :

1. **une clé d'API** non vide (`key(name)`), et
2. **un drapeau d'autorisation** valant littéralement `true`
   (`enabled(flag)` = la valeur, en minuscules et sans espaces, est `"true"`).

Ce second verrou est volontaire : une clé seule n'active rien. Le drapeau atteste
que le **contrat / l'accès partenaire est confirmé** pour ce projet. Tant qu'un
drapeau reste à `false` (valeur par défaut dans `.env.example`), la source
correspondante est ignorée — aucun appel réseau, aucun risque de violer les
conditions d'une API.

## 2. Les 5 sources et leurs deux verrous

| Source (fiche) | Nature (`kind`) | Poids | Clé requise | Drapeau à mettre à `true` |
|---|---|---|---|---|
| **WatchCharts** — cote de marché | `official_quote` | 0,9 | `WATCHCHARTS_API_KEY` | `WATCHCHARTS_APP_LICENSED` |
| **Heritage Auctions** — adjugé | `auction_realized` | 1,0 | `HERITAGE_API_KEY` ¹ | `HERITAGE_WATCH_API_ENABLED` |
| **eBay** — vendu (Marketplace Insights) | `marketplace_sold` | 0,7 | `EBAY_API_KEY` ¹ | `EBAY_MARKETPLACE_INSIGHTS_ENABLED` ² |
| **Catawiki** — adjugé | `marketplace_sold` | 0,7 | `CATAWIKI_API_KEY` ¹ | `CATAWIKI_WATCH_API_ENABLED` |
| **Chrono24** — annonces en cours | `listing` | 0,4 | `CHRONO24_API_KEY` | `CHRONO24_WATCH_API_ENABLED` |

¹ **Clés partagées** : `HERITAGE_API_KEY`, `EBAY_API_KEY` et `CATAWIKI_API_KEY`
servent déjà aux modules Pièces / Timbres / Art. Si tu les as posées pour ceux-là,
la clé est présente — **mais la source Montres reste inactive tant que son drapeau
`_ENABLED` n'est pas à `true`.**

² **eBay Marketplace Insights** est un accès **restreint** : ne mets
`EBAY_MARKETPLACE_INSIGHTS_ENABLED=true` que si ton compte eBay est **déjà approuvé**
sur cette API.

## 3. Ce qui alimente la FICHE (indépendant des sources de prix)

La partie descriptive de la fiche Montre — **spécifications, mécanisme, histoire du
modèle (pourquoi, par qui), état** — est produite par l'IA de vision via
`analyze-watch`. Elle ne dépend **que** de la clé LLM déjà commune à tous les modules :

- `LLM_VISION_API_KEY` (+ `LLM_VISION_PROVIDER`, `LLM_VISION_MODEL` optionnels).

Autrement dit : **sans aucune clé de prix**, l'identification et toute la fiche
fonctionnent ; seule la **valorisation chiffrée** reste indisponible (voir §5).

## 4. Comment poser et vérifier (commandes)

```bash
# Depuis velum/ — poser une ou plusieurs valeurs (remplace <…> par tes vraies valeurs).
supabase secrets set \
  WATCHCHARTS_API_KEY=<clé> WATCHCHARTS_APP_LICENSED=true \
  CHRONO24_API_KEY=<clé>    CHRONO24_WATCH_API_ENABLED=true \
  --project-ref <ton-ref-projet>

# Réutiliser une clé partagée déjà posée : il suffit d'activer le drapeau Montres.
supabase secrets set HERITAGE_WATCH_API_ENABLED=true --project-ref <ton-ref-projet>

# VÉRIFIER — liste les NOMS des secrets présents (jamais les valeurs) :
supabase secrets list --project-ref <ton-ref-projet>
```

> Après tout `secrets set`, les Edge Functions relisent l'environnement au prochain
> appel — aucun redéploiement n'est nécessaire pour un simple changement de secret.

### Checklist de vérification (coche la source seulement si les DEUX lignes sont vraies)

- [ ] **WatchCharts** : `WATCHCHARTS_API_KEY` présent **et** `WATCHCHARTS_APP_LICENSED=true`
- [ ] **Heritage** : `HERITAGE_API_KEY` présent **et** `HERITAGE_WATCH_API_ENABLED=true`
- [ ] **eBay** : `EBAY_API_KEY` présent **et** `EBAY_MARKETPLACE_INSIGHTS_ENABLED=true` (compte approuvé)
- [ ] **Catawiki** : `CATAWIKI_API_KEY` présent **et** `CATAWIKI_WATCH_API_ENABLED=true`
- [ ] **Chrono24** : `CHRONO24_API_KEY` présent **et** `CHRONO24_WATCH_API_ENABLED=true`

## 5. Comportement selon le nombre de sources actives

- **0 source active** → `buildSources('watch')` renvoie `[]` → le moteur lève
  `NO_OBSERVATIONS` → la fiche affiche honnêtement « Pas encore de valorisation »
  (principe VELUM : jamais de fausse certitude). L'identification, le mécanisme et
  l'histoire restent affichés.
- **≥ 1 source active** → valorisation chiffrée (centrale, IC 80/95 %, fiabilité) +
  « Dernières ventes » attribuées à leurs sources. Plus il y a de sources de ventes
  **réelles** (Heritage, eBay vendu, Catawiki), plus la fiabilité monte ; Chrono24
  (annonces) informe la fourchette sans jamais la dominer (poids 0,4).

## 6. Rappels de sécurité

- **Serveur uniquement.** Ces secrets vivent dans les Edge Functions
  (`supabase secrets set`). En mettre un dans `apps/mobile` ou un `EXPO_PUBLIC_*`
  est une faute bloquante (§12.1).
- **Ne jamais committer les valeurs.** `supabase/functions/.env.example` ne contient
  que des noms et des drapeaux à `false` — c'est le modèle, pas les secrets.
- **Le cron de calibration** (`velum-calibration-cron`) confronte les prédictions
  Montres aux ventes réelles une fois les sources actives ; il nécessite les secrets
  `vault` (`project_url`, `cron_secret`) décrits en tête de
  `supabase/migrations/0002_cron.sql`.
