import { describe, expect, it } from 'vitest';
import { ageDaysFromIso } from './transport.ts';

const NOW = (): Date => new Date('2026-07-10T12:00:00.000Z');

describe('ageDaysFromIso', () => {
  it('calcule une ancienneté passée en jours entiers', () => {
    expect(ageDaysFromIso('2026-07-09T12:00:00.000Z', NOW)).toBe(1);
  });

  it('tolère une dérive fournisseur inférieure à 24 heures', () => {
    expect(ageDaysFromIso('2026-07-11T11:59:59.000Z', NOW)).toBe(0);
  });

  it('rejette une date située à plus de 24 heures dans le futur', () => {
    expect(ageDaysFromIso('2026-07-11T12:00:01.000Z', NOW)).toBeNull();
  });

  it('rejette les dates absentes ou illisibles', () => {
    expect(ageDaysFromIso('', NOW)).toBeNull();
    expect(ageDaysFromIso('date-invalide', NOW)).toBeNull();
  });
});
