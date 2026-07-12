# VELUM — Démarrage rapide (voir & tester)

Trois niveaux, du plus simple (zéro compte) au plus complet.

## Prérequis
- **Node ≥ 20** et **pnpm 10** (`corepack enable` l'installe).
- Facultatif : **Chromium** pour les preuves visuelles (`npx playwright install chromium`).

```bash
git clone https://github.com/N3M3S1SK41R0S/claude-code
cd claude-code && git checkout claude/velum-production-spec-1lyh3m
cd velum
corepack enable
pnpm install
```

---

## Niveau 1 — Naviguer dans l'app (web, sans backend)

L'app a besoin de deux variables pour démarrer (valeurs factices : l'UI se
navigue, mais scan/connexion ne renvoient rien tant qu'il n'y a pas de
Supabase — voir niveau 3).

```bash
printf 'EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=demo\n' > apps/mobile/.env
pnpm --filter velum-mobile dev      # puis appuie sur "w" (ouvre http://localhost:8081)
```

Tu peux parcourir : onboarding (vidéo du sceau) → choix des 4 modules →
écrans de capture, formules, confidentialité. Sur téléphone : installe
**Expo Go** et scanne le QR affiché.

### Dépannage
| Symptôme | Cause / solution |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL … requis` | Le fichier `apps/mobile/.env` manque (commande ci-dessus). |
| Page blanche au 1er lancement | Attends la fin du bundling Metro (première fois = ~1 min). |
| Le port 8081 est pris | `pnpm --filter velum-mobile dev -- --port 8082`. |
| `pnpm: command not found` | `corepack enable` puis rouvre le terminal. |

---

## Niveau 2 — Voir l'app « fonctionner » sans compte (backend simulé)

Ce sont les scripts qui produisent les captures de `docs/screenshots/` : ils
rendent l'app dans un vrai Chromium avec un backend **simulé** (fixtures).
C'est le plus proche de l'app en marche sans configurer Supabase.

```bash
npx playwright install chromium
pnpm --filter velum-mobile build:web    # exporte la PWA dans apps/mobile/dist
pnpm screens                            # régénère les 13 captures (docs/screenshots/)
```

Preuves individuelles (chacune affiche PASS/FAIL) :
```bash
pnpm e2e        # parcours d'entrée (onboarding → 4 modules → confidentialité)
pnpm e2e:auth   # écrans connectés (collection, carnet, fiche, sommelier, marché, profil)
pnpm a11y       # audit accessibilité WCAG 2.2 AA (axe-core) — 0 violation
pnpm senior     # mode senior : bouton 46→56 pt, titre 28→35 px
pnpm offline    # collection lue depuis le cache, réseau coupé
```

Tests unitaires et backend :
```bash
pnpm test                                   # 324 tests (10 packages)
pnpm typecheck                              # TypeScript strict, 10/10
cd supabase/functions && deno test -A --import-map=import_map.json tests/   # 17 tests Edge
```

---

## Niveau 3 — App pleinement fonctionnelle (scan réel)

Le scan/estimation appelle des Edge Functions Supabase (vision IA + sources
de prix). Il faut donc un backend. Deux voies, détaillées dans
**[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** :

- **Local** (`supabase start` + `supabase db reset` + `functions serve`) —
  idéal pour tester de bout en bout sur ta machine, avec le compte démo
  pré-rempli (`demo@velum.app`).
- **Production** (`supabase link` + `db push` + `functions deploy`) — pour
  publier ; suite dans [DEPLOYMENT.md](./DEPLOYMENT.md).

Il te faudra au minimum une clé de modèle de vision (Anthropic ou Gemini) ;
les sources de prix sont optionnelles (l'app se dégrade proprement sans elles).
