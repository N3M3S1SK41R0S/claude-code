# Essai VELUM — Web (PWA) + iPhone

Deux chemins. Le **A (démo)** te donne une app installable sur iPhone et sur le
web **aujourd'hui, sans backend ni clé**. Le **B (complet)** ajoute le vrai
backend (analyse photo→IA, valorisation réelle) une fois Supabase configuré.

La PWA sert **les deux plateformes à la fois** : sur iPhone, on l'installe
depuis Safari via « Ajouter à l'écran d'accueil » (icône, plein écran,
hors-ligne) — **aucun App Store, aucun compte Apple requis**.

Hébergeur retenu : **Vercel** (offre gratuite suffisante).

---

## A. Démo web + iPhone — immédiat, sans backend

Le mode démo tourne 100 % en mémoire (client factice, données fictives) — idéal
pour montrer les 4 modules et l'ergonomie tout de suite.

```bash
# à la racine velum/
pnpm install
EXPO_PUBLIC_DEMO=1 pnpm --filter velum-mobile build:web    # → apps/mobile/dist

# déploiement (première fois : la CLI ouvre une connexion Vercel dans le navigateur)
npx vercel --cwd . deploy apps/mobile/dist --prod
```

`vercel deploy <dossier>` publie le dossier statique tel quel et renvoie une URL
`https://velum-xxxx.vercel.app`. C'est ton essai web **et** iPhone.

> Astuce : `--clear` est requis sur `expo export` **uniquement** quand tu changes
> une variable `EXPO_PUBLIC_*` entre deux builds (cache Metro).

---

## B. Web complet (vrai backend Supabase) — le vrai essai

### B.1 Backend Supabase (une fois)

Prérequis : projet **Supabase** de prod + le CLI `supabase` connecté. Détail
complet dans [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) et [DEPLOYMENT.md](./DEPLOYMENT.md) §5.

```bash
cd velum/supabase
supabase link --project-ref <ton-ref>
supabase db push                 # migrations : schéma + RLS + triggers + consume_scan
supabase functions deploy        # recognize, analyze-*, valuate, cellar-pairing, webhooks…
supabase secrets set --env-file functions/.env   # d'après functions/.env.example
```

Secrets serveur requis (jamais côté client) — au minimum pour l'analyse :
`LLM_VISION_PROVIDER` + `LLM_VISION_API_KEY`. Tu as les **trois** clés : choisis
le fournisseur en une ligne, la clé correspondante suffit.

| `LLM_VISION_PROVIDER` | Clé à mettre dans `LLM_VISION_API_KEY` | Modèle défaut |
|---|---|---|
| `anthropic` *(défaut)* | clé Anthropic (`sk-ant-…`) | `claude-sonnet-5` |
| `openai` | clé OpenAI (`sk-…`) | `gpt-5.5` |
| `google` | clé Google AI Studio (Gemini) | `gemini-3.5-flash` |

Pour forcer un modèle précis (facultatif) : `LLM_VISION_MODEL=…`. Les sources
marché (`NUMISTA_API_KEY`, `ARTPRICE_API_KEY`, `EBAY_API_KEY`,
`COLNECT_API_KEY`, `DELCAMPE_API_KEY`, `FX_API_KEY`) enrichissent la
valorisation mais sont optionnelles pour un premier essai.

Récupère ensuite, dans les réglages du projet Supabase (API) :
- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publique par conception)

### B.2 Déploiement Vercel (build géré par Vercel)

Le dépôt fournit **`velum/vercel.json`** (install + build + `outputDirectory`
+ routage des routes dynamiques). Dans Vercel :

1. **New Project** → importe le dépôt GitHub.
2. **Root Directory** = `velum`.
3. **Environment Variables** :
   - `EXPO_PUBLIC_SUPABASE_URL` = *(ton URL Supabase)*
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = *(ta clé anon)*
   - *(optionnel)* `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
4. **Deploy**. Vercel exécute `pnpm install` puis `pnpm --filter velum-mobile
   build:web` et sert `apps/mobile/dist`.

> Variante CLI (build local) : crée `apps/mobile/.env` avec les deux variables
> `EXPO_PUBLIC_SUPABASE_*`, `pnpm --filter velum-mobile build:web`, puis
> `npx vercel deploy apps/mobile/dist --prod`.

### B.3 Redirection OAuth (si connexion Google/Apple)

Dans Supabase → Authentication → URL Configuration, ajoute l'URL Vercel aux
**Redirect URLs** (sinon la connexion tierce échoue). Le compte e-mail et le
**mode démo** fonctionnent sans cette étape.

---

## C. Installer sur iPhone (PWA)

1. Ouvre l'URL Vercel dans **Safari** (iOS).
2. Bouton **Partager** → **Sur l'écran d'accueil** → *Ajouter*.
3. VELUM apparaît avec son **sceau** (icône `apple-touch-icon`), se lance en
   **plein écran** (barre d'état velours), et reste consultable **hors-ligne**
   (collection en cache).

Rien à installer côté Apple. Pour une **app native TestFlight/App Store**
(distribution large, achats intégrés), voir [DEPLOYMENT.md](./DEPLOYMENT.md) §1
et §6 — cela nécessite un compte Apple Developer et un build EAS.

---

## Ce qu'il te faut (récap)

| Chemin | Comptes/clés requis | Délai réaliste |
|---|---|---|
| **A. Démo** | un compte Vercel | ~15 min |
| **B. Complet** | Vercel + Supabase (prod) + clé LLM vision | ~½ journée (surtout la config de tes comptes) |
| Natif iPhone (TestFlight) | + Apple Developer (99 $/an) + EAS | jours→semaines (gaté par Apple) |
