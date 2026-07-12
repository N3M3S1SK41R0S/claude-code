# VELUM — Mise en route du backend Supabase

Deux voies : **local** (tout sur ta machine, idéal pour tester le scan de
bout en bout) et **production** (projet Supabase hébergé). La CLI Supabase
est requise : https://supabase.com/docs/guides/cli (`brew install supabase/tap/supabase`
ou `npm i -g supabase`). Docker est nécessaire pour le local.

---

## A. Local — tester le scan sur ta machine

Depuis `velum/` :

```bash
# 1. Démarre Postgres + Auth + Storage + Edge Runtime (Docker)
supabase start
#    → affiche API URL (http://127.0.0.1:54321) et la clé anon.

# 2. Applique le schéma (migrations/*.sql) PUIS le seed (compte démo)
supabase db reset
#    → crée les 9 tables + RLS + quota, et le compte demo@velum.app / VelumDemo-2026!
#      avec un objet par module (cf. supabase/seed.sql).

# 3. Secrets des Edge Functions (au minimum la vision IA)
cd supabase
cp functions/.env.example functions/.env      # puis édite functions/.env
#   LLM_VISION_API_KEY=sk-ant-...   LLM_VISION_PROVIDER=anthropic
supabase functions serve --env-file functions/.env --import-map functions/import_map.json

# 4. Pointe l'app sur le Supabase local (nouveau terminal, depuis velum/)
cat > apps/mobile/.env <<EOF
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon affichée par "supabase start">
EOF
pnpm --filter velum-mobile dev     # "w" pour le web
```

Connecte-toi avec **demo@velum.app / VelumDemo-2026!** : la collection démo
(cave, médaillier, galerie, album), le carnet Gold, le sommelier et le
bandeau « à boire » sont déjà peuplés. Un scan photo/texte appellera
`recognize` → `analyze-*` → `valuate` (nécessite la clé vision à l'étape 3 ;
les sources de prix sont optionnelles, l'estimation se dégrade proprement).

> Studio local (inspection de la base) : http://127.0.0.1:54323
> Boîte mail locale (confirmations) : http://127.0.0.1:54324

---

## B. Production — projet Supabase hébergé

```bash
# 1. Lier le dépôt à ton projet
supabase login
supabase link --project-ref <ref-du-projet>

# 2. Pousser le schéma
supabase db push                       # applique migrations/0001,0002,0003

# 3. Secrets serveur (JAMAIS dans le client)
supabase secrets set --env-file supabase/functions/.env
#   au minimum LLM_VISION_API_KEY ; puis NUMISTA/ARTPRICE/EBAY/… selon besoin,
#   CRON_SECRET et REVENUECAT_WEBHOOK_SECRET (valeurs fortes).

# 4. Déployer les Edge Functions
supabase functions deploy recognize analyze-wine analyze-coin analyze-art \
  analyze-stamp valuate cellar-pairing price-cron revenuecat-webhook delete-account

# 5. Cron de re-valorisation (une seule fois, via le SQL editor du dashboard) :
#    voir l'en-tête de supabase/migrations/0002_cron.sql
#      select vault.create_secret('https://<ref>.supabase.co', 'project_url');
#      select vault.create_secret('<CRON_SECRET>', 'cron_secret');

# 6. Compte démo (reviewers) — via l'API admin, JAMAIS le mot de passe du seed :
#    voir docs/DEMO_ACCOUNT.md (création admin + rejeu des sections 2-5 du seed).
```

Côté app de production, renseigne `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` de ton projet (via EAS secrets pour les
builds : `eas env:create`). Webhook RevenueCat → URL de
`revenuecat-webhook` + en-tête `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.

La suite (builds stores, fiches, conformité) est dans
[DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Clés d'API — où les obtenir

| Variable | Rôle | Requis ? |
|---|---|---|
| `LLM_VISION_API_KEY` | Reconnaissance + analyse (Claude/Gemini vision) | **Oui** pour le scan |
| `NUMISTA_API_KEY`, `PCGS_API_KEY`, `NGC_API_KEY` | Cotes pièces | Optionnel |
| `ARTPRICE_API_KEY`, `ARTSY_API_KEY` | Cotes art | Optionnel |
| `COLNECT_API_KEY`, `DELCAMPE_API_KEY` | Cotes timbres | Optionnel |
| `WINE_SEARCHER_API_KEY`, `EBAY_API_KEY`, `CATAWIKI_API_KEY` | Cotes vin / marketplaces | Optionnel |
| `FX_API_KEY` | Taux de change (repli sur Frankfurter, sans clé) | Non |

Sans source de prix configurée, `valuate` renvoie `NO_OBSERVATIONS` (404) et
l'UI affiche « estimation indisponible » — jamais un zéro trompeur.
