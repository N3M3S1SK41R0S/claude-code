# VELUM — Fiches stores prêtes à coller (App Store & Google Play)

> Générée le 2026-07-11 à partir de l'app réelle (`apps/mobile/app/`), de `packages/config` (flags & grille tarifaire), de `docs/DEPLOYMENT.md` et `docs/DEMO_ACCOUNT.md`.
> Tous les décomptes indiqués `(N/limite)` sont des décomptes **vérifiés par script** (`len()` Unicode, espaces comprises) — voir §6 pour re-vérifier.
> Ne décrit **que** des fonctions présentes dans la build : la marketplace/communauté est flag OFF (`enableMarketplace: false`) et n'est mentionnée que comme « bientôt disponible », exactement comme dans l'app.

---

## 0. RAPPELS BLOQUANTS — à lire avant toute soumission

1. **NE PAS modifier la fiche pendant la revue.** Toute édition (texte, captures, prix) remet la soumission en file d'attente — gel complet de la fiche jusqu'à l'approbation (cf. DEPLOYMENT.md §2 et §7).
2. **URL publique de politique de confidentialité requise** dans App Store Connect ET Play Console **et** dans l'app : `https://velum.app/privacy` (contenu : `docs/PRIVACY.md`). La fiche est refusée sans cette URL ; l'écran in-app `/privacy` existe déjà.
3. **Re-vérifier chaque décompte après toute retouche.** Les nombres ci-dessous sont exacts pour le texte tel quel ; le moindre mot changé les invalide (procédure de recomptage en §6).
4. Rappels connexes (bloquants ailleurs) : icône **provisoire** à remplacer avant build de prod (README « Identité visuelle ») ; compte démo `demo@velum.app` provisionné + notes de revue collées (DEMO_ACCOUNT.md) ; IAP « Ready to Submit » joints à la build ; labels privacy iOS / formulaire Data Safety alignés sur PRIVACY.md.
5. **Copie à régénérer — 5e module (juillet 2026).** Le module **Montres** a été ajouté après la génération de cette fiche : sous-titres, mots-clés, descriptions (« LES 4 MODULES ») et jeu de captures ne le mentionnent pas encore. Régénérer l'ensemble (et re-vérifier chaque décompte, §6) avant toute soumission.

---

## 1. App Store (iOS)

### 1.1 Nom (limite 30 caractères)

- **FR** : `VELUM – Estimation collection` (29/30)
- **EN** : `VELUM – Collectibles Estimator` (30/30)

### 1.2 Sous-titre (limite 30 caractères)

- **FR** : `Vin, pièces, tableaux, timbres` (30/30)
- **EN** : `Value wine, coins, art, stamps` (30/30)

### 1.3 Mots-clés (limite 100 caractères, séparés par virgules, sans espaces)

Les termes déjà présents dans le nom et le sous-titre (vin, pièces, tableaux, timbres, estimation, collection…) sont volontairement exclus : Apple indexe nom + sous-titre + mots-clés, les répéter gaspille le budget.

- **FR** : `cave,monnaie,numismatique,philatélie,peinture,cote,valeur,or,argent,millésime,catalogue,scan` (92/100)
- **EN** : `cellar,coin,numismatics,stamp,philately,painting,appraisal,estimate,collection,scan,price,catalog` (97/100)

### 1.4 Texte promotionnel (optionnel, limite 170 caractères — modifiable sans nouvelle build)

- **FR** : Une photo suffit : VELUM identifie vos vins, pièces, tableaux et timbres et affiche une estimation honnête — fourchette, fiabilité et sources. (142/170)
- **EN** : One photo is enough: VELUM identifies your wines, coins, paintings and stamps and shows an honest estimate — range, reliability and sources. (140/170)

### 1.5 Description longue — FR (3232 caractères, cible 2000–3500, limite 4000)

```
Une photo suffit pour lever le voile sur la valeur cachée de vos collections.

VELUM identifie vos vins, pièces de monnaie, tableaux et timbres à partir d'une photo, d'une saisie texte libre ou d'un import de fichier (CSV/JSON), puis produit une fiche d'analyse experte et une estimation de valeur honnête : une fourchette assumée, jamais une fausse certitude.

LES 4 MODULES
• VIN — moteur d'analyse ZAPPA∴VINI∴SAPIENS : identification (étiquette, capsule), profil de dégustation, notes critiques, marché et potentiel de garde, comparaisons et accords mets-vins.
• PIÈCES — identification avers / revers / tranche, proposition de grade (échelles française et Sheldon) avec une réserve explicite : elle ne remplace pas une gradation professionnelle.
• TABLEAUX — attribution toujours qualifiée (« école de », « attribué à », jamais d'authentification ferme), analyse d'état et recommandation d'expertise humaine quand elle s'impose.
• TIMBRES — références des catalogues (Yvert & Tellier, Michel, Scott, Stanley Gibbons), état philatélique (gomme, centrage, défauts), rareté.

UNE ESTIMATION QUI ANNONCE SA FIABILITÉ
Chaque objet reçoit une valeur centrale en euros, une fourchette probable (intervalle de confiance à 80 %), une fourchette large (95 %), un score de fiabilité sur 100 et la liste des sources de marché retenues. Quand la reconnaissance doute, VELUM le dit — et bascule en saisie assistée plutôt que d'inventer.

VOTRE COLLECTION DEVIENT UN PATRIMOINE DOCUMENTÉ
Cave, cabinet, galerie, album : la collection est organisée par module, avec valeur totale du portefeuille, plus ou moins-value latente par rapport à vos prix d'acquisition, courbe de valeur par objet, alertes de cote, export PDF des fiches et export CSV.

LE SOMMELIER DE VOTRE CAVE (Gold et Platine)
« Ce soir, magret de canard aux figues : quel vin ? » Le sommelier recommande uniquement des bouteilles déjà présentes dans votre cave, avec leur emplacement physique. Le bandeau « à boire » signale les vins à leur apogée, plats suggérés à l'appui.

PENSÉE POUR TOUS
Mode senior (boutons agrandis, contrastes renforcés, police majorée), compatibilité VoiceOver, interface en français et en anglais.

LES FORMULES (prix indicatifs, susceptibles d'évoluer)
• Gratuit : 5 scans par semaine pour chaque module.
• Premium — 9,99 €/mois : scans illimités, exports PDF/CSV, alertes de cote.
• Gold — 19,99 €/mois : tout Premium + carnet virtuel (cave avec emplacements, table de pièces, galerie, album) et sommelier de cave.
• Platine — 49,99 €/mois : tout Gold + valorisation continue du carnet selon le marché et rapport assurance/succession. La communauté de collectionneurs arrive bientôt.
Abonnements auto-renouvelables, facturés via votre compte App Store et résiliables à tout moment ; le prix affiché au moment de l'achat fait foi.

IMPORTANT
Les estimations VELUM sont indicatives : elles ne constituent ni une expertise légale, ni une gradation certifiée, ni un conseil en investissement. Les photos soumises à l'identification sont analysées par un modèle d'IA tiers, avec votre consentement explicite, refusable et révocable à tout moment.

Politique de confidentialité : https://velum.app/privacy
Conditions d'utilisation : https://velum.app/terms
```

### 1.6 Description longue — EN (2904 caractères, cible 2000–3500, limite 4000)

```
One photo is all it takes to lift the veil on your collection's hidden value.

VELUM identifies your wines, coins, paintings and stamps from a photo, a free-text entry or a file import (CSV/JSON), then builds an expert analysis sheet and an honest value estimate: a stated range, never false certainty.

THE 4 MODULES
• WINE — ZAPPA∴VINI∴SAPIENS analysis engine: identification (label, capsule), tasting profile, critics' ratings, market and ageing potential, comparisons and food pairings.
• COINS — obverse / reverse / edge identification, suggested grade (French and Sheldon scales) with an explicit caveat: it does not replace professional grading.
• PAINTINGS — always-qualified attribution ("school of", "attributed to", never firm authentication), condition analysis and a recommendation to consult a human expert when warranted.
• STAMPS — catalogue references (Yvert & Tellier, Michel, Scott, Stanley Gibbons), philatelic condition (gum, centering, faults), rarity.

AN ESTIMATE THAT STATES ITS OWN RELIABILITY
Every item gets a central value in euros, a probable range (80% confidence interval), a wide range (95%), a reliability score out of 100 and the list of market sources used. When recognition is unsure, VELUM says so — and switches to assisted entry instead of making things up.

YOUR COLLECTION BECOMES A DOCUMENTED ESTATE
Cellar, cabinet, gallery, album: your collection is organised by module, with total portfolio value, unrealised gain or loss versus your purchase prices, a value curve per item, price alerts, PDF sheet export and CSV export.

YOUR CELLAR'S OWN SOMMELIER (Gold and Platine)
"Duck breast with figs tonight — which wine?" The sommelier only recommends bottles already in YOUR cellar, along with where each one is stored. The "drink now" banner flags wines at their peak, with suggested dishes.

DESIGNED FOR EVERYONE
Senior mode (larger buttons, higher contrast, bigger type), VoiceOver support, interface in French and English.

PLANS (indicative pricing, subject to change)
• Free: 5 scans per week for each module.
• Premium — €9.99/month: unlimited scans, PDF/CSV exports, price alerts.
• Gold — €19.99/month: everything in Premium + the virtual book (cellar with slots, coin tray, gallery, album) and the cellar sommelier.
• Platine — €49.99/month: everything in Gold + continuous portfolio valuation against the market and an insurance/estate report. The collectors' community is coming soon.
Auto-renewable subscriptions, billed to your App Store account, cancel anytime; the price shown at purchase applies.

IMPORTANT
VELUM estimates are indicative: they are neither a legal appraisal, nor certified grading, nor investment advice. Photos submitted for identification are analysed by a third-party AI model, with your explicit consent — declinable and revocable at any time.

Privacy policy: https://velum.app/privacy
Terms of use: https://velum.app/terms
```

### 1.7 Nouveautés (« What's New ») v1.0

**FR** (565/4000) :

```
Bienvenue dans VELUM 1.0 — lever le voile sur la valeur cachée.
• 5 modules d'identification et d'estimation : Vin, Pièces, Tableaux, Timbres, Montres
• Capture photo guidée, saisie texte libre ou import de fichier (CSV/JSON)
• Estimation en fourchette (IC 80 % / 95 %) avec score de fiabilité et sources
• Collection organisée : cave, cabinet, galerie, album — valeur totale et plus-value latente
• Sommelier de cave et bandeau « à boire » (Gold et Platine)
• Mode senior, VoiceOver, interface FR/EN
• Export PDF/CSV, alertes de cote, rapport assurance/succession (Platine)
```

**EN** (525/4000) :

```
Welcome to VELUM 1.0 — lift the veil on hidden value.
• 4 identification and valuation modules: Wine, Coins, Paintings, Stamps
• Guided photo capture, free-text entry or file import (CSV/JSON)
• Range-based estimates (80% / 95% CI) with reliability score and sources
• Organised collection: cellar, cabinet, gallery, album — total value and unrealised gain
• Cellar sommelier and "drink now" banner (Gold and Platine)
• Senior mode, VoiceOver, FR/EN interface
• PDF/CSV export, price alerts, insurance/estate report (Platine)
```

---

## 2. Play Store (Android)

### 2.1 Titre (limite 30 caractères)

- **FR** : `VELUM – Estimation collection` (29/30)
- **EN** : `VELUM – Collectibles Estimator` (30/30)

> Conforme à DEPLOYMENT.md §2 : « VELUM — Estimez vos collections » (31 car.) dépassait la limite.

### 2.2 Description courte (limite 80 caractères)

- **FR** : `Vins, pièces, tableaux, timbres : identifiez et estimez d'une simple photo.` (75/80)
- **EN** : `Wine, coins, paintings, stamps: identify and value them from a single photo.` (76/80)

### 2.3 Description longue — FR (3277/4000 caractères)

```
Photographiez. VELUM identifie, analyse et estime — honnêtement.

VELUM lève le voile sur la valeur cachée de vos collections : une photo, une saisie texte libre ou un import de fichier (CSV/JSON) suffit pour obtenir une fiche d'analyse experte et une estimation en fourchette, toujours accompagnée de son score de fiabilité. Jamais de fausse certitude.

🍷 VIN — moteur d'analyse ZAPPA∴VINI∴SAPIENS : identification (étiquette, capsule), profil de dégustation, notes critiques, marché et potentiel de garde, comparaisons et accords mets-vins.

🪙 PIÈCES — identification avers / revers / tranche, proposition de grade (échelles française et Sheldon) avec une réserve explicite : elle ne remplace pas une gradation professionnelle.

🖼️ TABLEAUX — attribution toujours qualifiée (« école de », « attribué à », jamais d'authentification ferme), analyse d'état et recommandation d'expertise humaine quand elle s'impose.

📮 TIMBRES — références des catalogues (Yvert & Tellier, Michel, Scott, Stanley Gibbons), état philatélique (gomme, centrage, défauts), rareté.

UNE ESTIMATION QUI ANNONCE SA FIABILITÉ
Valeur centrale en euros, fourchette probable (intervalle de confiance à 80 %), fourchette large (95 %), score de fiabilité sur 100 et sources de marché retenues : tout est affiché. Quand la reconnaissance doute, VELUM le dit et bascule en saisie assistée plutôt que d'inventer.

VOTRE COLLECTION DEVIENT UN PATRIMOINE DOCUMENTÉ
Cave, cabinet, galerie, album : collection organisée par module, valeur totale du portefeuille, plus ou moins-value latente par rapport à vos prix d'acquisition, courbe de valeur par objet, alertes de cote, export PDF des fiches et export CSV. Vos modifications hors connexion sont conservées et synchronisées au retour du réseau.

LE SOMMELIER DE VOTRE CAVE (Gold et Platine)
« Ce soir, magret de canard aux figues : quel vin ? » Le sommelier recommande uniquement des bouteilles déjà présentes dans votre cave, avec leur emplacement physique. Le bandeau « à boire » signale les vins à leur apogée, plats suggérés à l'appui.

PENSÉE POUR TOUS
Mode senior (boutons agrandis, contrastes renforcés, police majorée), compatibilité TalkBack, interface en français et en anglais.

LES FORMULES (prix indicatifs, susceptibles d'évoluer)
✔ Gratuit : 5 scans par semaine pour chaque module.
✔ Premium — 9,99 €/mois : scans illimités, exports PDF/CSV, alertes de cote.
✔ Gold — 19,99 €/mois : tout Premium + carnet virtuel (cave avec emplacements, table de pièces, galerie, album) et sommelier de cave.
✔ Platine — 49,99 €/mois : tout Gold + valorisation continue du carnet selon le marché et rapport assurance/succession. La communauté de collectionneurs arrive bientôt.
Abonnements auto-renouvelables gérés par Google Play, résiliables à tout moment ; le prix affiché au moment de l'achat fait foi.

IMPORTANT
Les estimations VELUM sont indicatives : elles ne constituent ni une expertise légale, ni une gradation certifiée, ni un conseil en investissement. Les photos soumises à l'identification sont analysées par un modèle d'IA tiers, avec votre consentement explicite, refusable et révocable à tout moment. L'application ne vend pas d'alcool.

Politique de confidentialité : https://velum.app/privacy
Conditions d'utilisation : https://velum.app/terms
```

### 2.4 Description longue — EN (2959/4000 caractères)

```
Take a photo. VELUM identifies, analyses and values it — honestly.

VELUM lifts the veil on your collection's hidden value: a photo, a free-text entry or a file import (CSV/JSON) is enough to get an expert analysis sheet and a range-based estimate, always shown with its reliability score. Never false certainty.

🍷 WINE — ZAPPA∴VINI∴SAPIENS analysis engine: identification (label, capsule), tasting profile, critics' ratings, market and ageing potential, comparisons and food pairings.

🪙 COINS — obverse / reverse / edge identification, suggested grade (French and Sheldon scales) with an explicit caveat: it does not replace professional grading.

🖼️ PAINTINGS — always-qualified attribution ("school of", "attributed to", never firm authentication), condition analysis and a recommendation to consult a human expert when warranted.

📮 STAMPS — catalogue references (Yvert & Tellier, Michel, Scott, Stanley Gibbons), philatelic condition (gum, centering, faults), rarity.

AN ESTIMATE THAT STATES ITS OWN RELIABILITY
Central value in euros, probable range (80% confidence interval), wide range (95%), reliability score out of 100 and the market sources used: everything is displayed. When recognition is unsure, VELUM says so and switches to assisted entry instead of making things up.

YOUR COLLECTION BECOMES A DOCUMENTED ESTATE
Cellar, cabinet, gallery, album: collection organised by module, total portfolio value, unrealised gain or loss versus your purchase prices, value curve per item, price alerts, PDF sheet export and CSV export. Offline edits are kept and synced when the network returns.

YOUR CELLAR'S OWN SOMMELIER (Gold and Platine)
"Duck breast with figs tonight — which wine?" The sommelier only recommends bottles already in YOUR cellar, along with where each one is stored. The "drink now" banner flags wines at their peak, with suggested dishes.

DESIGNED FOR EVERYONE
Senior mode (larger buttons, higher contrast, bigger type), TalkBack support, interface in French and English.

PLANS (indicative pricing, subject to change)
✔ Free: 5 scans per week for each module.
✔ Premium — €9.99/month: unlimited scans, PDF/CSV exports, price alerts.
✔ Gold — €19.99/month: everything in Premium + the virtual book (cellar with slots, coin tray, gallery, album) and the cellar sommelier.
✔ Platine — €49.99/month: everything in Gold + continuous portfolio valuation against the market and an insurance/estate report. The collectors' community is coming soon.
Auto-renewable subscriptions managed by Google Play, cancel anytime; the price shown at purchase applies.

IMPORTANT
VELUM estimates are indicative: they are neither a legal appraisal, nor certified grading, nor investment advice. Photos submitted for identification are analysed by a third-party AI model, with your explicit consent — declinable and revocable at any time. The app does not sell alcohol.

Privacy policy: https://velum.app/privacy
Terms of use: https://velum.app/terms
```

---

## 3. Plan de screenshots (8 par plateforme, ordre narratif imposé)

Mise en scène commune : compte démo `demo@velum.app` (collection pré-remplie, cf. DEMO_ACCOUNT.md), interface sombre native de l'app, langue FR pour la fiche fr-FR et EN pour en-US. L'accroche est superposée en haut de chaque capture (bandeau, typographie or sur fond `#1a0d10`).

| # | Écran (route réelle) | Mise en scène | Accroche FR (≤40) | Accroche EN (≤40) |
|---|---|---|---|---|
| 1 | `/capture/wine` | Modal de capture Vin : caméra active, guide « Étiquette » superposé, vignettes des rôles (étiquette, capsule), onglets Photo / Texte / Fichier visibles. Appareil réel requis (caméra). | « Photographiez, VELUM identifie » (30/40) | "Snap a photo, VELUM identifies" (30/40) |
| 2 | `/capture/candidates` | Top 3 des candidats avec badge de confiance sur chacun, boutons Confirmer / Affiner / Signaler. Utiliser une étiquette nette pour 3 candidats plausibles. | « Des candidats, confiance affichée » (33/40) | "Top matches, honest confidence" (30/40) |
| 3 | `/item/[id] (haut de fiche + sections ZAPPA)` | Fiche « Château Margaux 2015 » du compte démo : en-tête (titre, badge Vin, confiance), sections identification / dégustation / notations / marché / comparaisons / accords / incertitudes. | « L'analyse experte en 7 volets » (29/40) | "Expert analysis in 7 sections" (29/40) |
| 4 | `/item/[id] (bloc Valorisation)` | Même fiche, scrollée sur le bloc VALORISATION : valeur centrale, fourchette IC 80 %, fourchette IC 95 %, fiabilité /100, sources listées + encart Avertissements visible. | « Une fourchette, pas une promesse » (32/40) | "A range, not a promise" (22/40) |
| 5 | `/(tabs)/collection` | Onglet Collection du compte démo : carte valeur totale + plus-value latente, groupes Cave / Cabinet / Galerie / Album, bandeau « à boire » visible. | « Cave, cabinet, galerie, album » (29/40) | "Cellar, cabinet, gallery, album" (31/40) |
| 6 | `/cellar-sommelier` | Sommelier de cave : plat saisi (« magret de canard aux figues »), recommandation issue de la cave démo avec motif, température de service et emplacement physique. | « Le sommelier de votre cave » (26/40) | "A sommelier for your cellar" (27/40) |
| 7 | `/(tabs)/profile (mode senior activé)` | Profil avec l'interrupteur Mode senior activé : boutons et textes agrandis, contrastes renforcés. Montre aussi la ligne consentement IA (transparence). | « Mode senior : plus grand, plus net » (34/40) | "Senior mode: bigger and clearer" (31/40) |
| 8 | `/paywall` | Formules VELUM : Gratuit / Premium / Gold (badge « Populaire ») / Platine avec prix, bouton « Restaurer les achats » et mentions légales d'abonnement visibles. | « Passez aux scans illimités » (26/40) | "Unlimited scans when you're ready" (33/40) |

Notes :
- Les captures 3 et 4 sont le même écran `/item/[id]` (fiche de l'item vin seedé) à deux positions de scroll — ouvrir l'item depuis l'onglet Collection.
- La capture 1 exige un appareil physique (caméra) ; toutes les autres passent sur simulateur/émulateur.
- Règle 2.3 Apple : les captures doivent montrer l'app réelle — aucun mockup embelli, aucun contenu absent de la build. Montrer les 5 modules sur l'ensemble du jeu (exigence DEPLOYMENT.md §7) : les captures actuelles (1 Vin, 5 les 4 groupes, 3–4) précèdent le module Montres — à refaire avec l'écrin visible.

### Formats requis

**iOS (App Store Connect — jusqu'à 10 emplacements, nous en utilisons 8) :**

| Cible | Taille (portrait) | Obligatoire |
|---|---|---|
| iPhone 6,9" (15 Pro Max et +) | 1320 × 2868 px | Oui |
| iPhone 6,5" (11 Pro Max, XS Max…) | 1284 × 2778 px | Oui |
| iPad 13" | 2064 × 2752 px | Oui (`supportsTablet: true` dans `app.config.ts`) |

**Android (Play Console — 2 à 8 captures par type d'appareil, PNG/JPEG, 16:9 ou 9:16) :**

| Cible | Taille recommandée (portrait) |
|---|---|
| Téléphone | 1080 × 1920 px (min. 320 px, max. 3840 px par côté) |
| Tablette 7" | 1200 × 1920 px |
| Tablette 10" | 1600 × 2560 px |

Ne pas oublier côté Play : **feature graphic 1024 × 500 px** (obligatoire) et, en option, la vidéo YouTube (l'intro `velum-intro.mp4` peut être réutilisée).

---

## 4. Catégories, classification du contenu, tags

### 4.1 Catégories iOS

- **Primaire : Lifestyle** — justifiée : VELUM est une app de passion/collection à usage récurrent (gérer sa cave, son cabinet, sa galerie, son album), pas un simple outil ponctuel. Éviter **Finance** malgré la dimension « valorisation » : cela suggérerait un conseil en investissement, en contradiction frontale avec nos disclaimers.
- **Secondaire : Utilities (proposée) — mieux : Reference.** Utilities est acceptable mais décrit mal l'app. **Reference** correspond davantage au cœur d'usage (consultation de cotes, catalogues Yvert & Tellier/Michel/Scott, échelles de grade, notes critiques) et positionne VELUM à côté des catalogues numériques plutôt que des lampes de poche. Recommandation : **Lifestyle (primaire) + Reference (secondaire)** ; conserver Utilities en repli si le positionnement Reference est jugé trop « encyclopédique ».

### 4.2 Classification du contenu — iOS (questionnaire d'âge App Store Connect)

Le module Vin est un pilier de l'app (étiquettes, dégustation, garde, accords mets-vins) : les références à l'alcool sont **fréquentes**, pas incidentes.

- « Alcohol, Tobacco, or Drug Use or References » → répondre **« Frequent/Intense »** → classement **17+** (dans le système d'âge mondial Apple déployé depuis 2025, cela correspond au palier **18+** ; laisser App Store Connect calculer, ne pas sous-déclarer).
- Toutes les autres questions (violence, jeux d'argent, contenu sexuel, horreur…) : **Non/None**.
- Préciser dans les notes de revue (déjà dans DEMO_ACCOUNT.md) : **aucune vente d'alcool in-app**, aucune facilitation d'achat d'alcool — l'app documente et estime des bouteilles de collection.
- Conséquence assumée : app réservée 17+/18+, pas de programme famille/enfants.

### 4.3 Classification du contenu — Android (questionnaire IARC dans la Play Console)

- Catégorie du questionnaire : « Référence, actualités, éducation ou divertissement » / « Utilitaire » selon l'arborescence courante — choisir la branche non-jeu.
- Question **« L'application contient-elle des références à l'alcool, au tabac ou aux drogues ? » → OUI, références à l'alcool** (module Vin). Répondre honnêtement : divergence questionnaire/app = retrait de la fiche (DEPLOYMENT.md §2).
- Questions vente/promotion d'alcool → **NON** : VELUM ne vend pas d'alcool, ne facilite pas son achat (la marketplace est désactivée ; même activée plus tard, elle imposera de **refaire le questionnaire IARC**).
- Le moteur IARC génère les classements par territoire (typiquement PEGI 16 / USK / ESRB Teen+ pour références à l'alcool sans incitation) — accepter le résultat calculé, ne pas contester pour viser plus bas.
- Compléter aussi : formulaire **Data Safety** (photos partagées avec un fournisseur d'IA tiers pour la fonctionnalité — à déclarer explicitement), déclaration **CSAE**, et **trader status DSA** (UE) — détail dans DEPLOYMENT.md §2–3.

### 4.4 Tags Google Play (jusqu'à 5, liste fermée de la console)

Catégorie d'app : **Style de vie (Lifestyle)**. Tags à sélectionner dans la liste fermée de la Play Console, par ordre de priorité (prendre les plus proches réellement proposés par la console) :

1. Collections / objets de collection (si disponible)
2. Vin (si disponible, sinon Gastronomie/boissons)
3. Art
4. Loisirs / hobbies
5. Antiquités / brocante (à défaut : Maison)

> Les tags influencent le classement « applications similaires » : ne pas choisir de tags jeux/finance.

---

## 5. Garde-fous « métadonnées non trompeuses » (règle 2.3 Apple / politique Play)

- **Marketplace / communauté / transactions entre collectionneurs : NE PAS promettre.** Flag `enableMarketplace: false` — l'app affiche « Bientôt disponible » dans l'onglet Marché. Les descriptions ci-dessus n'en parlent qu'au futur (« arrive bientôt »), à l'identique de l'app. Ne pas créer de capture de cette section.
- Jamais les mots « expertise certifiée », « authentification garantie », « investissement » : nous affichons des **estimations indicatives** (disclaimers obligatoires sur chaque fiche, `@velum/core`).
- Les prix (9,99 / 19,99 / 49,99 €/mois) sont les **prix indicatifs** de `PLAN_PRICING_EUR` (`packages/config/src/index.ts`) : vérifier leur cohérence avec les produits App Store Connect / Play Console (`velum_premium_monthly`, `velum_gold_monthly`, `velum_platine_monthly`) avant soumission — un écart fiche/IAP est un motif de rejet 3.1.
- Le rapport assurance/succession est réservé Platine (`PLAN_LIMITS.platine.insuranceReport`) : il n'est mentionné que sous Platine.
- La mention « abonnement auto-renouvelable, résiliable à tout moment » figure dans chaque description ET dans l'app (`paywall.legal`).

---

## 6. Procédure de re-vérification des décomptes

Après **toute** retouche d'un champ contraint, recompter (Unicode, espaces comprises — c'est ainsi que comptent les consoles) :

```bash
python3 -c 'print(len("VELUM – Estimation collection"))'   # nom/titre ≤ 30
python3 -c 'print(len(open("champ.txt", encoding="utf-8").read().rstrip("\n")))'  # descriptions
```

Limites : iOS nom 30 · sous-titre 30 · mots-clés 100 · promo 170 · description 4000 (cible 2000–3500) — Play titre 30 · courte 80 · longue 4000 — accroches screenshots 40.
