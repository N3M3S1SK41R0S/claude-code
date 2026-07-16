import { describe, expect, it } from 'vitest';
import { isVelumError, type Profile } from '@velum/core';

import { planFromProfile } from './plan';
import { hasEntitlement, planRank } from './planRules';

const profile = (plan: Profile['plan']): Profile => ({
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Test',
  locale: 'fr',
  a11yMode: false,
  plan,
  createdAt: '2026-07-16T00:00:00.000Z',
});

describe('planRank', () => {
  it('ordonne free < premium < gold < platine', () => {
    expect(planRank('free')).toBe(0);
    expect(planRank('premium')).toBe(1);
    expect(planRank('gold')).toBe(2);
    expect(planRank('platine')).toBe(3);
  });
});

describe('hasEntitlement (grille juillet 2026)', () => {
  it('le carnet virtuel est réservé à Gold et Platine', () => {
    expect(hasEntitlement('free', 'virtualBook')).toBe(false);
    expect(hasEntitlement('premium', 'virtualBook')).toBe(false);
    expect(hasEntitlement('gold', 'virtualBook')).toBe(true);
    expect(hasEntitlement('platine', 'virtualBook')).toBe(true);
  });

  it('valorisation continue et communauté : Platine uniquement', () => {
    expect(hasEntitlement('gold', 'liveValuation')).toBe(false);
    expect(hasEntitlement('platine', 'liveValuation')).toBe(true);
    expect(hasEntitlement('gold', 'community')).toBe(false);
    expect(hasEntitlement('platine', 'community')).toBe(true);
  });
});

describe('planFromProfile', () => {
  it('dérive les droits uniquement depuis un profil confirmé', () => {
    const resolved = planFromProfile(profile('gold'));
    expect(resolved.plan).toBe('gold');
    expect(resolved.entitlements.virtualBook).toBe(true);
    expect(resolved.entitlements.community).toBe(false);
  });

  it("ne transforme jamais un profil absent en plan Free", () => {
    try {
      planFromProfile(null);
      throw new Error('planFromProfile aurait dû échouer');
    } catch (error) {
      expect(isVelumError(error)).toBe(true);
      if (isVelumError(error)) expect(error.code).toBe('SOURCE_UNAVAILABLE');
    }
  });
});
