# Déploiement Supabase VELUM

Le workflow `.github/workflows/velum-supabase-deploy.yml` déploie la production uniquement après la réussite de **VELUM CI** sur un push de `main`.

## Configuration unique de GitHub

Créer ou utiliser l’environnement GitHub `production`, puis appliquer cette configuration :

1. **Deployment branches and tags** → `Selected branches and tags` → autoriser uniquement `main` ;
2. enregistrer les deux secrets ci-dessous ;
3. facultatif mais recommandé : ajouter une approbation humaine pour les migrations de production.

| Secret | Usage |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token Supabase utilisé par la CLI et l’API de déploiement |
| `SUPABASE_DB_PASSWORD` | Mot de passe PostgreSQL du projet distant, lu directement depuis l’environnement |

La restriction de l’environnement à `main` est une frontière de sécurité : elle empêche GitHub de transmettre les secrets à une version du workflow lancée depuis une autre branche. Le job vérifie également `github.ref == refs/heads/main`, mais cette seconde vérification ne remplace pas la règle d’environnement.

Le project ref `hbhfwfjdybvsoojvemdv` est public et reste versionné dans le workflow. Aucune clé anon, service-role, LLM ou source marchande n’est nécessaire au pipeline.

## Déploiement automatique

Le chemin nominal est strictement sériel :

1. un commit atteint `main` ;
2. `VELUM CI` valide typecheck, lint, tests, PWA, accessibilité, Edge Functions et toutes les migrations ;
3. le workflow de production checkout **le SHA exact validé** dans un arbre cible séparé ;
4. le SHA est comparé au HEAD distant courant de `main` ; un run CI terminé hors ordre est ignoré avant l’installation de la CLI et avant l’accès aux secrets ;
5. le contrôleur de déploiement provient du même SHA validé, jamais d’une branche arbitraire ;
6. `supabase db push --dry-run` vérifie l’historique distant ;
7. `supabase db push` applique uniquement les migrations en attente ;
8. `supabase functions deploy` publie toutes les fonctions du dépôt ;
9. `supabase functions list --output json` prouve que chaque entrypoint local existe à distance.

Le groupe de concurrence `velum-supabase-production` interdit deux déploiements simultanés. Les exécutions ne sont pas annulées lorsqu’un nouveau commit arrive : le déploiement courant termine avant le suivant. La vérification du HEAD empêche ensuite un run CI plus ancien, terminé tardivement, de redéployer un état obsolète après une révision plus récente.

## Invariants de sécurité

- Aucun `--include-seed`, `--include-all` ou `migration repair` automatique.
- Un historique de migrations divergent bloque le pipeline au lieu d’être modifié silencieusement.
- La base est déployée avant les fonctions afin que le nouveau code ne précède pas son schéma.
- Les secrets ne sont ni passés en argument de commande, ni écrits dans le résumé GitHub.
- Les credentials Supabase ne sont injectés que dans l’étape de shell qui publie ; checkout et setup-cli ne les reçoivent pas.
- Le mot de passe DB est injecté uniquement lorsque `deploy_database=true`.
- Le checkout désactive `persist-credentials` et les actions externes sont épinglées par SHA.
- Lors d’un lancement manuel, le script ayant accès aux secrets vient toujours de `main` ; la cible est checkoutée dans un second arbre.
- Toute cible manuelle doit être un ancêtre de `main`. Une branche non fusionnée ne peut donc jamais fournir le code cible publié.
- L’environnement GitHub `production` doit refuser tout workflow exécuté hors de `main`.
- `config.toml` explicite `verify_jwt` pour les douze fonctions. Les handlers cron/webhook conservent leur propre vérification de secret.

## Déploiement ou rollback manuel

Dans l’interface Actions, sélectionner impérativement **Use workflow from: main**. Le bouton **Run workflow** expose ensuite quatre paramètres :

- `ref` : branche, tag ou SHA cible ;
- `deploy_database` ;
- `deploy_functions` ;
- `dry_run`.

### Rejouer la production actuelle

```text
ref=main
deploy_database=true
deploy_functions=true
dry_run=false
```

### Prévisualiser sans mutation

```text
ref=main
deploy_database=true
deploy_functions=true
dry_run=true
```

### Restaurer les Edge Functions d’un ancien SHA

```text
ref=<ancien-sha-validé-et-présent-dans-main>
deploy_database=false
deploy_functions=true
dry_run=false
```

Le workflow refuse toute cible absente de l’historique de `main`, ainsi que toute tentative de déploiement de base depuis un ref autre que `main`. Une migration PostgreSQL déjà appliquée ne se rétrograde jamais automatiquement : la correction se fait par une nouvelle migration **forward-only**.

## Exécution locale avec un `.env`

Le script ne source volontairement aucun fichier de lui-même. Charger explicitement l’environnement évite qu’un fichier non fiable soit exécuté implicitement :

```bash
cd velum
set -a
source .env
set +a

export SUPABASE_PROJECT_REF=hbhfwfjdybvsoojvemdv
export DEPLOY_DATABASE=true
export DEPLOY_FUNCTIONS=true
export DRY_RUN=true
bash scripts/deploy-supabase.sh
```

Après inspection du dry-run :

```bash
DRY_RUN=false bash scripts/deploy-supabase.sh
```

Variables acceptées :

| Variable | Défaut |
|---|---|
| `SUPABASE_PROJECT_REF` | projet VELUM de production |
| `DEPLOY_DATABASE` | `true` |
| `DEPLOY_FUNCTIONS` | `true` |
| `DRY_RUN` | `false` |
| `DEPLOY_REF` | SHA Git courant, uniquement pour l’observabilité |
| `VELUM_ROOT` | racine contenant `supabase/config.toml`, utile lorsque contrôleur et cible sont séparés |

## Diagnostic

- Job ignoré en lancement manuel : le workflow n’a pas été exécuté depuis `main` ou l’environnement `production` refuse la branche.
- Déploiement automatique ignoré : une CI plus récente a déjà validé un nouveau HEAD de `main`.
- Échec avant la CLI : secret GitHub absent ou variable locale manquante.
- Cible refusée : le SHA demandé n’est pas dans l’historique de `main`.
- Échec du dry-run DB : historique distant divergent ; inspecter `supabase migration list --linked`, sans réparation automatique.
- Échec du déploiement de fonction : relancer le même SHA après correction de l’incident Supabase.
- Inventaire incomplet : le script échoue même si la CLI a retourné zéro, afin de ne pas déclarer une publication partielle réussie.
- Migration réussie mais fonctions échouées : la base reste en avant ; relancer le déploiement des fonctions du même SHA. Ne pas tenter de restaurer une ancienne base.
