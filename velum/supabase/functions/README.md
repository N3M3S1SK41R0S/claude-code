# VELUM — Edge Functions (Deno)

Les Edge Functions portent tout ce qui exige un secret (clé LLM vision, clés
des sources de prix, service-role) : **aucun secret côté client** (§12.1).
Elles importent **les mêmes plugins de domaine que l'app**
(`@velum/domain-wine|coin|art|stamp` via `import_map.json`) — seule
l'injection (vision, transport HTTP, clés API) diffère côté serveur.

## Arborescence

| Chemin | Rôle |
| --- | --- |
| `import_map.json` | Alias `@velum/*` → sources du monorepo (`../../packages/...`) |
| `deno.json` | Pointe vers l'import map + active `sloppy-imports` (les packages du monorepo utilisent des imports relatifs sans extension) |
| `_shared/` | Code commun : CORS, réponses, auth, vision Anthropic, FX, transport, routage plugins |
| `recognize/` | Identification (étage 1 LLM vision), quota freemium |
| `analyze-wine/` `analyze-coin/` `analyze-art/` `analyze-stamp/` | Fiches d'analyse par domaine |
| `valuate/` | Valorisation (moteur §7 `@velum/valuation`) |
| `cellar-pairing/` | Sommelier de cave Gold+ (plat → vin de MA cave, anti-hallucination) |
| `price-cron/` | Re-valorisation planifiée + alertes + notifications |
| `delete-account/` | Purge RGPD (storage + compte) |

## Secrets (jamais dans le code, jamais en `EXPO_PUBLIC_*`)

```sh
# Fichier .env local à partir du modèle, puis :
supabase secrets set --env-file supabase/functions/.env

# Ou individuellement :
supabase secrets set LLM_VISION_API_KEY=sk-ant-...
supabase secrets set LLM_VISION_MODEL=claude-sonnet-5   # défaut si absent
supabase secrets set CRON_SECRET=<valeur-aleatoire-forte>
supabase secrets set NUMISTA_API_KEY=... PCGS_API_KEY=... NGC_API_KEY=...
supabase secrets set EBAY_API_KEY=... CATAWIKI_API_KEY=... HERITAGE_API_KEY=...
supabase secrets set ARTPRICE_API_KEY=... ARTSY_API_KEY=... DROUOT_API_KEY=... MAGNUS_API_KEY=...
supabase secrets set COLNECT_API_KEY=... YVERT_API_KEY=... DELCAMPE_API_KEY=...
supabase secrets set WINE_SEARCHER_API_KEY=... IDEALWINE_API_KEY=... VIVINO_API_KEY=... CAVISSIMA_API_KEY=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
injectés automatiquement par la plateforme.

Une source dont l'API **exige** une clé n'est instanciée que si sa clé est
configurée ; les sources publiques (iDealwine, Vivino, Cavissima, CGB, Drouot)
sont toujours incluses. Si aucune source n'est disponible pour un domaine,
`valuate` répond `503 SOURCE_UNAVAILABLE`.

Le `CRON_SECRET` doit aussi être posé dans le Vault Postgres (voir
`migrations/0002_cron.sql`) :

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<meme-valeur-que-CRON_SECRET>', 'cron_secret');
```

## Déploiement

```sh
supabase functions deploy recognize
supabase functions deploy analyze-wine
supabase functions deploy analyze-coin
supabase functions deploy analyze-art
supabase functions deploy analyze-stamp
supabase functions deploy valuate
supabase functions deploy price-cron --no-verify-jwt   # sécurisée par x-cron-secret
supabase functions deploy delete-account
```

`price-cron` est appelée par pg_cron (pas de JWT utilisateur) : elle est
protégée par l'en-tête `x-cron-secret` — d'où `--no-verify-jwt`.

## Lancement local

```sh
supabase start                         # Postgres + auth + storage locaux
supabase db reset                      # applique migrations/0001 + 0002
supabase functions serve --env-file supabase/functions/.env

# Exemple d'appel :
curl -s http://127.0.0.1:54321/functions/v1/recognize \
  -H "Authorization: Bearer <jwt-utilisateur>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"wine","input":{"kind":"text","text":"Château Margaux 2015"}}'
```

Vérification de types (depuis `supabase/functions/`) :

```sh
# deno.json fournit l'import map et active sloppy-imports :
deno check _shared/*.ts recognize/index.ts analyze-*/index.ts \
  valuate/index.ts price-cron/index.ts delete-account/index.ts
```

## Routes et payloads

Toutes les routes acceptent `POST` (+ pré-vol `OPTIONS`) et exigent
`Authorization: Bearer <jwt>` — sauf `price-cron` (en-tête `x-cron-secret`).
Format d'erreur stable : `{ "error": { "code": "<VelumErrorCode>", "message": "…" } }`.

### `POST /recognize`

```jsonc
// Requête
{ "domain": "wine" | "coin" | "art" | "stamp", "input": CaptureInput }
// Réponse 200 : RecognitionResult { candidates: Candidate[], stage, needsAssistedEntry }
```

Erreurs : `401 UNAUTHORIZED`, `402 BUDGET_EXCEEDED` (quota freemium : 5
scans/semaine PAR module en plan `free`, via `rpc consume_scan(p_domain)`), `400 INVALID_INPUT`,
`502 RECOGNITION_FAILED`, `503 SOURCE_UNAVAILABLE`.

### `POST /analyze-{wine|coin|art|stamp}`

```jsonc
// Requête
{ "candidate": Candidate, "itemId": "uuid (optionnel)" }
// Réponse 200 : AnalysisResult { engine, payload, confidence, sources, disclaimers }
```

Si `itemId` est fourni, la fiche est insérée dans `analyses` **via le client
utilisateur** : la RLS garantit que l'item appartient à l'appelant (sinon
`403`).

### `POST /valuate`

```jsonc
// Requête
{ "domain": "wine" | "coin" | "art" | "stamp", "candidate": Candidate, "itemId": "uuid (optionnel)" }
// Réponse 200 : ValuationResult { central, ci80, ci95, nSources, reliability, currency: "EUR", observations }
```

Erreurs : `404 NO_OBSERVATIONS` (aucun prix exploitable — l'UI affiche
« estimation indisponible », jamais un zéro trompeur), `503
SOURCE_UNAVAILABLE` (aucune source configurée pour le domaine). Si `itemId`
est fourni : insertion dans `valuations` (central, ci80_low/high,
ci95_low/high, reliability, sources = observations JSONB).

### `POST /cellar-pairing` (Gold+)

Sommelier de cave — sens 1 de l'intelligence transversale mets ⇄ vins :
« ce soir je cuisine tel plat → quel vin DÉJÀ DANS MA CAVE ? ». Lit la cave
de l'utilisateur (items `wine` + analyse ZAPPA persistée, RLS active),
interroge le LLM avec un prompt sommelier contraint à l'inventaire
(anti-hallucination : tout `itemId` hors cave est écarté côté serveur).

```jsonc
// Requête
{ "dish": "magret de canard aux figues" }
// Réponse 200 : PairingResult
{ "recommendations": [{ "itemId": "…", "label": "…", "score": 0.92, "reasoning": "…", "serveAt": "17 °C, carafé 1 h" }], "fallbackAdvice": "…" }
```

Erreurs : `403 PLAN_REQUIRED` (le sommelier fait partie du carnet virtuel —
offres Gold et Platine), `400 INVALID_INPUT`.

Le sens 2 (apogée → « à boire, servez-le avec tel plat ») est géré par
`price-cron` : les alertes `drink_window` joignent les accords mets-vins de
l'analyse ZAPPA au corps de la notification.

### `POST /price-cron` (interne)

En-tête requis : `x-cron-secret: <CRON_SECRET>`. Parcourt les items par lots
de 50 ; re-valorise ceux qui ont une alerte active ou une valorisation vieille
de 7 jours ou plus ; évalue les alertes `price_threshold`
(`config: { direction: "above" | "below", threshold: number }`) et
`drink_window` (vin) ; insère les `notifications`.

```jsonc
// Réponse 200
{ "processed": 123, "revalued": 45, "notified": 6, "failures": 0 }
```

### `POST /revenuecat-webhook` (interne)

Synchronisation serveur du plan (`profiles.plan`) depuis les événements
RevenueCat. Configurer dans le dashboard RevenueCat : URL de la fonction +
en-tête `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`. L'app lie
l'identité RevenueCat au compte (`Purchases.logIn(uid)`) à la connexion ;
les événements `EXPIRATION`/`CANCELLATION` ramènent au plan `free`.

### `POST /delete-account`

Purge RGPD : supprime les objets Storage du préfixe `<uid>/` du bucket
`item-media`, puis le compte (`auth.admin.deleteUser`) — la cascade SQL efface
profil, items et toutes les données liées. Réponse : `204` sans corps.
