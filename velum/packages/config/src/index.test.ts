import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURES, activeDomains, readClientEnv } from './index';

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
