import { describe, expect, it } from 'vitest';
import { normalizeGrade, sheldonToFr } from './grade.ts';

describe('normalizeGrade', () => {
  it('reconnaît les grades français, insensible à la casse', () => {
    expect(normalizeGrade('TTB')).toEqual({ scale: 'fr', value: 'TTB' });
    expect(normalizeGrade('sup')).toEqual({ scale: 'fr', value: 'SUP' });
    expect(normalizeGrade(' fdc ')).toEqual({ scale: 'fr', value: 'FDC' });
    expect(normalizeGrade('B')).toEqual({ scale: 'fr', value: 'B' });
    expect(normalizeGrade('spl')).toEqual({ scale: 'fr', value: 'SPL' });
    expect(normalizeGrade('tb')).toEqual({ scale: 'fr', value: 'TB' });
  });

  it('conserve le suffixe + des grades français', () => {
    expect(normalizeGrade('TTB+')).toEqual({ scale: 'fr', value: 'TTB+' });
  });

  it('reconnaît les alias en toutes lettres', () => {
    expect(normalizeGrade('Fleur de coin')).toEqual({ scale: 'fr', value: 'FDC' });
    expect(normalizeGrade('Superbe')).toEqual({ scale: 'fr', value: 'SUP' });
    expect(normalizeGrade('très beau')).toEqual({ scale: 'fr', value: 'TB' });
  });

  it('reconnaît les grades Sheldon', () => {
    expect(normalizeGrade('MS65')).toEqual({ scale: 'sheldon', value: 'MS65' });
    expect(normalizeGrade('VF30')).toEqual({ scale: 'sheldon', value: 'VF30' });
    expect(normalizeGrade('vf 30')).toEqual({ scale: 'sheldon', value: 'VF30' });
    expect(normalizeGrade('au58')).toEqual({ scale: 'sheldon', value: 'AU58' });
    expect(normalizeGrade('VG8')).toEqual({ scale: 'sheldon', value: 'VG8' });
  });

  it('normalise EF en XF (équivalents)', () => {
    expect(normalizeGrade('EF45')).toEqual({ scale: 'sheldon', value: 'XF45' });
  });

  it('rejette les valeurs Sheldon hors plage 1..70', () => {
    expect(normalizeGrade('MS99')).toBeNull();
    expect(normalizeGrade('MS0')).toBeNull();
  });

  it('retourne null pour une entrée non reconnue — jamais de devinette', () => {
    expect(normalizeGrade('')).toBeNull();
    expect(normalizeGrade('état correct')).toBeNull();
    expect(normalizeGrade('ZZ12')).toBeNull();
    expect(normalizeGrade('42')).toBeNull();
  });
});

describe('sheldonToFr', () => {
  it('mappe les bornes documentées de la correspondance approximative', () => {
    expect(sheldonToFr(1)).toBe('B');
    expect(sheldonToFr(7)).toBe('B');
    expect(sheldonToFr(8)).toBe('TB');
    expect(sheldonToFr(19)).toBe('TB');
    expect(sheldonToFr(20)).toBe('TTB');
    expect(sheldonToFr(39)).toBe('TTB');
    expect(sheldonToFr(40)).toBe('SUP');
    expect(sheldonToFr(57)).toBe('SUP');
    expect(sheldonToFr(58)).toBe('SPL');
    expect(sheldonToFr(62)).toBe('SPL');
    expect(sheldonToFr(63)).toBe('FDC');
    expect(sheldonToFr(70)).toBe('FDC');
  });

  it('accepte un grade Sheldon complet en chaîne', () => {
    expect(sheldonToFr('MS65')).toBe('FDC');
    expect(sheldonToFr('VF30')).toBe('TTB');
    expect(sheldonToFr('XF45')).toBe('SUP');
  });

  it('retourne null hors plage ou pour une entrée illisible', () => {
    expect(sheldonToFr(0)).toBeNull();
    expect(sheldonToFr(71)).toBeNull();
    expect(sheldonToFr('grade inconnu')).toBeNull();
  });
});
