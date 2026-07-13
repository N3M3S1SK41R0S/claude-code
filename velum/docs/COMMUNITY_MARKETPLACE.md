# VELUM — Communauté marchande à séquestre (spécification affûtée)

> Issu d'une session **grill-me** (interview relentless) — décisions verrouillées
> par Pierre, juillet 2026. Accès **Platine uniquement**. Ce document sert de base
> au build (migration + Edge Functions + UI). Les rails d'argent réels (Stripe
> Connect) et le KYC/AML restent à câbler avec les identifiants du propriétaire.

## 1. Décisions verrouillées (grilling)

1. **Anonymat via étiquette d'expédition masquée** (façon Vinted/eBay) : l'adresse
   réelle n'est jamais montrée à l'autre partie. L'anonymat est **pair-à-pair** ;
   VELUM, lui, détient les identités vérifiées (KYC) pour le séquestre et l'AML.
2. **Deux rails logistiques selon le montant** :
   - **< 500 €** : étiquette masquée simple ; le séquestre couvre « objet non
     conforme ».
   - **≥ 500 €** : l'**expert/coffre partenaire devient le tiers de confiance** —
     le vendeur lui envoie l'objet, il **authentifie** puis **réexpédie assuré**
     (valeur déclarée, remise contre signature). Résout expertise + assurance +
     anonymat d'un seul geste.
3. **Authentification AVANT publication** pour tout objet **≥ 500 €** : l'expertise
   (à la charge du vendeur, pré-payée) est faite **avant** la mise en vente. Un
   faux n'atteint **jamais** l'acheteur ; l'annonce porte un badge
   « **authentifié VELUM** ». Le séquestre ne couvre alors plus que l'état/le
   transport, jamais l'authenticité.
4. **Libération du séquestre : automatique à J+X après livraison prouvée**
   (suivi transporteur ; **remise contre signature** obligatoire pour le
   high-value). Auto-libération 3–7 jours après livraison **sauf litige ouvert**.
   Le silence de l'acheteur ne bloque pas le vendeur ; le faux « non reçu » est
   cassé par la preuve de remise signée.

## 2. Machine à états d'une transaction (`orders`)

```
                 ┌───────────────┐
   (achat)  ───► │ pending_payment│  (autorisation de paiement)
                 └──────┬────────┘
                        │ paiement capturé → séquestre
                        ▼
                 ┌───────────────┐   ≥500 € : passe par l'expert
                 │  funds_held    │──────────────► authenticate ─┐
                 └──────┬────────┘                                │
                        │ étiquette masquée émise                 │ (échec auth
                        ▼                                         │  = bloqué
                 ┌───────────────┐                                │  avant vente,
                 │   shipped      │ (preuve de remise signée)     │  cf. §1.3)
                 └──────┬────────┘                                │
                        │ J+X sans litige                         │
                        ▼                                         │
                 ┌───────────────┐        ┌────────────┐          │
                 │   released     │        │  disputed  │◄─────────┘
                 └───────────────┘        └─────┬──────┘
                        ▲                        │ arbitrage
                 (fonds → vendeur,               ▼
                  commission prélevée)   released | refunded
```

- États : `pending_payment → funds_held → shipped → released` (heureux) ;
  branches `disputed → released|refunded`, et `cancelled` avant expédition.
- La **commission dégressive** (déjà implémentée, `commission_rate_for`, 5 %→2 %)
  est prélevée **à la libération**, pas à la mise en vente.
- Transitions pilotées serveur (Edge Function + trigger), jamais par le client.

## 3. Réputation vendeur (recommandation — sous-décision ouverte)

Alimentée par des signaux **objectifs** : ventes conclues, taux de litige, taux
d'authentification réussie, délai de réponse/expédition. Proposition :
- **Affichage** d'un score + badges (« vendeur vérifié », « 50+ ventes »,
  « 100 % authentifié »).
- **Modulation d'accès** : les privilèges (plafond de vente, mise en avant)
  s'ouvrent avec la réputation ; la **commission** reste pilotée par le volume de
  ventes (déjà en place). *À trancher : la réputation doit-elle AUSSI moduler le
  taux, ou seulement les privilèges ?*
- Sanctions : mauvaise foi répétée (faux, faux « non reçu ») → pénalité de
  réputation puis bannissement.

## 4. Arbitrage des litiges < 500 € (sous-décision ouverte)

Pas d'expert dans la boucle sous 500 €. *À trancher : qui arbitre « objet non
conforme » — support VELUM sur pièces photo, ou remboursement automatique
sur retour tracké ?*

## 5. Intégrations externes à câbler (hors périmètre code, besoin comptes)

| Brique | Fournisseur pressenti | Rôle |
|---|---|---|
| Séquestre & paiements | **Stripe Connect** (comptes vendeurs) | capture, hold, release, split commission |
| KYC / AML | prestataire d'identité | vérification vendeurs, conformité DSP2 |
| Étiquettes masquées | transporteur (Chronopost/Mondial Relay…) | adresses masquées, suivi, signature |
| Réseau d'experts | partenaires numismates/œno/phila | authentification ≥ 500 € + réexpédition assurée |

Le build livrera **tout le flux applicatif** (modèle de données, états, réputation,
UI Platine) avec **la capture/libération de paiement comme unique point
d'intégration** clairement stubbé, à brancher quand les comptes sont prêts.

## 6. Reste-t-il à décider ?

- Réputation → module-t-elle le taux de commission ou seulement les privilèges ?
- Arbitrage des litiges < 500 € (support humain vs remboursement auto sur retour) ?
- Frais du rail high-value (expertise + réexpédition) : 100 % vendeur, ou partagés ?
