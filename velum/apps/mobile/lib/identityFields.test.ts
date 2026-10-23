import { describe, expect, it } from 'vitest';
import {
  IDENTITY_FIELDS,
  MAX_CORRECTIONS_KEPT,
  applyIdentityCorrections,
  identityFieldsFor,
  identityValuesFrom,
  labelFromValues,
  parseNumericInput,
  validateIdentityValues,
} from './identityFields';

const NOW = new Date('2026-10-23T10:00:00Z');

describe('IDENTITY_FIELDS', () => {
  it('couvre les 5 domaines avec au moins 3 champs principaux chacun', () => {
    for (const domain of ['wine', 'coin', 'art', 'stamp', 'watch'] as const) {
      expect(identityFieldsFor(domain, true).length).toBeGreaterThanOrEqual(3);
      const keys = IDENTITY_FIELDS[domain].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('identityValuesFrom', () => {
  it('convertit chaînes et nombres, vide pour le reste', () => {
    const values = identityValuesFrom({ producer: 'Tempier', vintage: 2019, grapes: [] }, 'wine');
    expect(values['producer']).toBe('Tempier');
    expect(values['vintage']).toBe('2019');
    expect(values['cuvee']).toBe('');
  });
});

describe('parseNumericInput / validateIdentityValues', () => {
  it('accepte la virgule décimale française', () => {
    expect(parseNumericInput('38,5')).toBe(38.5);
    expect(parseNumericInput(' 2 015 ')).toBe(2015);
    expect(parseNumericInput('abc')).toBeNull();
  });

  it('signale les nombres invalides et hors bornes', () => {
    expect(validateIdentityValues({ vintage: 'deux mille' }, 'wine')).toEqual({
      vintage: 'identity.errors.notANumber',
    });
    expect(validateIdentityValues({ year: '1700' }, 'stamp')).toEqual({
      year: 'identity.errors.outOfRange',
    });
    expect(validateIdentityValues({ vintage: '2015', producer: 'X' }, 'wine')).toEqual({});
  });
});

describe('applyIdentityCorrections', () => {
  it('corrige, supprime les champs vidés et trace chaque changement', () => {
    const result = applyIdentityCorrections({
      domain: 'wine',
      attributes: { producer: 'Templer', vintage: 2018, cuvee: 'X', analysis: { keep: true } },
      title: 'Templer 2018',
      values: { producer: 'Tempier', vintage: '2019', cuvee: '', appellation: 'Bandol' },
      newTitle: 'Domaine Tempier Bandol 2019',
      now: NOW,
    });
    expect(result.attributes['producer']).toBe('Tempier');
    expect(result.attributes['vintage']).toBe(2019);
    expect(result.attributes['appellation']).toBe('Bandol');
    expect('cuvee' in result.attributes).toBe(false);
    expect(result.attributes['analysis']).toEqual({ keep: true });
    expect(result.title).toBe('Domaine Tempier Bandol 2019');
    expect(result.corrections.map((c) => c.field).sort()).toEqual(
      ['appellation', 'cuvee', 'producer', 'title', 'vintage'],
    );
    expect(result.corrections.find((c) => c.field === 'producer')).toEqual({
      field: 'producer',
      from: 'Templer',
      to: 'Tempier',
      at: NOW.toISOString(),
    });
    expect(result.attributes['corrections']).toHaveLength(5);
  });

  it('ne trace rien si rien ne change', () => {
    const result = applyIdentityCorrections({
      domain: 'coin',
      attributes: { country: 'France', year: 1868 },
      title: '20 Francs',
      values: { country: 'France', year: '1868' },
      newTitle: '20 Francs',
      now: NOW,
    });
    expect(result.corrections).toEqual([]);
    expect('corrections' in result.attributes).toBe(false);
  });

  it('borne l’historique des corrections', () => {
    const history = Array.from({ length: MAX_CORRECTIONS_KEPT }, (_, i) => ({
      field: 'country',
      from: `${i}`,
      to: `${i + 1}`,
      at: NOW.toISOString(),
    }));
    const result = applyIdentityCorrections({
      domain: 'coin',
      attributes: { country: 'A', corrections: history },
      title: null,
      values: { country: 'B' },
      now: NOW,
    });
    const kept = result.attributes['corrections'] as unknown[];
    expect(kept).toHaveLength(MAX_CORRECTIONS_KEPT);
    expect(kept.at(-1)).toMatchObject({ from: 'A', to: 'B' });
  });
});

describe('labelFromValues', () => {
  it('compose le libellé à partir des champs principaux', () => {
    expect(labelFromValues('watch', { brand: 'Omega', model: 'Speedmaster', reference: '', year: '1969' })).toBe(
      'Omega Speedmaster 1969',
    );
  });
});
