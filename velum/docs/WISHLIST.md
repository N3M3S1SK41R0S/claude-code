# VELUM — Liste d'envies et d'idées par catégorie

> Besoin utilisateur (octobre 2026) : « pouvoir créer une liste de souhaits ou
> d'idées pour chaque catégorie (exemple : les vins que j'ai aimés et que je
> voudrais acheter plus tard) » et « des zones de recherche pour retrouver
> directement un élément ».

Une **envie** n'est pas un objet de la collection : elle ne crée ni item, ni
valorisation, ni consommation du quota de scans. Elle devient un objet
seulement si l'utilisateur, une fois l'envie **obtenue**, choisit « Ajouter à ma
collection ».

## 1. Modèle

| Couche | Fichier |
| --- | --- |
| Contrat TypeScript | `packages/core/src/wishlist.ts` (`WishlistEntry`, `NewWishlistEntry`, `WishlistPatch`) |
| Table Postgres | `supabase/migrations/20261023110000_wishlist.sql` (`public.wishlist_entries`) |
| Dépôt PostgREST | `packages/api-client/src/wishlist.ts` (`createWishlistRepo`, `VelumClient.wishlist`) |
| Démo en mémoire | `apps/mobile/lib/demo/demoWishlist.ts` |
| Logique pure de l'app | `apps/mobile/lib/wishlist.ts` |
| Écrans | `apps/mobile/app/wishlist/index.tsx`, `new.tsx`, `[id].tsx` |
| Bouton réutilisable | `apps/mobile/components/wishlist/AddToWishlistButton.tsx` |
| Ajout partagé (doublon + cache) | `apps/mobile/components/wishlist/useAddToWishlist.ts` (`addUnlessDuplicate` dans `lib/wishlist.ts`) |

Colonnes de `wishlist_entries` (miroir exact de `WishlistRow`) :

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | uuid | `gen_random_uuid()` |
| `owner_id` | uuid | → `profiles(id)` **on delete cascade**, immuable |
| `domain` | `velum_domain` | une liste par catégorie (vin, pièces, tableaux, timbres, montres) |
| `kind` | text | `wish` (à acquérir) · `idea` (piste à creuser) |
| `title` | text | non vide après `btrim`, ≤ 200 caractères |
| `notes` | text | « pourquoi je l'ai aimé », ≤ 2000 caractères |
| `attributes` | jsonb | objet, défaut `{}`, ≤ 16 Kio — mêmes clés que `items.attributes` du domaine |
| `source` | text | `manual` · `item` · `scan` · `tasting` · `market` |
| `source_item_id` | uuid | → `items(id)` **on delete set null** ; objet du **même** propriétaire |
| `target_price` | numeric(14,2) | ≥ 0, EUR, facultatif |
| `priority` | text | `low` · `medium` · `high` |
| `acquired` / `acquired_at` | bool / timestamptz | `acquired_at` posé / effacé **par trigger** |
| `created_at` / `updated_at` | timestamptz | `updated_at` rafraîchi par trigger, `created_at` immuable |

Index : `(owner_id, domain, acquired)` pour l'écran, et `source_item_id` partiel
pour le `ON DELETE SET NULL`.

## 2. Sécurité (RLS) et intégrité

- **RLS** : quatre policies `select` / `insert` / `update` / `delete`, toutes sur
  `owner_id = auth.uid()` — y compris en `WITH CHECK` (impossible d'insérer chez
  autrui ou de transférer une envie). `anon` n'a aucun droit sur la table.
- **Trigger `wishlist_entries_guard`** (BEFORE INSERT/UPDATE, SECURITY INVOKER) :
  - `acquired_at = now()` quand `acquired` passe à vrai (ou à la création d'une
    envie déjà obtenue), `NULL` quand il repasse à faux ; toute valeur fournie
    par le client est ignorée (pas d'antidatage) ;
  - `owner_id` ne peut pas changer, `created_at` est conservé ;
  - `source_item_id` doit désigner un objet du **même propriétaire** — vérifié
    pour tous les rôles, y compris le service-role qui contourne la RLS.
- **Suppression d'un objet** : l'envie qui en est issue reste ; son lien
  `source_item_id` repasse à `NULL`.
- **Purge RGPD** : `delete-account` supprime `auth.users` → `profiles` → cascade
  sur `wishlist_entries`. Aucune donnée hors base (pas de média) : l'Edge
  Function n'a rien d'autre à faire.

Tests SQL : `supabase/tests/features/wishlist_checks.sql` (défauts, contraintes,
isolation RLS lecture / modification / suppression, `WITH CHECK`, anon,
`acquired_at`, `updated_at`, objet d'origine d'autrui refusé — aussi pour le
service-role —, `ON DELETE SET NULL`, cascade RGPD).

## 3. Dépôt (`client.wishlist`)

- `list(domain?)` — envies en cours d'abord, puis les plus récentes (ordre
  garanti côté client aussi). Une panne lève `SOURCE_UNAVAILABLE` : jamais une
  liste vide trompeuse.
- `add(input)` — valide AVANT tout appel réseau (titre, notes, prix cible,
  attributs objet) → `INVALID_INPUT` ; `owner_id` vient de la session
  (`UNAUTHORIZED` sinon).
- `update(id, patch)` — patch partiel, jamais `acquired_at` ; patch vide = simple
  relecture.
- `remove(id)`.
- Erreurs PostgREST traduites : contrainte (`23514`, `23502`, `22P02`, `22001`,
  `22003`, `23503`) → `INVALID_INPUT` ; RLS (`42501`) → `UNAUTHORIZED` ; ligne
  absente (`PGRST116`) → `INVALID_INPUT` ; le reste → `SOURCE_UNAVAILABLE`.

## 4. Parcours

### « Mes envies » (`/wishlist?domain=…&q=…`, `routes.wishlist(domain, q)`)

1. **Ajouter une envie** en haut de l'écran.
2. **Catégorie** : une liste par catégorie + « Toutes » (vue groupée par
   catégorie) ; le paramètre `domain` de l'URL est respecté et tenu à jour.
3. **Statistiques** de la catégorie : envies / idées / obtenues et budget cible
   (somme des prix cibles des envies en cours).
4. **Recherche** insensible à la casse et aux accents (titre, notes, attributs
   d'identification) ; si rien n'est trouvé dans le segment affiché, des
   raccourcis indiquent les correspondances des autres segments ou des autres
   catégories. Le paramètre facultatif `q` la pré-remplit : la recherche
   globale (`/search`) ouvre « Ouvrir mes envies (N résultats) » via
   `routes.wishlist(null, requête)`, sur le premier segment qui contient un
   résultat (`segmentForQuery`) ; un résultat précis s'ouvre directement
   (`routes.wishlistEntry(id)`).
5. **Segments** Envies / Idées / Obtenues (avec compteurs) et **tri** :
   priorité, récentes, prix cible (sans prix en dernier).
6. Lignes : titre, extrait des notes, prix cible, badge de priorité, origine.

États distincts : chargement, panne (« Réessayer » ; une panne n'est jamais
présentée comme une liste vide), liste vide (invitation à ajouter + exemple de
vin), segment vide, recherche sans résultat.

### Ajout (`/wishlist/new?domain=…`)

Catégorie, envie / idée, **titre** (obligatoire — à défaut, composé à partir des
champs d'identification), notes, prix cible (saisie française « 59,90 »,
« 1 200 € »), priorité, et champs d'identification principaux du domaine
(`identityFieldsFor(domain, true)`, validés par `validateIdentityValues`),
repliés par défaut pour limiter le défilement. Un doublon (envie en cours, même
catégorie, même titre normalisé) est signalé avec un lien vers l'envie existante.
Après l'ajout : retour à la liste (`useGoBack`).

### Une envie (`/wishlist/:id`)

Actions principales en haut :

- **Je l'ai obtenue** → la carte « Envie comblée ! » propose **Ajouter à ma
  collection** : l'objet est créé avec les attributs d'identité de l'envie,
  `attributes.analysisStatus = 'pending'` (la fiche complète, lente, se charge à
  la demande sur la fiche objet), confiance et prix payé inconnus (`null`),
  date d'acquisition = date d'obtention, notes reprises ; puis ouverture de la
  fiche objet. « Remettre dans mes envies » annule l'obtention.
- **Chercher dans la communauté** → `routes.community(domain, undefined, texte)`
  (texte = cœur du titre, 5 mots au plus).
- **Disponible dans la communauté ?** — vérification **à la demande** de 3
  annonces au plus (`client.marketplace.catalogue({ domain, text, limit: 3 })`).
  Messages distincts : annonces trouvées (lien vers chacune), aucune annonce,
  offre **Platine** requise (lien vers les offres, sans appel serveur si le plan
  est connu), fonction **pas encore disponible**, panne (« Réessayer »).
- **Modifier** (même formulaire, sur place ; les attributs hors formulaire sont
  conservés si la catégorie ne change pas) et **Supprimer** avec confirmation
  sur place (fonctionne aussi sur le web, où `Alert` n'existe pas).

### Bouton « Ajouter à mes envies » (`AddToWishlistButton`)

Props : `{ domain, title, attributes?, source, sourceItemId?, notes?, variant? }`,
directement compatibles avec `entryFromItem(item)` (source `item`, ou `tasting`
avec la note de dégustation) et `entryFromCandidate(candidate)` (source `scan`).
Seuls les attributs d'**identité** sont copiés (`identityAttributes`) : jamais la
fiche d'analyse, les avertissements ni l'historique des corrections. Doublon →
« Déjà dans vos envies » sans création ; succès → toast, puis le bouton devient
« Ajouté — voir mes envies » (accès direct à la liste de la catégorie).

### Ajout partagé (`useAddToWishlist`)

Toute création d'envie hors formulaire passe par le même hook :
`AddToWishlistButton`, l'écran **Candidats** (« Ajouter à mes envies » d'un
objet scanné, source `scan`, attributs d'identité du domaine capturé) et le
**sommelier de cave** (`/cellar-sommelier`, idée d'achat `kind: 'idea'`
« Vin pour : … » quand rien dans la cave ne convient au plat). Règle unique
(`addUnlessDuplicate`) :

1. la liste est relue **fraîche** sous la clé `['wishlist']` (une envie
   identique a pu être ajoutée ailleurs) ; si la lecture échoue, l'ajout est
   tenté quand même — le serveur tranchera ;
2. une envie **en cours** de même catégorie et de même titre normalisé
   (`findDuplicate`) est un doublon : rien n'est créé, « Déjà dans vos
   envies » ;
3. sinon l'envie est créée ; dans les deux cas le cache `['wishlist']` est mis
   à jour aussitôt puis relu (« Mes envies » et la recherche globale voient
   l'ajout sans attendre).

Chaque écran garde ses messages ; après l'ajout (ou le doublon), le sommelier
remplace son bouton par « Ajouté — voir mes envies » / « Dans vos envies —
voir », qui ouvre la liste des vins.

## 5. Mode démo

`createDemoWishlistRepo()` applique les mêmes règles que le dépôt réel (mappers
de `@velum/api-client`, `acquiredAt` géré comme par le trigger, copies à chaque
lecture). Le jeu de départ couvre les 5 catégories, les 3 segments et les
origines manuelle / dégustation / scan / communauté ; certaines envies
(« Napoléon III 20 Francs Or », « Cérès 20c noir 1849 », « Château Pradeaux
Bandol ») correspondent à des annonces du catalogue démo pour illustrer la
vérification communauté. Horloge, identifiants et latence sont injectables.
