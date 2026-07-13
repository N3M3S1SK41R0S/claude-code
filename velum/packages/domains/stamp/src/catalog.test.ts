import { describe, expect, it } from 'vitest';
import { normalizeCatalogNumber } from './catalog.ts';

describe('normalizeCatalogNumber', () => {
  it('reconnaît les références Yvert & Tellier sous toutes leurs graphies', () => {
    expect(normalizeCatalogNumber('yt 1234')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 1234',
    });
    expect(normalizeCatalogNumber('YT1234')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 1234',
    });
    expect(normalizeCatalogNumber('Yvert & Tellier 129')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 129',
    });
    expect(normalizeCatalogNumber('yvert 130a')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 130a',
    });
    expect(normalizeCatalogNumber('Y&T n° 257A')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 257A',
    });
  });

  it('reconnaît Scott, Michel et Stanley Gibbons', () => {
    expect(normalizeCatalogNumber('Scott C3a')).toEqual({
      catalog: 'scott',
      catalogNumber: 'Scott C3a',
    });
    expect(normalizeCatalogNumber('Mi. 99')).toEqual({ catalog: 'michel', catalogNumber: 'Mi 99' });
    expect(normalizeCatalogNumber('michel 99a')).toEqual({
      catalog: 'michel',
      catalogNumber: 'Mi 99a',
    });
    expect(normalizeCatalogNumber('SG 45')).toEqual({
      catalog: 'stanley_gibbons',
      catalogNumber: 'SG 45',
    });
    expect(normalizeCatalogNumber('stanley gibbons 45')).toEqual({
      catalog: 'stanley_gibbons',
      catalogNumber: 'SG 45',
    });
    expect(normalizeCatalogNumber('sc 3')).toEqual({ catalog: 'scott', catalogNumber: 'Scott 3' });
  });

  it('tolère les espaces surnuméraires et la ponctuation de séparation', () => {
    expect(normalizeCatalogNumber('  yt   1234  ')).toEqual({
      catalog: 'yvert_tellier',
      catalogNumber: 'YT 1234',
    });
    expect(normalizeCatalogNumber('Mi.99')).toEqual({ catalog: 'michel', catalogNumber: 'Mi 99' });
  });

  it("retourne null pour une entrée qui n'est pas une référence de catalogue", () => {
    expect(normalizeCatalogNumber('')).toBeNull();
    expect(normalizeCatalogNumber('1234')).toBeNull(); // pas de catalogue → ambigu
    expect(normalizeCatalogNumber('XYZ 12')).toBeNull(); // catalogue inconnu
    expect(normalizeCatalogNumber('mint 12')).toBeNull(); // 'mi' collé à des lettres
    expect(normalizeCatalogNumber('yt')).toBeNull(); // alias seul, sans numéro
    expect(normalizeCatalogNumber('yt 12 34')).toBeNull(); // numéro implausible
  });
});
