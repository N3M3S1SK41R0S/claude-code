import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURES,
  EXPERT_APPRAISAL_THRESHOLD_EUR,
  commissionRateFor,
  PLAN_LIMITS,
  activeDomains,
  canScan,
  readClientEnv,
} from './index';

describe('feature flags', () => {
  it('la philatélie est un module à part entière (activé par défaut)', () => {
    expect(DEFAULT_FEATURES.enableStamps).toBe(true);
    expect(activeDomains(DEFAULT_FEATURES)).toEqual(['wine', 'coin', 'art', 'stamp']);
  });

  it('le flag enableStamps reste désactivable', () => {
    expect(activeDomains({ ...DEFAULT_FEATURES, enableStamps: false })).toEqual([
      'wine',
      'coin',
      'art',
    ]);
  });

  it('marketplace OFF au MVP, art = tableaux', () => {
    expect(DEFAULT_FEATURES.enableMarketplace).toBe(false);
    expect(DEFAULT_FEATURES.artDomain).toBe('tableaux');
  });
});

describe('grille d’abonnement (révision juillet 2026)', () => {
  it('free : 5 scans/semaine par module, pas de carnet', () => {
    expect(PLAN_LIMITS.free.scansPerWeekPerModule).toBe(5);
    expect(PLAN_LIMITS.free.virtualBook).toBe(false);
    expect(canScan('free', 4)).toBe(true);
    expect(canScan('free', 5)).toBe(false);
  });

  it('premium : illimité mais SANS carnet virtuel', () => {
    expect(PLAN_LIMITS.premium.scansPerWeekPerModule).toBe(Infinity);
    expect(PLAN_LIMITS.premium.virtualBook).toBe(false);
    expect(canScan('premium', 10_000)).toBe(true);
  });

  it('gold : illimité + carnet virtuel, sans communauté ni valorisation continue', () => {
    expect(PLAN_LIMITS.gold.virtualBook).toBe(true);
    expect(PLAN_LIMITS.gold.liveValuation).toBe(false);
    expect(PLAN_LIMITS.gold.community).toBe(false);
  });

  it('platine : intégralité des fonctions', () => {
    expect(PLAN_LIMITS.platine).toEqual({
      scansPerWeekPerModule: Infinity,
      virtualBook: true,
      liveValuation: true,
      community: true,
      exportPdf: true,
      alerts: true,
      insuranceReport: true,
    });
  });

  it('marketplace : commission dégressive 5 % → 2 % selon l’activité du vendeur', () => {
    expect(commissionRateFor(0)).toBe(0.05); // nouveau vendeur : max
    expect(commissionRateFor(9)).toBe(0.05);
    expect(commissionRateFor(10)).toBe(0.04);
    expect(commissionRateFor(24)).toBe(0.04);
    expect(commissionRateFor(25)).toBe(0.03);
    expect(commissionRateFor(49)).toBe(0.03);
    expect(commissionRateFor(50)).toBe(0.02); // gros vendeur : min
    expect(commissionRateFor(500)).toBe(0.02);
    expect(commissionRateFor(-3)).toBe(0.05); // défensif
    expect(EXPERT_APPRAISAL_THRESHOLD_EUR).toBe(500);
  });
});

describe('readClientEnv', () => {
  it('lit les variables publiques Expo', () => {
    expect(
      readClientEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' });
  });

  it('échoue explicitement si la config manque', () => {
    expect(() => readClientEnv({})).toThrowError(/EXPO_PUBLIC_SUPABASE_URL/);
  });
});
