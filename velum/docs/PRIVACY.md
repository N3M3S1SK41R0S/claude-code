# Politique de confidentialité — VELUM

> **Note interne (à retirer de la version publiée)** : cette politique doit être **publiée sur une URL publique** (ex. `https://velum.app/privacy`) et **liée dans les fiches App Store et Google Play** ainsi que dans l'application (Réglages → Confidentialité). Les champs marqués `[À COMPLÉTER]` doivent être renseignés avant publication.

*Dernière mise à jour : 10 juillet 2026*

## 1. Responsable de traitement

L'application VELUM est éditée par :

- **Société** : `[À COMPLÉTER — raison sociale]`
- **Adresse** : `[À COMPLÉTER — siège social]`
- **E-mail de contact** : `privacy@velum.app` *(placeholder — à activer)*
- **Délégué à la protection des données (DPO)** : `dpo@velum.app` *(placeholder — à désigner et activer)*

Le responsable de traitement détermine les finalités et moyens des traitements décrits ci-dessous, conformément au Règlement (UE) 2016/679 (« RGPD ») et à la loi Informatique et Libertés.

## 2. Données collectées

| Catégorie | Données | Moment de la collecte |
|---|---|---|
| **Compte** | Adresse e-mail, identifiant utilisateur, nom d'affichage (optionnel), langue, préférences d'accessibilité (mode senior) | Création de compte (e-mail, Sign in with Apple ou Google) |
| **Photos** | Photographies de vos objets (bouteilles, pièces, tableaux, timbres) que vous choisissez de capturer ou d'importer | Lors de l'utilisation de la fonction d'identification |
| **Collection** | Objets enregistrés, attributs, état, notes personnelles, prix et date d'acquisition, lieu de stockage, analyses et estimations produites | Utilisation de l'app |
| **Achats** | Statut d'abonnement (gratuit/premium/pro), historique de transactions d'abonnement (via les stores), compteur de scans mensuel | Souscription et usage |

VELUM ne collecte **ni** géolocalisation, **ni** contacts, **ni** données publicitaires, et n'effectue **aucun suivi (tracking) à des fins publicitaires**. Aucune donnée n'est vendue.

## 3. Finalités et bases légales

| Finalité | Base légale (art. 6 RGPD) |
|---|---|
| Création et gestion du compte, authentification | Exécution du contrat (6.1.b) |
| **Identification et analyse par IA de vos photos** (reconnaissance de l'objet, fiche d'analyse) | **Consentement explicite (6.1.a)** — recueilli avant le premier envoi d'une photo au service d'IA ; refusable et retirable à tout moment (l'app reste utilisable en saisie manuelle) |
| Estimation de valeur et historique de valorisation | Exécution du contrat (6.1.b) |
| Gestion des abonnements et du quota gratuit | Exécution du contrat (6.1.b) |
| Notifications (alertes de prix, fenêtres de consommation) | Consentement (6.1.a) — permissions système |
| Sécurité, prévention des abus, journaux techniques | Intérêt légitime (6.1.f) |
| Respect d'obligations comptables et fiscales | Obligation légale (6.1.c) |

## 4. Sous-traitants et destinataires

Vos données sont traitées par les sous-traitants suivants, liés par des accords de traitement de données (DPA) :

| Sous-traitant | Rôle | Données concernées |
|---|---|---|
| **Supabase** | Hébergement de la base de données, authentification, stockage des photos, fonctions serveur | Compte, collection, photos |
| **Anthropic** | Analyse d'images par IA (vision) pour l'identification et l'analyse des objets | Photos soumises à l'identification, description textuelle de l'objet |
| **RevenueCat** | Gestion des abonnements multi-plateformes | Identifiant utilisateur, statut et historique d'abonnement |

Points importants concernant le traitement IA :

- Les photos ne sont transmises au fournisseur d'IA **qu'au moment où vous lancez une identification ou une analyse**, et uniquement si vous avez donné votre consentement explicite.
- Les clés d'accès aux services tiers ne transitent jamais par votre appareil (traitement côté serveur uniquement).
- Des transferts hors de l'Union européenne peuvent avoir lieu (États-Unis notamment) ; ils sont encadrés par des clauses contractuelles types et/ou le Data Privacy Framework selon le sous-traitant. Détails sur demande auprès du DPO.

Aucun autre destinataire, hors obligation légale.

## 5. Durées de conservation

| Données | Durée |
|---|---|
| Compte et collection | Tant que le compte est actif |
| Photos (bucket de stockage) | Tant que l'objet associé existe dans votre collection |
| Photos transmises au service d'IA | Non conservées par VELUM au-delà du traitement ; soumises à la politique de rétention limitée du fournisseur |
| Compteurs d'usage (quota mensuel) | 24 mois glissants |
| Données de transaction (obligations comptables) | 10 ans (obligation légale) |
| Après suppression du compte | **Purge complète sous 30 jours** de toutes les données (base + photos), hors données de facturation soumises à obligation légale |

## 6. Vos droits

Conformément aux articles 15 à 21 du RGPD, vous disposez des droits suivants :

- **Accès** — obtenir une copie de vos données ;
- **Rectification** — corriger des données inexactes ;
- **Suppression** (« droit à l'oubli ») — voir ci-dessous la suppression in-app ;
- **Portabilité** — recevoir vos données de collection dans un format structuré et lisible par machine (export disponible dans l'app) ;
- **Limitation** et **opposition** aux traitements fondés sur l'intérêt légitime ;
- **Retrait du consentement** à tout moment (notamment pour le traitement IA des photos), sans affecter la licéité des traitements antérieurs.

**Suppression in-app** : Réglages → Compte → **Supprimer mon compte**. La suppression est immédiate côté application et déclenche la **purge complète** (base de données et photos) sous 30 jours. Vous pouvez aussi exercer tout droit par e-mail auprès du DPO (`dpo@velum.app`).

Vous disposez du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) ou de l'autorité de contrôle de votre pays de résidence.

## 7. Sécurité

- Chiffrement en transit (TLS) pour tous les échanges.
- Cloisonnement strict des données par utilisateur (règles de sécurité au niveau des lignes de la base de données).
- Photos stockées dans un espace privé, accessibles uniquement via des liens signés à courte durée de vie.
- Aucune clé d'API sensible embarquée dans l'application.

## 8. Mineurs

VELUM ne s'adresse pas aux moins de 18 ans (le module Vin concerne des boissons alcoolisées). Nous ne collectons pas sciemment de données de mineurs.

## 9. Modifications

Toute modification substantielle de cette politique sera notifiée dans l'application avant son entrée en vigueur. La version en vigueur est toujours disponible à l'URL publique de publication.
