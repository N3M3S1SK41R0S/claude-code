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

/** Quotas du modèle freemium (§13.1) — 4 modules depuis l'ajout de la philatélie. */
export const PLAN_LIMITS = {
  free: { scansPerMonth: 10, modules: 1, exportPdf: false, alerts: false },
  premium: { scansPerMonth: Infinity, modules: 4, exportPdf: true, alerts: true },
  pro: { scansPerMonth: Infinity, modules: 4, exportPdf: true, alerts: true, insuranceReport: true, api: true },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

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
