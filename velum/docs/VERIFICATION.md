# VELUM — Rapport de vérification

> État documentaire : **17 juillet 2026**. Le verdict exécutable d’une révision est le run **VELUM CI attaché à son SHA**. Ce rapport ne fige plus de compteurs de tests, de packages ou de fonctions : ils évoluent avec le monorepo et la CI les découvre dynamiquement.

## Definition of Done

| Critère | Preuve automatisée | Preuve externe restante |
|---|---|---|
| Cinq modules sur Web | `typecheck`, Vitest, export Expo, `web-smoke`, `auth-screens` et mode démo | Validation iOS/Android après build EAS |
| Moteur de valorisation | Tests unitaires : normalisation, MAD, médiane pondérée, bootstrap, fiabilité, calibration point-in-time | Suivi de calibration en production |
| Backend | Découverte et `deno check` de toutes les Edge Functions, tests HTTP avec réseau stubbé | Smoke tests après déploiement Supabase |
| Base et RLS | Rejeu de toutes les migrations applicables sur PostgreSQL réel, tests RLS, quotas, Storage, alertes et RPC transactionnelles | `supabase db push` sur le projet de production |
| Accessibilité | axe-core WCAG 2.2 AA, preuve de mode senior, cibles tactiles | VoiceOver et TalkBack sur appareils |
| Hors-ligne | démarrage à froid avec réseau coupé et lecture du cache persistant | Test de longue durée sur appareils |
| Monétisation | grille de droits, RevenueCat, restauration, webhook et gating testés | Achats sandbox App Store / Play |
| Stores | textes FR/EN à cinq modules et plan de captures dans `STORE_LISTING.md` | Binaires, captures définitives et soumission |

## Commandes de référence

### Monorepo

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Le workspace contient actuellement treize packages, dont `@velum/domain-watch`. Le chiffre des tests est volontairement lu dans les logs du run, pas recopié ici.

### Edge Functions

```bash
cd supabase/functions
mapfile -t functions < <(
  find . -mindepth 2 -maxdepth 2 -type f -name index.ts \
    -not -path './_shared/*' -not -path './tests/*' | sort
)
deno check --import-map=import_map.json "${functions[@]}"
deno test --import-map=import_map.json -A tests/
```

La découverte dynamique empêche qu’une nouvelle fonction, telle que `analyze-watch`, reste hors contrôle par oubli dans une liste statique.

### PostgreSQL réel

```bash
bash supabase/tests/run-local.sh
```

Le script :

1. valide le plan de migrations et refuse les préfixes ambigus ;
2. rejoue les migrations sur PostgreSQL avec le stub Supabase ;
3. prouve le remplacement atomique du backtest de calibration ;
4. prouve les rôles Storage `dial`, `caseback`, `movement`, `clasp` ;
5. exécute le seed puis les contrôles d’alertes, RLS, quotas, marketplace et purge.

`0002_cron.sql` reste la seule migration de plateforme exclue localement car elle dépend de `pg_cron` et `pg_net`.

### PWA et écrans authentifiés

```bash
pnpm --filter velum-mobile build:web
node e2e/web-smoke.mjs
node e2e/auth-screens.mjs
node e2e/a11y-audit.mjs
node e2e/senior-screens.mjs
node e2e/offline.mjs
pnpm --filter velum-mobile demo:export
node e2e/demo-smoke.mjs
```

Le parcours authentifié couvre notamment : accueil, collection, Carnet et Écrin, fiches Vin/Pièce/Tableau/Timbre/Montre, Arbitre, sommeliers, Marché, Profil, dégustation et Communauté.

## Invariants contrôlés

- Aucune panne serveur n’est rendue comme un faux état vide ou un faux paywall.
- Aucune confiance hors `[0,1]` ne devient une certitude.
- Une cote partiellement indisponible ne produit pas de total trompeur.
- Le backtest n’utilise aucune observation postérieure à la vente tenue à l’écart.
- Une collecte de calibration vide conserve les preuves précédentes.
- Une analyse LLM n’est jamais présentée comme une source de marché.
- Les données de prix partenaires restent désactivées sans clé **et** autorisation contractuelle.
- Les secrets restent côté serveur et hors `EXPO_PUBLIC_*`.

## Validation manuelle requise avant publication

1. Builds EAS iOS et Android sur appareils représentatifs.
2. VoiceOver, TalkBack, caméra et sélecteur de photos natif.
3. Achats, restauration, expiration et changement de plan en sandbox.
4. Migrations et Edge Functions déployées sur Supabase, puis smoke tests live.
5. Sources de prix activées uniquement après validation des contrats d’accès et de redistribution.
6. Captures stores définitives, icône finale et compte de revue de production.
