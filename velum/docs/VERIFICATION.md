# VELUM — Rapport de vérification (Definition of Done §18)

> Dernière exécution complète : **10 juillet 2026**, branche
> `claude/velum-production-spec-1lyh3m`. Chaque preuve ci-dessous a été
> **réellement exécutée** dans l'environnement de build (pas une revue sur
> papier) ; les commandes sont rejouables et câblées dans la CI
> (`.github/workflows/velum-ci.yml` : jobs `verify`, `edge-functions`, `sql`).

## Synthèse

| # DoD | Critère | État | Preuve |
|---|---|---|---|
| 1 | Parcours cœur des modules sur iOS + Android + Web | ✅ web / ⚠ devices | 4 plugins `recognize/analyze/valuate` testés ; **tous les écrans authentifiés rendent sur Chromium réel** (collection, carnet, fiche ZAPPA + courbe IC, sommelier, marché, profil — `e2e/auth-screens.mjs`, stub réseau) ; iOS/Android : même codebase Expo, à valider sur simulateur après `eas build` (comptes requis) |
| 2 | Moteur de valorisation couvert par tests | ✅ | 22 tests `@velum/valuation` (MAD, médiane pondérée, IC bootstrap seedé, fiabilité, devise) |
| 3 | Hors-ligne, exports, alertes | ✅ | File de mutations LWW testée (queue.test.ts) ; exporters PDF/CSV/assurance testés ; alertes évaluées par `price-cron` + push Expo ; quota/alerte vérifiés en SQL réel |
| 4 | Accessibilité WCAG 2.2 AA + mode senior | ✅ audit / ⚠ lecteurs | Contrastes AA prouvés par tests ; **audit axe-core WCAG 2.2 AA sur 8 écrans rendus : 0 violation** (`pnpm a11y`) ; cibles ≥44/56 pt ; VoiceOver/TalkBack à passer sur device (checklist DEPLOYMENT) |
| 5 | Monétisation opérationnelle | ✅ code / ⚠ sandbox | 4 paliers, RevenueCat + « Restaurer les achats », webhook plan→serveur ; achats sandbox exigent les comptes stores |
| 6 | Sécurité/RGPD | ✅ | Secrets serveur uniquement ; RLS **exécutée et testée** sur Postgres 16 (8 assertions) ; purge compte in-app + cascade vérifiée ; consentement IA in-app ; politique in-app `/privacy` |
| 7 | Checklist stores + binaires | ⚠ | Checklist 60 points rédigée (DEPLOYMENT.md), fiches ASO comptées (STORE_LISTING.md), screenshots brouillons générés ; `.ipa`/`.aab` exigent comptes Apple/Google + EAS |
| 8 | Documentation | ✅ | README, AGENTS, ARCHITECTURE, DATABASE, DEPLOYMENT, PRIVACY, DEMO_ACCOUNT, STORE_LISTING, CONTRIBUTING, VERIFICATION |

## Preuves détaillées

### TypeScript — 10/10 packages, 324 tests
```bash
pnpm typecheck   # Tasks: 10 successful, 10 total (tsc strict, noUncheckedIndexedAccess)
pnpm test        # Tasks: 10 successful, 10 total
```
Répartition : valuation 22 · config 10 · wine 39 · coin 40 · art 36 · stamp 31
· ui 39 (dont ratios de contraste WCAG ≥ 4.5:1 vérifiés numériquement)
· api-client 47 (mappers, repos, file offline last-write-wins) · app 36
(exporters, courbe de valeur, plan, carnet, apogée) · core 0 (types purs).

### Edge Functions — `deno check` 10/10
```bash
cd supabase/functions && deno check --import-map=import_map.json \
  recognize/index.ts analyze-{wine,coin,art,stamp}/index.ts valuate/index.ts \
  cellar-pairing/index.ts price-cron/index.ts revenuecat-webhook/index.ts \
  delete-account/index.ts
```
Les fonctions importent les MÊMES plugins et le MÊME moteur §7 que l'app
(import map → sources du monorepo) : pas de logique dupliquée.

### SQL — migrations + comportement sur PostgreSQL 16.13 réel
```bash
sudo -u postgres bash supabase/tests/run-local.sh   # VALIDATION SQL : PASS
```
8 assertions vertes : isolation RLS (items/profils/valuations), quota
**5 scans/semaine PAR module** puis premium illimité, annonces réservées
Platine, commission 5 %, trigger d'expertise obligatoire > 500 € (bloque
sans rapport, passe avec), storage cloisonné par préfixe `uid/`, purge RGPD
en cascade. (`0002_cron.sql` = plateforme uniquement : pg_cron/pg_net.)

### Web (PWA) — export + E2E sur Chromium réel
```bash
pnpm --filter velum-mobile build:web   # expo export : toutes les routes statiques
pnpm e2e                               # E2E web : PASS
```
Parcours vérifié en navigateur réel : vidéo d'intro du sceau → « Passer » →
pitch → les 4 modules proposés → `/privacy` rendue → zéro erreur JS.

**Écrans authentifiés** (`pnpm e2e:auth`) : les routes protégées sont rendues
hors-ligne en interceptant le réseau Supabase (REST + Edge Functions) avec des
fixtures conformes et une session semée. Les 6 écrans passent (assertion de
contenu + zéro erreur JS) — collection (portefeuille 643 €, plus-value,
bandeau « à boire »), carnet Gold (cave par emplacements, badge Platine),
fiche vin (valorisation 51 €, IC 80/95 %, fiabilité, courbe SVG, disclaimer),
sommelier, marché, profil. C'est la première exécution *au rendu* de ces
écrans (jusque-là seulement typecheckés).

Screenshots stores (11 écrans, 1320×2868) : `pnpm screens`
→ `docs/screenshots/*.png` — publics (`store-screens.mjs`) + authentifiés
(`auth-screens.mjs`).

### Accessibilité — audit axe-core WCAG 2.2 AA
```bash
pnpm a11y   # Audit a11y : PASS (aucune violation serious/critical)
```
Scan du DOM réellement rendu (tags `wcag2a/2aa/21a/21aa/22aa`) sur 8 écrans
(publics + authentifiés) — **0 violation**. Défauts trouvés *en auditant* et
corrigés (aucun n'aurait été vu par un test unitaire) : titre de document
manquant sur toutes les pages (composant `WebDocumentTitle` par route, 2.4.2) ;
badge « Populaire » à 4.38:1 sur son fond teinté (tonalité `success` éclaircie,
verrouillée par test) ; chips du carnet en `role="tab"` sans parent `tablist`
(→ `button`) ; bouton « Déplacer » imbriqué dans une ligne cliquable
(→ deux boutons frères).

### Dépendances — audit sécurité
```bash
pnpm audit --prod   # No known vulnerabilities found
```
Deux avis modérés (postcss, uuid — outillage de build) corrigés par
overrides pnpm ; `npx expo config --type prebuild` re-vérifié après override.

## Reste à faire (nécessite les comptes du propriétaire)

1. `eas build --profile production` iOS/Android + soumission (DEPLOYMENT.md).
2. Clés API des sources de prix + `supabase secrets set` ; `supabase db push`.
3. Produits/entitlements RevenueCat + webhook configuré ; achats sandbox.
4. Hébergement de la PWA (URL publique `/privacy` pour les fiches).
5. VoiceOver/TalkBack sur devices ; screenshots définitifs (écrans
   authentifiés via compte démo — seed fourni).
6. Logo final → `apps/mobile/assets/brand/logo.png` + icônes.
