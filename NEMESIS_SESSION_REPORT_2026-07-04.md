# NEMESIS — Session Fable 5 ultracode du 2026-07-04

Mandat : améliorer l'intégralité du projet NEMESIS sans régression, PRs par domaine, Tier List Q3 2026.
Environnement réel : conteneur cloud (Claude Code web) — pas d'accès à `D:\GitHub\`, MEMORY.md, CLI `gh`/`supabase`, ni à l'API n8n (pas de `N8N_API_KEY` ; basic auth → 401). Supabase prod accessible en lecture via PostgREST. Conséquence structurante : **tout changement WF19 est livré en patch-script prêt-à-exécuter**, jamais appliqué depuis ici.

## PRs créées (toutes testées, review adversariale passée)

| PR | Repo | Base | Contenu |
|----|------|------|---------|
| #421 | nemesis-backend | master | **Sécurité** : redaction de 20+ secrets réels trackés (`.env.github.example`, 3 docs, `.env.example` midas) + runbook rotation `docs/SECRETS_ROTATION_2026-07-04.md` |
| #422 | nemesis-backend | branche #415 | **A3** : cache key providers-health V2 → `providers-health:v2:{env}:{pv}:{bucket}`, `active_prompt_version()` fail-soft (env → council_prompt_versions → défaut), zéro I/O hot path |
| #423 | nemesis-backend | master | **B1 backend** : `GET /api/v1/multi-ia/debt-horizon` (repair_rate/fail_rate/trend/top_errors par provider, 200-toujours) + fix test cassé `test_start_council_passes_through_providers` |
| #356 | nemesis-core-ops | branche #354 | **B1 frontend** : `<DebtHorizon />` sur MultiIA.tsx (conventions #354, sparkline SVG maison, zéro dépendance, 180 tests verts) |
| #424 | nemesis-backend | branche #416 | **B3** : node passthrough `Collect failed patterns` (RPC `insert_failed_pattern`, jamais bloquant) + patch script avec garde-fous ABORT + `export_wf19.py` (resync drift) + RPC/DDL versionnés a posteriori |
| #425 | nemesis-backend | branche #416 | **B2** : `cache_key = md5(canonicalize(topic)+concept+prompt_version_id)` (MD5 pure-JS embarqué), RPC `match_council_cache_v2` (exact match → fallback embedding filtré pv, legacy pv-NULL servable), `skip_cache` propre sur POST /start, anchors byte-exact sur les 4 nodes patchés |
| — | nemesis-backend | branche #414 | Commit `24fd3a8` poussé sur la PR #414 : **fix du défaut `N8N_WF19_ID`** (`HvnCfT17GowSi6sF` → `VK7gCZQLMTIZc53u`) — l'ancien défaut aurait fait le rollback sur le mauvais workflow |
| #429 | nemesis-backend | master | **Tests + CI** : les 11 tests cassés de master réparés à la cause racine (2 tests périmés + pollution d'ordre `sys.modules` dans les fixtures client) ; `continue-on-error` retiré du step pytest — 1011 verts × 2 runs |
| #430 | nemesis-backend | master | **C3** : `dissent_flag` + `dissent_reasons` par synthèse (migration additive + `computeDissentFlag` seuils tunables `$env` + patch script anchors byte-exact) |
| #431 | nemesis-backend | master | **Sécurité** : `verify_nemesis_key` fail-closed (503 si `NEMESIS_SECRET_KEY` non configurée en prod, escape hatch `NEMESIS_ALLOW_INSECURE_NO_AUTH`) — ⚠️ vérifier la clé sur Railway avant merge |

## Ordre de merge recommandé

1. **#421 (secrets)** — puis **rotation immédiate** de toutes les clés du runbook (elles restent dans l'historique git ; purge `git filter-repo` à planifier après rotation).
2. #413, #414 (avec le fix ID), #416, #354 — tes 4 PRs existantes, toutes mergeable clean.
3. #423 (B1 backend), puis les stackées : #422 (après #415), #356 (après #354), #424 et #425 (après #416) — GitHub retarget automatiquement la base au merge du parent.
4. #431 (auth fail-closed) — **après** avoir vérifié `NEMESIS_SECRET_KEY` sur Railway. #430 (C3) quand tu veux.
5. #429 (CI bloquante) en dernier ; après merge de #423, retirer la ligne `--deselect` commentée dans ci.yml.

## Déploiement WF19 (toi uniquement, avec N8N_API_KEY)

Ordre strict : **migration SQL d'abord, patch n8n ensuite** (jamais l'inverse).
```bash
# B3 (RPC déjà en prod, rien à migrer)
python scripts/wf19/patch_wf19_failed_patterns.py --execute
# B2
supabase db query --linked --agent yes --file sql/migrations/v42_cache_canonical_key.sql
python scripts/wf19/patch_wf19_cache_canonical_key.py --execute
# après chaque patch :
python scripts/wf19/export_wf19.py   # resynchronise n8n/workflows/WF19_MULTI_IA_COUNCIL.json
```
Chaque patch script : GET live → snapshot horodaté (imprimé, utilisable par `rollback_to_v2.py --snapshot`) → ABORT si drift/déjà-patché → PUT → deactivate → 3 s → activate (body `{}`). Probe conseillé après chaque : council test + `SELECT` sur la table concernée.

## Trouvailles critiques hors Tier List

1. **Secrets** : bien pire qu'annoncé — 20+ clés réelles pleine longueur trackées (OpenAI, Anthropic, GitHub PAT, Discord bot, OAuth Google/Microsoft + refresh token, etc.). Et **`services/wf_architect_service.py:27` hardcode un JWT n8n réel comme fallback exécutable** — non touché (risque de casser le sync WF si l'env var manque sur Railway) : définir `N8N_API_KEY` sur Railway → révoquer la clé → PR dédiée pour supprimer le fallback.
2. **Auth fail-open** : `verify_nemesis_key` laisse tout passer en prod si `NEMESIS_SECRET_KEY` absente (défaut `development_secret_change_in_production` dans config). Corrigé par la PR #431 (fail-closed + escape hatch `NEMESIS_ALLOW_INSECURE_NO_AUTH`).
3. **CI non-bloquante** : `continue-on-error` sur pytest → master avait 11 tests cassés invisibles (3 stables + 8 par pollution d'ordre inter-tests via purge `sys.modules` sans restauration dans les fixtures). Corrigé à la racine par la PR #429.
4. **Drift WF19 repo↔live** : l'export versionné est antérieur au parser v4.1 déployé. `export_wf19.py` (PR #424) résout ; à lancer après chaque patch.
5. **5 councils zombies** en `status='running'` (dont 2 du 2026-07-03). SQL de clôture prêt (à exécuter toi-même, décision prod) :
```sql
UPDATE multi_ia_councils SET status = 'failed'
WHERE status = 'running' AND created_at < now() - interval '2 hours';
```
6. **nemesis-cockpit** : doublon Next.js abandonné (1 commit) qui lit Supabase avec la **service-role key** pour du read-only — archiver ou acter, et retirer la clé dans tous les cas.
7. **Infra n8n Railway** : image `n8nio/n8n:latest` non épinglée (un redeploy peut casser les 77 nodes silencieusement), `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (tout Code node lit les clés), vars `N8N_BASIC_AUTH_*` obsolètes (fausse impression de protection).
8. **Migrations** : 51 fichiers SQL, 3 dossiers, 3 conventions, zéro rollback, zéro tracking — consolider sur `supabase/migrations/` + table `schema_migrations` (chantier à part).

## Tier List — état après session

| Item | Statut |
|------|--------|
| S1–S3, A1, A2 | ✅ (sessions précédentes) |
| A3 | ✅ PR #422 |
| B1 | ✅ PRs #423 + #356 |
| B2 | ✅ PR #425 (déploiement : toi) |
| B3 | ✅ PR #424 (déploiement : toi) |
| C3 | ✅ PR #430 (déploiement : toi) |
| B4, C1, C2, C5 | 📋 designs prêts ci-dessous |
| C4 | ⏳ non traité (dépend n8n + décision A/B) |

## Designs prêts pour la suite (issus de la synthèse d'audit croisée)

- **B4 Constitutional Layer** (`← master`) : `constitutions/v1.md` (5 invariants, réutiliser ceux déjà rédigés dans `services/council_security.py` — 423 lignes mortes à réactiver partiellement), `services/council_constitution.py` (load + SHA-256, expose `CONSTITUTION_HASH`), migration additive `constitution_hash`/`consensus_vector`, patch WF19 injectant une version condensée (<600 tokens) dans les 2 prompts synth. ⚠️ Tout changement de prompt synth **doit bumper `council_prompt_versions`** (nouvelle row `v4.2.0-…`, `deprecated_at` sur l'ancienne) sinon le cache B2 sert des synthèses d'un autre régime. Item le plus gros — à découper.
- **C1 Circuit breakers providers** (`← master`) : RPC `provider_breaker_states()` (fenêtre 15 min sur metrics_log/failed_patterns, open si fail_rate>0.6 sur ≥3 samples), node gate avant le fan-out injectant des pseudo-réponses `circuit_open` (réutilise le chemin http_error du parser — zéro modif parser), fail-open si Supabase down, `retryOnFail` 3→2. Les skippés comptent au dénominateur du quorum. Inerte tant que metrics_log est peu dense (14 rows) — dépend de B3 en prod.
- **C2 Budget temps** : ta consigne « 45 s global » est incompatible avec l'architecture (ack immédiat + rounds 7×120 s + synth 180 s). Proposition à valider : **45 s par appel provider** (timeout enrich 120→45 s, maxTries 3→2, Perplexity verify 90→45 s) + **budget wall-clock global paramétrable** (`COUNCIL_TIME_BUDGET_S`, défaut 900 s) dans la condition du Loop, sortie en `partial_completed` avec synthèse finale quand même. Le IF de boucle est le point le plus sensible du WF — patch avec anchors + probe obligatoire.
- **C5 Decision Log par round** : `markdown_narrative`/`decision_layer` existent déjà en base (remplis seulement pour `is_final`) — étendre le prompt synth round (≤300 mots, markdown DANS un champ JSON string, jamais en texte libre), parse tolérant (absent ⇒ null). Même coordination bump prompt_version que B4 → **ordonner B4 puis C5**. Frontend : `react-markdown` déjà installé.

## Questions qui t'attendent (bloquantes pour la suite)

1. **Rotation des secrets** : GO pour rotater les 20 services du runbook ? (OpenAI, PAT GitHub et bot Discord = les plus dangereux). Le password `nemesi…2025` est réutilisé sur 4 surfaces — valeurs distinctes à la rotation.
2. **C2** : valides-tu la réinterprétation 45 s/appel + budget global 900 s ?
3. **council_prompt_versions** : les 3 `prompt_text` sont des stubs (27 chars). Backfiller les vrais prompts avant B4/C5 ? Convention de bump confirmée ?
4. **CORS** : vérifier `vercel.app` dans `ALLOWED_ORIGINS` de l'edge function avant d'activer DebtHorizon en prod (le commentaire d'edge-proxy dit « lovable.app OK, vercel.app NOT yet »).
5. **ENABLE_PROVIDERS_HEALTH_V2** : quand actives-tu le flag sur Railway (Redis requis) ? Conditionne l'utilité d'A3 côté runtime.
6. **nemesis-cockpit** : archiver ?
7. **Councils zombies** : exécuter le SQL de clôture ci-dessus ?
8. **failed_patterns decay 14 j** : cron n8n nightly (`DELETE WHERE last_seen < now()-'14 days'`) — inclus nulle part, item séparé si tu veux.

## Chiffres de session

- 3 workflows ultracode (audit + 2 batches), **30 agents** spécialisés dont reviews adversariales systématiques — chaque review a attrapé au moins un vrai défaut : clé prod 64-hex manquée par le sweep, httpx bloquant dans le hot path async, trou fail-soft sur body 200 non-JSON, resync d'export destructif, anchors de patch incomplets.
- **9 PRs créées + 1 commit fix sur la PR #414**. Suite backend : 1001→1011 verts avec CI bloquante (#429) ; frontend : 164→180 verts.
- Aucun secret dans les diffs/PR bodies ; aucun push forcé ; aucune écriture en prod (Supabase lu en read-only, n8n non touché).

---

# ADDENDUM — Session étendue (2026-07-05 → 07) : mission UI « Memorable » sur nemesis-core-ops

La session s'est poursuivie bien au-delà du périmètre backend initial. Résumé chiffré :

## Déployé sur main de nemesis-core-ops (16 PRs mergées)
- **Stack « Matière télémétrique » #357→#365** (fonts self-hosted, socle matière, hooks anti-races,
  motion View Transitions, data-viz tokenisée, 2 sweeps de pages, sécurité gate+clé centralisée)
  + **#354/#356** (QuorumBadge/EqrMetric + DebtHorizon) — mergés et déployés.
- **Vague 4 #366→#369** : sweep 14 pages restantes + polish MultiIA (badge dissent C3 front)
  + harness CI (bundle-budget, régression visuelle).
- **T-12 #370** : assets branding optimisés — dist 12,12 → 4,5 MB (−63 %), preload 1,44 MB → 34 KB.
- **Mission Memorable #371→#376** : tokens OKLCH SSOT (Radix-scale + tokens.json W3C) ;
  6 composants canoniques framework-tier (Surface, StatusBadgeV2, SkeletonV2/SpinnerV2, EmptyState,
  MetricTile, DataTable — stories + axe + property-based) ; doctrine UI_DOCTRINE.md (10 tenets) ;
  drop framer-motion (−42 KB gzip) ; RUM Web Vitals + Attribution API ; check-v2-contract + gates CI ;
  cockpit modes ⌘M ; focus/texture signatures ; README manifeste ; blog BUILDING_NEMESIS_UI.md ;
  rapport final docs/NEMESIS_UI_MEMORABLE_REPORT.md.

## Metrics (baseline 6126cec → main 0122b98)
tests 279 → 581 · framer-motion 42 KB → 0 · warnings Tailwind ambiguous 2 → 0 · dist −63 %
· 6 canoniques · 5 ADRs + 7 design-specs · doctrine 10 tenets · CI frozen-lockfile réparée.

## Méthode
Orchestration multi-agents (~15 workflows) : audits parallèles, judge panels 3×3 à biais orthogonaux,
adversarial verify systématique (les 6 canoniques ont échoué leur 1ère revue — 15 majors invisibles
au gate mécanique, corrigés avec tests de non-régression, re-verify 6/6 pass).

## Backlog résiduel (Vague C)
Split CSS d'entrée (98 % budget) → refactor pass P-01→P-08 (adoption canoniques, codemod 211 couleurs,
unification toasts) → M-04 cognitive ⌘⇧C → M-02 smart-palette / M-05 temporal (ADR selon backend)
→ Storybook Vercel /storybook → expansion blog 1000→2800 mots.

---

# Addendum 2 — Vague C complète (2026-07-08)

Le backlog résiduel ci-dessus est soldé. 8 PRs core-ops supplémentaires mergées (#377→#384),
main à `09621cb` (+#383/#384 en cours de merge à l'heure de cet addendum).

## Livré
- **#377 — Infra Vague C** : split CSS route-level (T-08, cascade protégée `:where()`),
  codemod 417 couleurs → tokens (P-01, alphas hors échelle en oklch relatif), unification
  toasts `notify()` (P-04, 51 call-sites, −1 dépendance Radix), 404 signature Konami (B-04).
- **#378 + #380 — Adoption P-02, 10 pages tier-A** (2 batches de 5) : `/`, `/multi-ia`,
  `/health`, `/ops`, `/audit-trail`, `/hermes`, `/agents`, `/market`, `/memory`,
  `/infrastructure` sur les 6 canoniques. Présentation feuille uniquement, gains
  d'honnêteté concrets (erreurs dans les tables avec retry, plus d'effacement de données
  valides sur erreur de refetch, plus de zéros fabriqués).
- **#379 — ADR-006/007** : palette AI skippée sur faits (pas de proxy d'inférence,
  pas de réseau sur le chemin clavier d'incident) → smart-palette frécence ;
  navigation temporelle ship scope réduit gated sur précondition RLS binaire.
- **#381 — M-04 mode cognitif ⌘⇧C** : orthogonal aux modes ⌘M, texte ×1.15 composé,
  cibles élargies, décor coupé, jamais un état masqué. 2 majors prouvés puis re-prouvés
  en navigateur post-build (escape hatch `:where()` factice — px-4 écrasé 16→9.2px ;
  cliquet one-way storage bloqué, aussi corrigé dans ⌘M).
- **#382 — Canoniques v0.9.1** : `minDelta` opt-in MetricTile (fix racine du gel du
  countup), `kind=fraction` StatusBadgeV2 (tone auto honnête).
- **#383 — Publication** : blog 1030 → 2957 mots (pièges + pipeline de revue),
  rapport Memorable v2 aux chiffres mesurés.
- **#384 — Storybook `/storybook`** sur le déploiement Vercel (33 stories, SW denylist,
  rewrite avant catch-all, chaîne buildCommand vérifiée en local de bout en bout).

## Metrics finales (baseline 6126cec → main 09621cb)
tests 279 → **664** · entry **62.39 KB** gzip (92 % du budget) · CSS 28.98 KB (88 %)
· dist 12.12 → **4.5 MB** · 10 pages tier-A sur canoniques · 7 ADRs · 33 stories
· modes ⌘M ×4 + cognitif ⌘⇧C · 0 ambiguous · frozen-lockfile verte.

## Méthode (constante)
Chaque livraison : impl → skeptic adversarial → fix par un tiers → re-verify frais.
4 pages sur 10 et M-04 ont échoué leur première revue — 6 majors transverses, tous
invisibles au gate mécanique, tous documentés dans les briefs des batches suivants
(zéro récidive constatée au batch 3). Trois revues fauchées par la limite de dépense
ont été reprises inline, aucune sautée. Fable 5 de bout en bout.

## Backlog transmis
P-02 tier-B (~15 pages, briefs prêts) · entry <40 KB (ADR split vendor) ·
smart-palette (ADR-006 accepted) · temporal nav (P-0 RLS à vérifier en 1 session) ·
Surface tone warning + MetricTile amber · composants partagés legacy (CrownCouncil,
ServicesHub, MarketIntelPanel…).
