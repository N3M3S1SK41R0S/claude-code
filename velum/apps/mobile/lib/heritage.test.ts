import { describe, expect, it } from 'vitest';
import { editionLabel, groupDigits, hasHeritage, rarityLabel, relativeAge } from './heritage';

// t factice : renvoie la clé, et « clé:count » quand un count est interpolé.
const t = (key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts['count']}` : key;

describe('hasHeritage', () => {
  it('faux si vide/absent', () => {
    expect(hasHeritage(null)).toBe(false);
    expect(hasHeritage({})).toBe(false);
  });
  it('vrai dès qu’un champ est présent', () => {
    expect(hasHeritage({ history: 'x' })).toBe(true);
    expect(hasHeritage({ rarity: { level: 'rare' } })).toBe(true);
    expect(hasHeritage({ editionSize: { unit: 'unique' } })).toBe(true);
  });
});

describe('groupDigits', () => {
  it('groupe les milliers avec une espace', () => {
    expect(groupDigits(20000)).toBe('20 000');
    expect(groupDigits(5000000)).toBe('5 000 000');
    expect(groupDigits(120)).toBe('120');
  });
});

describe('rarityLabel', () => {
  it('niveau traduit, note optionnelle', () => {
    expect(rarityLabel({ level: 'rare' }, t)).toBe('rarity.rare');
    expect(rarityLabel({ level: 'rare', note: 'états choisis' }, t)).toBe('rarity.rare · états choisis');
  });
});

describe('editionLabel', () => {
  it('compte + unité + note', () => {
    expect(editionLabel({ count: 20000, unit: 'stamps', note: 'tirage' }, t)).toBe(
      '20 000 edition.unit.stamps · tirage',
    );
  });
  it('sans compte (œuvre unique)', () => {
    expect(editionLabel({ unit: 'unique' }, t)).toBe('edition.unit.unique');
  });
});

describe('relativeAge', () => {
  it('paliers jour / mois / an', () => {
    expect(relativeAge(0, t)).toBe('time.today');
    expect(relativeAge(3, t)).toBe('time.daysAgo:3');
    expect(relativeAge(60, t)).toBe('time.monthsAgo:2');
    expect(relativeAge(400, t)).toBe('time.yearsAgo:1');
  });
});
