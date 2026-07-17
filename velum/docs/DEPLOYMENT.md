# Déploiement & soumission stores — checklist 2026

Checklist opérationnelle complète pour publier VELUM sur l'App Store et Google Play en 2026. Cocher **chaque** case avant soumission. Prévoir du calendrier : **compter 2 cycles de soumission** (un rejet sur la première passe est le cas nominal, pas l'exception).

## 0. Comptes & prérequis administratifs

- [ ] **Apple Developer Program** : 99 $/an — inscription en tant qu'organisation exige un **numéro DUNS** (délai d'obtention : plusieurs jours à semaines, s'y prendre tôt).
- [ ] **Google Play Console** : 25 $ (frais uniques) — les nouveaux comptes personnels doivent passer par **14 jours de tests fermés avec au moins 12 testeurs** opt-in avant de pouvoir publier en production. Lancer le closed testing dès la première build stable.
- [ ] Compte **RevenueCat** créé, projet VELUM configuré (voir §4).
- [ ] Projet **Supabase** de production provisionné (voir §5).
- [ ] Projet **EAS** lié : remplacer le `projectId` placeholder (`00000000-…`) dans `apps/mobile/app.config.ts` → `extra.eas.projectId`.
- [ ] **Assets définitifs** : déposer `apps/mobile/assets/brand/logo.png` (export final du logo) + icônes définitives — l'icône actuelle (`icon-provisional.png`) est un frame provisoire extrait de la vidéo d'intro et **ne doit pas partir en production**.
- [ ] Politique de confidentialité publiée sur une **URL publique** (contenu : [PRIVACY.md](./PRIVACY.md)) et conditions d'utilisation.

## 1. iOS — App Store

### Build & SDK
- [ ] Build avec **SDK iOS 26 ou supérieur** (exigence Apple 2026 pour les nouvelles soumissions) — Expo SDK 54 / EAS s'en charge, vérifier l'image Xcode du profil `production`.
- [ ] `newArchEnabled: true` vérifié (déjà actif dans `app.config.ts`).
- [ ] `ITSAppUsesNonExemptEncryption: false` en place (déjà dans `infoPlist`) — évite la question chiffrement à chaque upload.

### Privacy manifest & labels
- [ ] **`PrivacyInfo.xcprivacy`** généré depuis la clé `ios.privacyManifests` d'`app.config.ts` — déjà déclaré : e-mail (fonctionnalité, lié à l'identité, pas de tracking), photos/vidéos (fonctionnalité), historique d'achats (fonctionnalité) ; APIs à raison requise : UserDefaults (`CA92.1`), timestamps fichiers (`C617.1`). **Re-vérifier ce manifeste à chaque ajout de SDK tiers.**
- [ ] **Labels « nutrition » App Store Connect exactement alignés** sur le manifeste et sur PRIVACY.md : Contact Info → Email Address ; User Content → Photos or Videos ; Purchases → Purchase History ; Identifiers → User ID. Aucune donnée utilisée pour le tracking. Une divergence labels/manifeste = rejet.
- [ ] Chaînes d'usage en français vérifiées : `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` (déjà dans `app.config.ts`).

### IA — règle 2026
- [ ] **Divulgation d'usage d'IA externe** : l'app envoie des photos utilisateur à un modèle d'IA tiers (vision LLM). Règle App Review 2026 (évolution 5.1.2) : cette transmission doit être **explicitement divulguée ET recueillie par consentement utilisateur** avant le premier envoi. Vérifier l'écran de consentement in-app (première capture) + mention dans la description store + PRIVACY.md.
- [ ] Le consentement est refusable : sans consentement IA, l'app reste utilisable en saisie assistée (pas d'envoi de photo).

### Compte, achats, connexion
- [ ] **Sign in with Apple actif** (`usesAppleSignIn: true` + capability sur l'App ID) — obligatoire dès qu'un login tiers (Google) est proposé (guideline 4.8).
- [ ] **Bouton « Restaurer les achats »** visible dans les réglages (obligatoire avec RevenueCat/IAP).
- [ ] Suppression de compte **in-app** disponible (guideline 5.1.1(v)) — avec purge des données (voir PRIVACY.md).
- [ ] **Compte démo + notes de revue** renseignés dans App Store Connect (voir [DEMO_ACCOUNT.md](./DEMO_ACCOUNT.md)) : identifiants `demo@velum.app`, instructions de test par module.

### Guidelines fréquemment fatales — auto-audit
- [ ] **2.1 (App Completeness)** : aucune fonctionnalité en panne, pas d'écran placeholder, backend de prod up pendant la revue, IAP en état « Ready to Submit » joints à la build.
- [ ] **2.3 (Accurate Metadata)** : captures d'écran reflétant l'app réelle (les 5 modules), pas de promesse non tenue (« expertise certifiée » interdit — nous affichons des estimations indicatives).
- [ ] **3.1 (Payments)** : tout contenu numérique (premium) passe par IAP/RevenueCat, aucun lien de paiement externe, prix affichés cohérents.
- [ ] **4.8 (Login Services)** : Sign in with Apple offert à parité avec Google.
- [ ] **5.1 (Privacy)** : consentement photos/IA, labels exacts, suppression de compte, politique liée dans la fiche ET dans l'app.

## 2. Android — Google Play

- [ ] **AAB** (Android App Bundle) — déjà configuré : `eas.json` → profil `production` → `"buildType": "app-bundle"`.
- [ ] **API cible 35 minimum** (Android 15) pour toute soumission 2026 — puis **API 36 obligatoire au 31/08/2026** : planifier la montée de `targetSdkVersion` avant cette échéance.
- [ ] **Pages mémoire 16 Ko** : toutes les libs natives compatibles 16 KB page size (obligatoire pour cibler Android 15+ sur les nouveaux devices). Expo SDK 54 est conforme ; vérifier tout `.so` tiers ajouté.
- [ ] **Formulaire Data Safety exhaustif** et aligné sur PRIVACY.md : collecte e-mail, photos, historique d'achats, identifiant utilisateur ; données chiffrées en transit ; suppression sur demande ; **photos partagées avec un tiers (fournisseur IA) pour la fonctionnalité** — le déclarer explicitement. Divergence formulaire/app = retrait.
- [ ] **Content rating** (questionnaire IARC) complété — VELUM mentionne l'alcool (module Vin) : répondre honnêtement à la question « références à l'alcool » (classement PEGI/ESRB en conséquence).
- [ ] **Conformité CSAE** (Child Safety / politiques 2025-2026) : déclaration signée dans la Play Console ; VELUM n'est pas une app sociale/enfants — cocher les déclarations correspondantes.
- [ ] **Fiche store** : titre ≤ **30 caractères** (« VELUM — Estimez vos collections » dépasse : prévoir « VELUM » ou variante courte), description courte ≤ **80 caractères**.
- [ ] **Ne PAS modifier la fiche pendant la revue** — toute édition remet la revue en file d'attente.
- [ ] Closed testing : 12+ testeurs opt-in, 14 jours effectifs, retours documentés avant demande d'accès production.

## 3. Union européenne

- [ ] **European Accessibility Act (EAA, applicable depuis juin 2025)** : l'app est un service numérique grand public — exigences d'accessibilité opposables.
  - [ ] Tests **VoiceOver** (iOS) : parcours complet capture → estimation → collection, labels d'accessibilité sur tous les contrôles.
  - [ ] Tests **TalkBack** (Android) : idem.
  - [ ] Mode senior (`a11y_mode`) vérifié : tailles de police dynamiques, contrastes AA minimum, cibles tactiles ≥ 44 pt.
  - [ ] Déclaration d'accessibilité disponible (peut être hébergée avec la politique de confidentialité).
- [ ] Trader status DSA renseigné dans les deux consoles (coordonnées du responsable, obligatoire UE).

## 4. RevenueCat

- [ ] Produits créés dans App Store Connect et Play Console (`velum_premium_monthly`, `velum_gold_monthly`, `velum_platine_monthly` + variantes annuelles — aligner sur `PLAN_LIMITS` de `@velum/config` : Premium = scans illimités ; Gold = + carnet virtuel ; Platine = + valorisation continue & communauté).
- [ ] Projet RevenueCat : apps iOS + Android, produits importés, **entitlements** `premium`, `gold` et `platine` mappés.
- [ ] Clés **publiques** RevenueCat dans l'env client (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` — voir `apps/mobile/.env.example`) ; la clé secrète reste serveur.
- [ ] Webhook RevenueCat → Edge Function `revenuecat-webhook` (URL + en-tête `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`) : met à jour `profiles.plan` côté serveur pour `consume_scan` et les droits carnet/communauté.
- [ ] Compte démo provisionné en production via l'API admin (mot de passe coffre-fort, JAMAIS celui du seed local) puis collection d'exemple rejouée depuis `supabase/seed.sql` (sections 2-5) — procédure : docs/DEMO_ACCOUNT.md.
- [ ] Sandbox testé sur les deux plateformes : achat, restauration, expiration.

## 5. Supabase (production)

- [ ] `supabase db push` — migrations appliquées (DDL + RLS + triggers + `consume_scan`).
- [ ] `supabase functions deploy` — toutes les Edge Functions (`recognize`, `analyze-*`, `valuate`, webhooks).
- [ ] `supabase secrets set --env-file supabase/functions/.env` — partir du modèle exhaustif. Pour les montres, une clé ne suffit pas : activer `WATCHCHARTS_APP_LICENSED`, `HERITAGE_WATCH_API_ENABLED`, `EBAY_MARKETPLACE_INSIGHTS_ENABLED`, `CATAWIKI_WATCH_API_ENABLED` ou `CHRONO24_WATCH_API_ENABLED` uniquement après confirmation contractuelle. **Aucun secret côté client.**
- [ ] Jobs **pg_cron** planifiés (revalorisation, FX, alertes, purges) avec secrets d'appel dans **Vault**.
- [ ] Bucket `item-media` créé, policies Storage en place, quotas vérifiés.
- [ ] Sauvegardes automatiques + PITR activés ; RLS re-vérifiée table par table (`select` anonyme doit échouer partout).
- [ ] Compte démo provisionné (seed de [DEMO_ACCOUNT.md](./DEMO_ACCOUNT.md)).

## 6. Procédure EAS

```bash
# Depuis apps/mobile/ (EAS CLI connecté au bon compte)
eas build --profile production --platform ios
eas build --profile production --platform android

# Soumission
eas submit --platform ios        # → App Store Connect (TestFlight puis revue)
eas submit --platform android    # → Play Console (piste choisie)
```

- [ ] Build `preview` validée en interne (distribution interne, `channel: preview`) avant toute build `production`.
- [ ] `autoIncrement` gère les numéros de build (déjà configuré) ; la `version` marketing se change dans `app.config.ts`.
- [ ] Mises à jour OTA : réserver `expo-updates` aux correctifs JS mineurs — tout changement de fonctionnalité soumis en revue normale (conformité guidelines).

## 7. Derniers verrous avant « Submit »

- [ ] 2 cycles de soumission provisionnés dans le planning (J+7 à J+14 de marge).
- [ ] Captures d'écran par plateforme et par taille d'écran, en français, montrant les **5 modules**.
- [ ] Vidéo d'intro (`velum-intro.mp4`) testée sur device bas de gamme (temps de chargement, skip possible).
- [ ] Politique de confidentialité liée dans App Store Connect, Play Console **et** dans l'app (réglages).
- [ ] Notes de revue + compte démo à jour dans les deux consoles ([DEMO_ACCOUNT.md](./DEMO_ACCOUNT.md)).
- [ ] Gel de la fiche store jusqu'à l'approbation.
