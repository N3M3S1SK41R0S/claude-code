# VELUM — Démarrage rapide

Trois niveaux, de la démo sans compte au backend complet.

## Prérequis

- Node 22 et pnpm 10.
- Chromium pour les preuves visuelles : `npx playwright install chromium`.

```bash
git clone https://github.com/N3M3S1SK41R0S/claude-code
cd claude-code/velum
corepack enable
pnpm install --frozen-lockfile
```

## Niveau 0 — Démo instantanée

L’application complète tourne sans compte ni clé : reconnaissance simulée, fiches, vrai moteur de valorisation, collection, carnet et sommelier.

```bash
pnpm demo
```

Le profil démo est Platine et contient les cinq domaines. Pour vérifier le parcours sans serveur de développement :

```bash
pnpm --filter velum-mobile demo:export
node e2e/demo-smoke.mjs
```

## Niveau 1 — Interface web sans backend

```bash
cat > apps/mobile/.env <<'ENV'
EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=demo
ENV
pnpm --filter velum-mobile dev
```

Le backend est factice, mais l’onboarding, les cinq modules, les écrans de capture, les formules et la confidentialité sont consultables.

## Niveau 2 — Preuves navigateur reproductibles

```bash
npx playwright install chromium
pnpm --filter velum-mobile build:web
pnpm screens
```

Contrôles individuels :

```bash
pnpm e2e        # onboarding → cinq modules → confidentialité
pnpm e2e:auth   # écrans authentifiés, dont fiche et Écrin Montres
pnpm a11y       # WCAG 2.2 AA avec axe-core
pnpm senior     # agrandissement réel du rendu
pnpm offline    # lecture depuis le cache persistant
```

Validation code et backend :

```bash
pnpm typecheck
pnpm lint
pnpm test
cd supabase/functions
deno check --import-map=import_map.json $(find . -mindepth 2 -maxdepth 2 -name index.ts -not -path './_shared/*' -not -path './tests/*' | sort)
deno test -A --import-map=import_map.json tests/
cd ../..
bash supabase/tests/run-local.sh
```

Les compteurs de tests ne sont pas figés dans ce document : la source de vérité est le dernier run `VELUM CI`, qui découvre également les Edge Functions au lieu d’entretenir une liste statique.

## Niveau 3 — Backend complet

Le scan et l’estimation réels utilisent Supabase Edge Functions, un fournisseur de vision et des sources de prix autorisées.

- Local : `supabase start`, `supabase db reset`, puis `supabase functions serve --env-file supabase/functions/.env`.
- Production : `supabase link`, `supabase db push`, puis le workflow de déploiement documenté dans [DEPLOYMENT.md](./DEPLOYMENT.md).

Voir [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) pour les secrets et [DEPLOYMENT.md](./DEPLOYMENT.md) pour les contrôles de publication.
