/**
 * Feature flags & configuration produit (§15.3, §20).
 * Défauts MVP verrouillés : timbres OFF, art = tableaux, marketplace OFF.
 */

export type ArtDomainMode = 'tableaux' | 'art_de_la_table';

export interface VelumFeatures {
  /**
   * Module philatélie — MODULE À PART ENTIÈRE (décision produit juillet 2026,
   * révision du CDC v1.0 §0.1) : activé par défaut, désactivable par flag.
   */
  enableStamps: boolean;
  /** Bascule paramétrable du module art (§6.4). */
  artDomain: ArtDomainMode;
  /** Marketplace = phase 2 (KYC/AML/DSP2 requis, §12.4). */
  enableMarketplace: boolean;
}

export const DEFAULT_FEATURES: VelumFeatures = {
  enableStamps: true,
  artDomain: 'tableaux',
  enableMarketplace: false,
};

/**
 * Grille d'abonnement VELUM (révision produit juillet 2026) :
 * - free    : 5 scans/semaine offerts POUR CHAQUE module ;
 * - premium : scans illimités, mais SANS carnet/bibliothèque virtuelle ;
 * - gold    : illimité + carnet virtuel (cave à vin avec emplacements,
 *             table/album de pièces, galerie, album philatélique) ;
 * - platine : tout Gold + valorisation du carnet en continu vs transactions
 *             du marché + communauté (mise en relation anonymisée et
 *             transactions entre collectionneurs — commission 5 %,
 *             expert obligatoire à la charge du vendeur au-delà du seuil).
 */
export type PlanId = 'free' | 'premium' | 'gold' | 'platine';

export interface PlanEntitlements {
  /** Quota de scans par semaine ET par module (Infinity = illimité). */
  scansPerWeekPerModule: number;
  /** Carnet/bibliothèque virtuelle avec emplacements (Gold+). */
  virtualBook: boolean;
  /** Valorisation continue du carnet vs transactions marché (Platine). */
  liveValuation: boolean;
  /** Communauté & plateforme de transactions anonymisées (Platine). */
  community: boolean;
  exportPdf: boolean;
  alerts: boolean;
  /** Rapport assurance/succession. */
  insuranceReport: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanEntitlements> = {
  free: {
    scansPerWeekPerModule: 5,
    virtualBook: false,
    liveValuation: false,
    community: false,
    exportPdf: false,
    alerts: false,
    insuranceReport: false,
  },
  premium: {
    scansPerWeekPerModule: Infinity,
    virtualBook: false,
    liveValuation: false,
    community: false,
    exportPdf: true,
    alerts: true,
    insuranceReport: false,
  },
  gold: {
    scansPerWeekPerModule: Infinity,
    virtualBook: true,
    liveValuation: false,
    community: false,
    exportPdf: true,
    alerts: true,
    insuranceReport: false,
  },
  platine: {
    scansPerWeekPerModule: Infinity,
    virtualBook: true,
    liveValuation: true,
    community: true,
    exportPdf: true,
    alerts: true,
    insuranceReport: true,
  },
};

/** Prix indicatifs €/mois (à re-tester marché) — le paywall lit cette source unique. */
export const PLAN_PRICING_EUR: Record<Exclude<PlanId, 'free'>, number> = {
  premium: 9.99,
  gold: 19.99,
  platine: 49.99,
};

/**
 * Marketplace communautaire (Platine) — commission DÉGRESSIVE selon
 * l'activité du vendeur (révision produit juillet 2026) : 5 % maximum pour
 * les nouveaux vendeurs, 2 % minimum pour les plus actifs. Source unique
 * des paliers : `COMMISSION_TIERS` (répliquée en SQL par
 * `commission_rate_for` — migration 0004, tests rls_checks).
 */
export const MARKETPLACE_COMMISSION_MAX = 0.05;
export const MARKETPLACE_COMMISSION_MIN = 0.02;

/** Paliers : nombre minimal de ventes CONCLUES → taux de commission. */
export const COMMISSION_TIERS: readonly { minSales: number; rate: number }[] = [
  { minSales: 50, rate: 0.02 },
  { minSales: 25, rate: 0.03 },
  { minSales: 10, rate: 0.04 },
  { minSales: 0, rate: 0.05 },
];

/** Taux applicable pour un vendeur ayant `completedSales` ventes conclues. */
export function commissionRateFor(completedSales: number): number {
  const sales = Math.max(0, Math.floor(completedSales));
  const tier = COMMISSION_TIERS.find((t) => sales >= t.minSales);
  return tier?.rate ?? MARKETPLACE_COMMISSION_MAX;
}

/** @deprecated Utiliser commissionRateFor — conservé pour compat (taux max). */
export const MARKETPLACE_COMMISSION_RATE = MARKETPLACE_COMMISSION_MAX;

/**
 * Au-delà de ce montant, le recours à un analyste expert est obligatoire,
 * à la charge du vendeur, avant mise en transaction (pièces et timbres
 * notamment — appliqué à tous les domaines par prudence).
 */
export const EXPERT_APPRAISAL_THRESHOLD_EUR = 500;

/**
 * Séquestre communautaire : jours après livraison prouvée avant libération
 * AUTOMATIQUE des fonds au vendeur (sauf litige ouvert). Miroir applicatif de
 * `escrow_release_days()` (migration 0006).
 */
export const ESCROW_RELEASE_DAYS = 5;

/** true si le plan permet de scanner encore cette semaine dans ce module. */
export function canScan(plan: PlanId, scansThisWeekForModule: number): boolean {
  return scansThisWeekForModule < PLAN_LIMITS[plan].scansPerWeekPerModule;
}

/** Domaines actifs selon les flags — `stamp` n'apparaît que si enableStamps. */
export function activeDomains(features: VelumFeatures): ('wine' | 'coin' | 'art' | 'stamp')[] {
  const base: ('wine' | 'coin' | 'art' | 'stamp')[] = ['wine', 'coin', 'art'];
  return features.enableStamps ? [...base, 'stamp'] : base;
}

/**
 * Variables d'environnement CLIENT (publiques, non secrètes — §15.5).
 * Les secrets (LLM, Numista, Artprice, eBay, FX, Qdrant) vivent UNIQUEMENT
 * dans les Edge Functions ; jamais de secret dans EXPO_PUBLIC_* (§12.1).
 */
export interface ClientEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function readClientEnv(env: Record<string, string | undefined>): ClientEnv {
  const supabaseUrl = env['EXPO_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuration manquante : EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont requis.',
    );
  }
  return { supabaseUrl, supabaseAnonKey };
}
