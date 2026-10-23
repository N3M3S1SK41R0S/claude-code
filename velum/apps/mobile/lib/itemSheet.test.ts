import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';

import { MAX_CORRECTIONS_KEPT } from './identityFields';
import {
  analysisMeta,
  analysisPayloadOf,
  analysisResultFromItem,
  classificationOf,
  correctItemIdentity,
  correctionFieldLabelKey,
  correctionHistory,
  formatIdentityValue,
  formatThreshold,
  fullSheetState,
  hasCorrections,
  hasFormErrors,
  identityFormInitialValues,
  identityRows,
  isValuationOutdated,
  isValuationStale,
  itemDisclaimers,
  lastCorrectionAt,
  mergeAnalysisAttributes,
  parseAlertThreshold,
  priceAlertConfig,
  priceAlertOf,
  quickEstimateOf,
  resolveSectionBehavior,
  shouldSuggestCorrection,
  validateIdentityForm,
  TITLE_FIELD_LABEL_KEY,
  TITLE_REQUIRED_ERROR_KEY,
} from './itemSheet';

const NOW = new Date('2026-10-23T10:00:00.000Z');

function item(attributes: Record<string, unknown>, overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id: 'i1',
    ownerId: 'o',
    domain: 'stamp',
    title: 'Cérès 1849',
    attributes,
    confidence: 0.8,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('formatIdentityValue', () => {
  it('garde le texte et formate les nombres sans séparateur de milliers', () => {
    expect(formatIdentityValue('YT 3')).toBe('YT 3');
    expect(formatIdentityValue(1849)).toBe('1849');
    expect(formatIdentityValue(38.5)).toBe('38,5');
    expect(formatIdentityValue(38.5, 'en')).toBe('38.5');
    expect(formatIdentityValue(-800)).toMatch(/800$/);
  });
});

describe('identityRows', () => {
  it('liste les champs renseignés dans l’ordre du domaine et marque les champs corrigés', () => {
    const rows = identityRows(
      item({
        year: 1849,
        country: 'France',
        catalogNumber: '  ',
        color: { nested: true },
        analysis: { a: 1 },
        corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' }],
      }),
    );
    expect(rows).toEqual([
      { key: 'country', labelKey: 'candidates.fields.stampCountry', value: 'France', corrected: false },
      { key: 'year', labelKey: 'candidates.fields.stampYear', value: '1849', corrected: true },
    ]);
  });

  it('formate un diamètre de montre selon la locale', () => {
    const watch = item({ brand: 'Omega', caseDiameterMm: 42.5 }, { domain: 'watch' });
    expect(identityRows(watch, 'fr').at(-1)).toMatchObject({ key: 'caseDiameterMm', value: '42,5' });
    expect(identityRows(watch, 'en').at(-1)).toMatchObject({ value: '42.5' });
  });

  it('renvoie une liste vide sans attribut d’identité', () => {
    expect(identityRows(item({ analysis: {} }))).toEqual([]);
  });
});

describe('historique des corrections', () => {
  const attributes = {
    corrections: [
      { field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' },
      'corrompu',
      { field: 'title', from: 'Ceres', to: 'Cérès 1849', at: '2026-05-03T00:00:00Z' },
      { field: 'color', from: null, to: 'noir', at: '2026-05-03T00:00:00Z' },
      { field: 'ancien', from: 'x', to: { objet: true }, at: '2026-05-01T00:00:00Z' },
      { field: 'year', from: 1849, to: 1850, at: 'pas une date' },
      { from: 'a', to: 'b', at: '2026-05-04T00:00:00Z' },
    ],
  };

  it('relit défensivement, du plus récent au plus ancien', () => {
    expect(correctionHistory(attributes, 'stamp')).toEqual([
      { field: 'color', labelKey: 'candidates.fields.stampColor', from: null, to: 'noir', at: '2026-05-03T00:00:00Z' },
      { field: 'title', labelKey: TITLE_FIELD_LABEL_KEY, from: 'Ceres', to: 'Cérès 1849', at: '2026-05-03T00:00:00Z' },
      { field: 'year', labelKey: 'candidates.fields.stampYear', from: '1850', to: '1849', at: '2026-05-02T00:00:00Z' },
      { field: 'ancien', labelKey: null, from: 'x', to: null, at: '2026-05-01T00:00:00Z' },
    ]);
  });

  it('détecte la présence et la date de la dernière correction', () => {
    expect(hasCorrections(attributes)).toBe(true);
    expect(lastCorrectionAt(attributes)).toBe('2026-05-03T00:00:00Z');
    expect(hasCorrections({ corrections: [] })).toBe(false);
    expect(hasCorrections({ corrections: 'n/a' })).toBe(false);
    expect(hasCorrections({ corrections: ['x', { field: 'year' }] })).toBe(false);
    expect(lastCorrectionAt({})).toBeNull();
  });

  it('donne la clé du libellé d’un champ corrigé', () => {
    expect(correctionFieldLabelKey('wine', 'vintage')).toBe('candidates.fields.wineVintage');
    expect(correctionFieldLabelKey('wine', 'title')).toBe(TITLE_FIELD_LABEL_KEY);
    expect(correctionFieldLabelKey('wine', 'inconnu')).toBeNull();
  });
});

describe('classement et invitation à corriger', () => {
  it('relit le classement du scan éclair', () => {
    expect(classificationOf({ classification: ['France', ' Cérès ', '', 3] })).toEqual(['France', 'Cérès']);
    expect(classificationOf({ classification: [] })).toBeNull();
    expect(classificationOf({})).toBeNull();
  });

  it('invite à vérifier une identification peu sûre jamais corrigée', () => {
    expect(shouldSuggestCorrection(item({}, { confidence: 0.3 }))).toBe(true);
    expect(shouldSuggestCorrection(item({}, { confidence: 0.9 }))).toBe(false);
    expect(shouldSuggestCorrection(item({}, { confidence: null }))).toBe(false);
    expect(
      shouldSuggestCorrection(
        item(
          { corrections: [{ field: 'year', from: 1, to: 2, at: '2026-05-02T00:00:00Z' }] },
          { confidence: 0.3 },
        ),
      ),
    ).toBe(false);
  });
});

describe('formulaire de correction', () => {
  it('pré-remplit la désignation et TOUS les champs du domaine', () => {
    const initial = identityFormInitialValues(item({ year: 1849, country: 'France' }));
    expect(initial.title).toBe('Cérès 1849');
    expect(Object.keys(initial.values)).toEqual([
      'country',
      'catalogNumber',
      'year',
      'title',
      'faceValue',
      'color',
      'perforation',
    ]);
    expect(initial.values['year']).toBe('1849');
    expect(identityFormInitialValues(item({}, { title: null })).title).toBe('');
  });

  it('propose une désignation composée des champs principaux si elle manque', () => {
    const initial = identityFormInitialValues(
      item({ country: 'France', catalogNumber: 'YT 3', year: 1849, color: 'noir' }, { title: '  ' }),
    );
    expect(initial.title).toBe('France YT 3 1849');
  });

  it('valide les nombres et exige une désignation', () => {
    const valid = validateIdentityForm('stamp', 'Cérès', { year: '1849', title: '' });
    expect(valid).toEqual({ title: null, fields: {} });
    expect(hasFormErrors(valid)).toBe(false);

    const invalid = validateIdentityForm('stamp', '  ', { year: 'mille', title: 'Cérès' });
    expect(invalid).toEqual({ title: TITLE_REQUIRED_ERROR_KEY, fields: { year: 'identity.errors.notANumber' } });
    expect(hasFormErrors(invalid)).toBe(true);

    expect(validateIdentityForm('stamp', 'x', { year: '1700' })).toEqual({
      title: null,
      fields: { year: 'identity.errors.outOfRange' },
    });
    expect(hasFormErrors(validateIdentityForm('stamp', '', {}))).toBe(true);
  });

  it('n’attribue pas l’erreur de désignation au champ « title » du domaine', () => {
    // Timbre : le champ d'identité `title` (sujet) est distinct de la désignation.
    const errors = validateIdentityForm('stamp', '', { title: '' });
    expect(errors.fields).not.toHaveProperty('title');
    expect(errors.title).toBe(TITLE_REQUIRED_ERROR_KEY);
  });
});

describe('correctItemIdentity', () => {
  it('trace une correction réelle et retire la fourchette de l’objet mal lu', () => {
    const before = item({
      country: 'France',
      year: 1850,
      quickEstimate: { low: 10, high: 30, currency: 'EUR' },
      analysisStatus: 'pending',
    });
    const out = correctItemIdentity({
      item: before,
      values: { country: 'France', year: '1849' },
      title: 'Cérès 1849',
      now: NOW,
    });
    expect(out.changed).toBe(true);
    expect(out.identityChanged).toBe(true);
    expect(out.title).toBe('Cérès 1849');
    expect(out.attributes['year']).toBe(1849);
    expect(out.attributes['quickEstimate']).toBeUndefined();
    expect(out.attributes['analysisStatus']).toBe('pending');
    expect(out.corrections).toEqual([{ field: 'year', from: 1850, to: 1849, at: NOW.toISOString() }]);
    expect(out.attributes['corrections']).toEqual(out.corrections);
    // L'objet d'origine n'est jamais muté.
    expect(before.attributes['year']).toBe(1850);
    expect(before.attributes['quickEstimate']).toBeDefined();
  });

  it('ignore une valeur seulement re-typée (nombre lu, texte ressaisi)', () => {
    const before = item({ year: '1849', faceValue: 5 });
    const out = correctItemIdentity({
      item: before,
      values: { year: '1849', faceValue: '5' },
      title: 'Cérès 1849',
      now: NOW,
    });
    expect(out.changed).toBe(false);
    expect(out.attributes).toBe(before.attributes);
    expect(out.corrections).toEqual([]);
  });

  it('garde les valeurs lues re-typées à côté d’une vraie correction', () => {
    const out = correctItemIdentity({
      item: item({ year: '1849', faceValue: 5, color: 'noir' }),
      values: { year: '1849', faceValue: '5', color: 'bleu' },
      title: 'Cérès 1849',
      now: NOW,
    });
    expect(out.changed).toBe(true);
    expect(out.attributes['year']).toBe('1849');
    expect(out.attributes['faceValue']).toBe(5);
    expect(out.attributes['color']).toBe('bleu');
    expect(out.corrections.map((c) => c.field)).toEqual(['color']);
  });

  it('une correction de désignation seule garde la fourchette indicative', () => {
    const out = correctItemIdentity({
      item: item({ quickEstimate: { low: 10, high: 30, currency: 'EUR' } }),
      values: {},
      title: 'Cérès noir 1849',
      now: NOW,
    });
    expect(out.changed).toBe(true);
    expect(out.identityChanged).toBe(false);
    expect(out.title).toBe('Cérès noir 1849');
    expect(out.attributes['quickEstimate']).toEqual({ low: 10, high: 30, currency: 'EUR' });
  });

  it('un champ vidé supprime l’attribut, un formulaire partiel n’efface rien', () => {
    const cleared = correctItemIdentity({
      item: item({ color: 'noir', year: 1849 }),
      values: { color: '' },
      title: 'Cérès 1849',
      now: NOW,
    });
    expect(cleared.attributes).not.toHaveProperty('color');
    expect(cleared.attributes['year']).toBe(1849);
    expect(cleared.corrections).toEqual([{ field: 'color', from: 'noir', to: null, at: NOW.toISOString() }]);
  });

  it('borne l’historique et conserve les corrections antérieures', () => {
    const history = Array.from({ length: MAX_CORRECTIONS_KEPT }, (_, i) => ({
      field: 'color',
      from: `c${i}`,
      to: `c${i + 1}`,
      at: '2026-01-01T00:00:00Z',
    }));
    const out = correctItemIdentity({
      item: item({ color: 'c30', corrections: history }),
      values: { color: 'rouge' },
      title: 'Cérès 1849',
      now: NOW,
    });
    const kept = out.attributes['corrections'] as unknown[];
    expect(kept).toHaveLength(MAX_CORRECTIONS_KEPT);
    expect(kept.at(-1)).toEqual({ field: 'color', from: 'c30', to: 'rouge', at: NOW.toISOString() });
    expect(kept[0]).toEqual(history[1]);
  });
});

describe('fiche complète à la demande', () => {
  it('déduit l’état affiché', () => {
    expect(fullSheetState(item({ analysisStatus: 'pending' }))).toBe('missing');
    expect(fullSheetState(item({}))).toBe('missing');
    expect(fullSheetState(item({ analysisStatus: 'failed' }))).toBe('failed');
    expect(fullSheetState(item({ analysis: {}, analyzedAt: '2026-05-01T00:00:00Z' }))).toBe('complete');
    expect(
      fullSheetState(
        item({
          analysis: {},
          analyzedAt: '2026-05-01T00:00:00Z',
          corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' }],
        }),
      ),
    ).toBe('outdated');
  });

  it('fusionne la fiche sans perdre l’identité ni l’historique', () => {
    const merged = mergeAnalysisAttributes(
      {
        country: 'France',
        analysisStatus: 'pending',
        corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' }],
        quickEstimate: { low: 1, high: 2, currency: 'EUR' },
      },
      { engine: 'phila_v1', payload: { rarity: { level: 'rare' } }, disclaimers: ['Indicatif', '', '  '] },
      NOW,
    );
    expect(merged).toEqual({
      country: 'France',
      corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:00Z' }],
      quickEstimate: { low: 1, high: 2, currency: 'EUR' },
      analysis: { rarity: { level: 'rare' } },
      analysisEngine: 'phila_v1',
      disclaimers: ['Indicatif'],
      analyzedAt: NOW.toISOString(),
    });
    expect(merged).not.toHaveProperty('analysisStatus');
    expect(fullSheetState({ attributes: merged ?? {} })).toBe('complete');
  });

  it('une correction faite PENDANT la génération périme la fiche', () => {
    const requestedAt = new Date('2026-05-02T00:00:00Z');
    const merged = mergeAnalysisAttributes(
      { corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T00:00:05Z' }] },
      { engine: 'phila_v1', payload: {}, disclaimers: [] },
      requestedAt,
    );
    expect(fullSheetState({ attributes: merged ?? {} })).toBe('outdated');
  });

  it('refuse un payload inexploitable', () => {
    expect(
      mergeAnalysisAttributes({}, { engine: 'x', payload: null as unknown as Record<string, unknown>, disclaimers: [] }, NOW),
    ).toBeNull();
    expect(
      mergeAnalysisAttributes({}, { engine: 'x', payload: [] as unknown as Record<string, unknown>, disclaimers: [] }, NOW),
    ).toBeNull();
  });

  it('relit moteur, date, avertissements et payload', () => {
    expect(analysisMeta({ analysisEngine: 'numis_v1', analyzedAt: '2026-05-01T00:00:00Z' })).toEqual({
      engine: 'numis_v1',
      analyzedAt: '2026-05-01T00:00:00Z',
    });
    expect(analysisMeta({ analysisEngine: '', analyzedAt: 'hier' })).toEqual({ engine: null, analyzedAt: null });
    expect(itemDisclaimers({ disclaimers: ['a', 3, ''] })).toEqual(['a']);
    expect(itemDisclaimers({})).toEqual([]);
    expect(analysisPayloadOf({ analysis: [1] })).toBeNull();
    expect(analysisPayloadOf({ analysis: { a: 1 } })).toEqual({ a: 1 });
  });

  it('reconstruit le résultat d’analyse pour l’export PDF', () => {
    expect(analysisResultFromItem(item({}))).toBeNull();
    expect(
      analysisResultFromItem(item({ analysis: { a: 1 }, analysisEngine: 'phila_v1', disclaimers: ['Indicatif'] })),
    ).toEqual({ engine: 'phila_v1', payload: { a: 1 }, confidence: 0.8, sources: [], disclaimers: ['Indicatif'] });
  });
});

describe('estimation', () => {
  it('relit la fourchette indicative du scan éclair', () => {
    expect(quickEstimateOf({ quickEstimate: { low: 10, high: 30, currency: 'EUR' } })).toEqual({ low: 10, high: 30 });
    expect(quickEstimateOf({ quickEstimate: { low: 10, high: 30 } })).toEqual({ low: 10, high: 30 });
    expect(quickEstimateOf({ quickEstimate: { low: 10, high: 30, currency: 'USD' } })).toBeNull();
    expect(quickEstimateOf({ quickEstimate: { low: 40, high: 30 } })).toBeNull();
    expect(quickEstimateOf({ quickEstimate: { low: -1, high: 30 } })).toBeNull();
    expect(quickEstimateOf({ quickEstimate: { low: 0, high: 0 } })).toBeNull();
    expect(quickEstimateOf({ quickEstimate: { low: '10', high: 30 } })).toBeNull();
    expect(quickEstimateOf({ quickEstimate: { low: Number.NaN, high: 30 } })).toBeNull();
    expect(quickEstimateOf({})).toBeNull();
  });

  it('signale une estimation antérieure à la dernière correction', () => {
    const corrected = item({ corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T10:00:00.000Z' }] });
    expect(isValuationOutdated(corrected, { valuedAt: '2026-05-01T00:00:00+00:00' })).toBe(true);
    // Formats ISO différents (Postgres vs client) : comparaison chronologique.
    expect(isValuationOutdated(corrected, { valuedAt: '2026-05-02T12:00:00+02:00' })).toBe(false);
    expect(isValuationOutdated(corrected, { valuedAt: '2026-05-03T00:00:00Z' })).toBe(false);
    expect(isValuationOutdated(corrected, null)).toBe(false);
    expect(isValuationOutdated(item({}), { valuedAt: '2026-05-01T00:00:00Z' })).toBe(false);
    expect(isValuationOutdated(corrected, { valuedAt: 'invalide' })).toBe(false);
  });

  it('une relance réussie après la correction rend l’estimation à jour malgré l’horloge serveur', () => {
    const correctedAtMs = Date.parse('2026-05-02T10:00:00.000Z');
    const corrected = item({ corrections: [{ field: 'year', from: 1850, to: 1849, at: '2026-05-02T10:00:00.000Z' }] });
    // Horloge serveur en retard : l'estimation relancée paraît antérieure.
    const lagging = { valuedAt: '2026-05-02T09:59:00Z' };
    expect(isValuationStale(corrected, lagging, null)).toBe(true);
    expect(isValuationStale(corrected, lagging, correctedAtMs + 5_000)).toBe(false);
    // Relance ANTÉRIEURE à la correction : toujours à relancer.
    expect(isValuationStale(corrected, lagging, correctedAtMs - 60_000)).toBe(true);
    expect(isValuationStale(item({}), lagging, null)).toBe(false);
    expect(isValuationStale(corrected, null, null)).toBe(false);
  });
});

describe('alerte de prix', () => {
  it('accepte un seuil saisi à la française et refuse le reste', () => {
    expect(parseAlertThreshold('1 200,50')).toBe(1200.5);
    expect(parseAlertThreshold('250')).toBe(250);
    expect(parseAlertThreshold('19,999')).toBe(20);
    expect(parseAlertThreshold('0,001')).toBeNull();
    expect(parseAlertThreshold('0')).toBeNull();
    expect(parseAlertThreshold('-5')).toBeNull();
    expect(parseAlertThreshold('')).toBeNull();
    expect(parseAlertThreshold('beaucoup')).toBeNull();
  });

  it('affiche le seuil tel que saisi, sans arrondi caché à l’euro', () => {
    // Espaces insécables variables selon ICU : on normalise avant de comparer.
    const normalize = (s: string) => s.replace(/\s/g, ' ');
    expect(normalize(formatThreshold(1200.5))).toBe('1 200,50 €');
    expect(normalize(formatThreshold(300))).toBe('300 €');
    expect(formatThreshold(1200.5, 'en')).toBe('€1,200.50');
    expect(formatThreshold(300, 'en')).toBe('€300');
  });

  it('produit la configuration lue par price-cron', () => {
    expect(priceAlertConfig('below', 300)).toEqual({ direction: 'below', threshold: 300 });
    expect(priceAlertConfig('above', 1200)).toEqual({ direction: 'above', threshold: 1200 });
  });

  it('relit une alerte de seuil active, ignore le reste', () => {
    const base = { type: 'price_threshold' as const, active: true };
    expect(priceAlertOf({ ...base, config: { direction: 'below', threshold: 300 } })).toEqual({
      direction: 'below',
      threshold: 300,
    });
    expect(priceAlertOf({ ...base, active: false, config: { direction: 'below', threshold: 300 } })).toBeNull();
    expect(priceAlertOf({ ...base, type: 'drink_window', config: { direction: 'below', threshold: 300 } })).toBeNull();
    expect(priceAlertOf({ ...base, config: { direction: 'sideways', threshold: 300 } })).toBeNull();
    expect(priceAlertOf({ ...base, config: { direction: 'above', threshold: '300' } })).toBeNull();
    expect(priceAlertOf({ ...base, config: { direction: 'above', threshold: 0 } })).toBeNull();
    expect(priceAlertOf({ ...base, config: {} })).toBeNull();
  });
});

describe('sections repliables', () => {
  it('les props explicites l’emportent sur les valeurs du groupe', () => {
    expect(resolveSectionBehavior({}, {})).toEqual({ collapsible: false, initiallyOpen: true });
    expect(resolveSectionBehavior({}, { collapsible: true, defaultOpen: false })).toEqual({
      collapsible: true,
      initiallyOpen: false,
    });
    expect(resolveSectionBehavior({ defaultOpen: true }, { collapsible: true, defaultOpen: false })).toEqual({
      collapsible: true,
      initiallyOpen: true,
    });
    expect(resolveSectionBehavior({ collapsible: false }, { collapsible: true, defaultOpen: false })).toEqual({
      collapsible: false,
      initiallyOpen: true,
    });
    expect(resolveSectionBehavior({ collapsible: true }, {})).toEqual({ collapsible: true, initiallyOpen: true });
  });
});
