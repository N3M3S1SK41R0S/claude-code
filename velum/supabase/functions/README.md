# VELUM — Edge Functions (Deno)

Les Edge Functions portent tout ce qui exige un secret : modèles vision, sources
de prix, service-role et appels internes. **Aucun secret côté client.** Elles
réutilisent les plugins `@velum/domain-wine|coin|art|stamp|watch` du monorepo ;
seule l'injection des transports et identifiants diffère côté serveur.

## Arborescence

| Chemin | Rôle |
| --- | --- |
| `import_map.json` | Alias `@velum/*` vers les packages du monorepo |
| `_shared/` | CORS, réponses, auth, vision, FX, transport et routage plugins |
| `recognize/` | Identification multi-domaines, quota freemium |
| `analyze-{wine,coin,art,stamp,watch}/` | Fiche d'analyse propre à chaque domaine |
| `valuate/` | Valorisation déterministe avec observations attribuées |
| `arbiter/` | Signal patrimonial indicatif Gold+ |
| `calibration/` | Backtests et publication des couvertures IC80/IC95 |
| `cellar-pairing/` | Sommelier Gold+ contraint à la cave réelle |
| `price-cron/` | Revalorisation, alertes, notifications et GC médias |
| `revenuecat-webhook/` | Synchronisation serveur du plan |
| `delete-account/` | Purge RGPD Storage + compte |

## Secrets

```sh
supabase secrets set --env-file supabase/functions/.env
```

Le modèle exhaustif se trouve dans `.env.example`. Variables structurantes :

```text
LLM_VISION_PROVIDER
LLM_VISION_API_KEY
LLM_VISION_MODEL
CRON_SECRET
REVENUECAT_WEBHOOK_SECRET
FX_API_KEY
```

Les sources de prix publiques ou déjà contractuelles suivent la règle habituelle
clé optionnelle/obligatoire. Les sources montres partenaires sont plus strictes :
**la présence d'une clé ne les active pas**.

| Source montres | Clé | Drapeau obligatoire | Condition |
| --- | --- | --- | --- |
| WatchCharts | `WATCHCHARTS_API_KEY` | `WATCHCHARTS_APP_LICENSED=true` | contrat couvrant l'affichage dans VELUM |
| Heritage | `HERITAGE_API_KEY` | `HERITAGE_WATCH_API_ENABLED=true` | endpoint et schéma confirmés par contrat |
| eBay sold | `EBAY_API_KEY` | `EBAY_MARKETPLACE_INSIGHTS_ENABLED=true` | compte approuvé pour Marketplace Insights |
| Catawiki | `CATAWIKI_API_KEY` | `CATAWIKI_WATCH_API_ENABLED=true` | endpoint et schéma confirmés par contrat |
| Chrono24 | `CHRONO24_API_KEY` | `CHRONO24_WATCH_API_ENABLED=true` | endpoint et schéma confirmés par contrat |

Sans ce double opt-in, `buildSources('watch')` retourne uniquement les sources
réellement autorisées, éventuellement aucune. L'API renvoie alors
`NO_OBSERVATIONS`/`SOURCE_UNAVAILABLE` au lieu d'inventer une cote.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés
par Supabase.

Le `CRON_SECRET` doit également exister dans Vault :

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<meme-valeur-que-CRON_SECRET>', 'cron_secret');
```

## Déploiement

Le chemin normal est le workflow `.github/workflows/velum-supabase-deploy.yml`,
qui découvre les fonctions au lieu de maintenir une liste manuelle. En local :

```sh
bash velum/scripts/deploy-supabase.sh
```

Pour une publication ciblée :

```sh
supabase functions deploy analyze-watch
supabase functions deploy calibration --no-verify-jwt
supabase functions deploy price-cron --no-verify-jwt
```

Les fonctions internes sans JWT utilisateur restent protégées par
`x-cron-secret` ou leur secret de webhook.

## Lancement local

```sh
supabase start
supabase db reset
supabase functions serve --env-file supabase/functions/.env

curl -s http://127.0.0.1:54321/functions/v1/recognize \
  -H "Authorization: Bearer <jwt-utilisateur>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"watch","input":{"kind":"text","text":"Omega Speedmaster 3570.50"}}'
```

Vérification de toutes les fonctions, identique à la CI :

```sh
cd supabase/functions
mapfile -t edge_entries < <(
  find . -mindepth 2 -maxdepth 2 -type f -name index.ts \
    -not -path './_shared/*' -not -path './tests/*' -print | sort
)
deno check --import-map=import_map.json "${edge_entries[@]}"
deno test --import-map=import_map.json -A tests/
```

## Contrats HTTP

Toutes les routes utilisateur acceptent `POST` avec pré-vol `OPTIONS` et exigent
`Authorization: Bearer <jwt>`. Contrat d'erreur stable :

```json
{ "error": { "code": "<VelumErrorCode>", "message": "…" } }
```

### `POST /recognize`

```jsonc
{
  "domain": "wine" | "coin" | "art" | "stamp" | "watch",
  "input": CaptureInput
}
```

Réponse : `RecognitionResult`. Erreurs principales : `UNAUTHORIZED`,
`BUDGET_EXCEEDED`, `INVALID_INPUT`, `RECOGNITION_FAILED`, `SOURCE_UNAVAILABLE`.

### `POST /analyze-{wine|coin|art|stamp|watch}`

```jsonc
{ "candidate": Candidate, "itemId": "uuid optionnel" }
```

Réponse : `AnalysisResult`. Quand `itemId` est fourni, l'insertion utilise le
client utilisateur ; la RLS vérifie la propriété de l'objet.

### `POST /valuate`

```jsonc
{
  "domain": "wine" | "coin" | "art" | "stamp" | "watch",
  "candidate": Candidate,
  "itemId": "uuid optionnel"
}
```

Réponse : `ValuationResult`. Une absence d'observation exploitable ne devient
jamais zéro : `NO_OBSERVATIONS` ou `SOURCE_UNAVAILABLE` est propagé.

### `POST /arbiter`

Gold/Platine. Croise la trajectoire de valorisation avec la fenêtre d'usage
lorsqu'elle existe. Le résultat reste indicatif et ne constitue pas un conseil
d'investissement.

### `POST /cellar-pairing`

Gold/Platine. Le modèle ne peut recommander que des `itemId` présents dans la
cave de l'utilisateur ; toute recommandation hors inventaire est rejetée.

### `POST /calibration` et `POST /price-cron`

Routes internes protégées par `x-cron-secret`. La calibration couvre les cinq
domaines. Le cron de prix applique droits produit, revalorisation, alertes et
nettoyage média.

### `POST /revenuecat-webhook`

Synchronise `profiles.plan`. Configurer l'en-tête
`Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.

### `POST /delete-account`

Supprime les objets Storage du préfixe utilisateur puis le compte. La cascade SQL
efface les données liées. Réponse `204` sans corps.
