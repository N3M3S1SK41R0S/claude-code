# Compte démo & notes de revue (App Store / Google Play)

Les équipes de revue Apple et Google exigent un accès complet à l'app sans créer de compte ni payer. Ce document fournit le compte démo, le seed SQL pour le provisionner, et les notes de revue à coller dans App Store Connect (« App Review Information ») et la Play Console (« Instructions d'accès »).

## 1. Compte démo

| Champ | Valeur |
|---|---|
| E-mail | `demo@velum.app` |
| Mot de passe | `[À GÉNÉRER — coffre-fort équipe, jamais commité]` |
| Plan | `premium` (entitlement RevenueCat accordé manuellement — voir §3) |
| Contenu | 2 items par module (vin, pièce, tableau, timbre) avec photos, analyses et estimations pré-remplies |

> Le mot de passe réel n'est **jamais** commité dans le dépôt : il est généré au provisionnement, stocké dans le coffre-fort de l'équipe et renseigné dans les consoles stores.

## 2. Provisionnement — seed SQL (exemple)

À exécuter sur l'environnement de production **après** `supabase db push` (adapter le mot de passe). L'utilisateur est créé via l'API admin (jamais d'insert direct dans `auth.users` en produ­ction gérée) :

```bash
# 1. Créer l'utilisateur (API admin — service_role)
curl -X POST "https://YOUR-PROJECT.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@velum.app","password":"<MOT-DE-PASSE-COFFRE>","email_confirm":true}'
```

```sql
-- 2. Seed de la collection démo (exemple — adapter l'uuid retourné à l'étape 1)
-- Le trigger handle_new_user a déjà créé la ligne profiles.
with demo as (
  select id from auth.users where email = 'demo@velum.app'
)
insert into items (owner_id, domain, title, attributes, confidence, condition)
select id, d.domain, d.title, d.attributes::jsonb, d.confidence, d.condition
from demo, (values
  ('wine',  'Château Margaux 2015',
   '{"producer":"Château Margaux","appellation":"Margaux","vintage":2015,"color":"rouge"}', 0.97, null),
  ('wine',  'Clos Rougeard Le Bourg 2014',
   '{"producer":"Clos Rougeard","cuvee":"Le Bourg","vintage":2014,"color":"rouge"}', 0.93, null),
  ('coin',  '5 Francs Semeuse 1960',
   '{"country":"France","type":"5 Francs Semeuse","year":1960,"metal":"argent"}', 0.95, 'TTB'),
  ('coin',  '20 Francs Napoléon III 1857 A',
   '{"country":"France","year":1857,"mintMark":"A","metal":"or"}', 0.91, 'SUP'),
  ('art',   'École française fin XIXe — Paysage',
   '{"attributionQualifier":"ecole_de","technique":"huile sur toile","estimatedPeriod":"fin XIXe","dimensionsCm":{"height":65,"width":54}}', 0.62, null),
  ('art',   'Aquarelle signée, XXe',
   '{"technique":"aquarelle","signatureDetected":true}', 0.55, null),
  ('stamp', 'YT 1234 — France',
   '{"country":"France","catalog":"yvert_tellier","catalogNumber":"YT 1234","year":1960}', 0.9, 'neuf sans charnière'),
  ('stamp', 'Scott C3a — poste aérienne',
   '{"country":"États-Unis","catalog":"scott","catalogNumber":"Scott C3a"}', 0.88, 'oblitéré')
) as d(domain, title, attributes, confidence, condition);

-- 3. (Optionnel) pré-remplir une valorisation par item pour que les fiches
--    montrent immédiatement estimation + IC + fiabilité sans appel réseau.
```

Accorder ensuite l'entitlement `premium` au compte via le dashboard RevenueCat (« Grant promotional entitlement », durée : 1 an) afin que la revue voie toutes les fonctionnalités payantes **sans** transaction.

## 3. Notes de revue — texte à coller dans les consoles

> **VELUM** identifie et estime des objets de collection (vins, pièces de monnaie, tableaux, timbres) à partir de photos. Les estimations sont **indicatives** (médiane pondérée de sources de marché publiques, avec intervalle de confiance et score de fiabilité affichés) — l'app ne fournit ni expertise légale ni conseil d'investissement, et l'indique sur chaque fiche.
>
> **Compte démo** : `demo@velum.app` / `<mot de passe>` — plan Premium actif, collection pré-remplie (2 objets par module).
>
> **Divulgation IA** : les photos soumises à l'identification sont analysées par un modèle d'IA tiers (Anthropic). Le consentement explicite est demandé à la première capture ; en cas de refus, la saisie assistée manuelle reste disponible. Politique de confidentialité : `https://velum.app/privacy`.

### Comment tester chaque module

1. **Vin** : onglet Capture → module Vin → photographier une étiquette (ou choisir une photo de la galerie). Vérifier : candidats avec confiance affichée → fiche d'analyse 7 sections (identification, dégustation, notes critiques, marché, comparatif) → estimation avec intervalle et fiabilité. Dans la collection, l'item « Château Margaux 2015 » montre une fiche complète pré-chargée.
2. **Pièces** : Capture → module Pièces → photos avers/revers guidées. Vérifier le grade proposé (avec réserve explicite « ne remplace pas une gradation professionnelle ») et l'estimation. Item pré-chargé : « 5 Francs Semeuse 1960 ».
3. **Tableaux** : Capture → module Tableaux → photo de l'œuvre (+ verso/signature optionnels). Vérifier l'attribution **qualifiée** (« école de », « attribué à » — jamais d'authentification ferme) et la recommandation d'expertise humaine.
4. **Timbres** : Capture → module Timbres → photo du timbre, ou saisie d'un numéro de catalogue (« YT 1234 »). Vérifier l'état philatélique (gomme, centrage) et l'estimation.
5. **Saisie sans photo** : dans tout module, l'entrée texte libre (ex. « pièce argent Napoléon ») fonctionne ; une entrée trop vague bascule honnêtement en saisie assistée.
6. **Mode senior** : Réglages → Accessibilité → activer le **mode senior** — boutons agrandis, contraste renforcé, police majorée. Compatible VoiceOver/TalkBack.
7. **Restauration des achats** : Réglages → Abonnement → **Restaurer les achats** (le compte démo a un entitlement promotionnel ; le bouton doit répondre sans erreur).
8. **Quota gratuit** : se déconnecter et créer un compte neuf pour observer le plan gratuit (5 scans/semaine **par module**, bandeau de quota, écran d'upsell au dépassement).
9. **Suppression de compte** : Réglages → Compte → Supprimer mon compte (disponible in-app, guideline 5.1.1(v)).

### Remarques pour la revue

- Le contenu du module Vin concerne des boissons alcoolisées : app classée 17+/18+ en conséquence, aucune vente d'alcool in-app.
- Aucun achat n'est nécessaire pour la revue (entitlement promotionnel actif sur le compte démo).
- Le backend (Supabase) est en production pendant toute la fenêtre de revue.
