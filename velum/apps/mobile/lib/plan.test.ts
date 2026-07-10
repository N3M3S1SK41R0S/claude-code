import { describe, expect, it } from 'vitest';
import { hasEntitlement, planRank } from './planRules';

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
