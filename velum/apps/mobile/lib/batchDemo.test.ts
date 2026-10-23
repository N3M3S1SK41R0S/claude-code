/**
 * Mode DÉMO du scan éclair et du mode classeur : la reconnaissance simulée
 * respecte le contrat (fourchette indicative, classement, planche 6–12 objets)
 * et alimente la file du mode classeur sans backend.
 */
import { describe, expect, it } from 'vitest';
import { ASSISTED_ENTRY_THRESHOLD, isVelumError, type CaptureInput } from '@velum/core';

import { EMPTY_BATCH, batchReducer, batchSummary, type BatchState } from './batchQueue';
import { demoRecognize, demoRecognizeSheet } from './demo/demoData';

function sheetPhoto(path: string): CaptureInput {
  return { kind: 'photo', media: [{ role: 'detail', storagePath: path }] };
}

describe('demoRecognize — scan éclair démo', () => {
  it('candidats avec identité, classement et fourchette (sauf sous le seuil)', () => {
    const result = demoRecognize('stamp', { kind: 'photo', media: [{ role: 'front', storagePath: 'demo/a.jpg' }] });
    expect(result.candidates).toHaveLength(3);
    const [best, , last] = result.candidates;
    expect(best?.attributes['catalogNumber']).toBe('YT 130');
    expect(best?.classification).toEqual(['France', 'Semeuse lignée', '1903']);
    expect(best?.quickEstimate?.currency).toBe('EUR');
    expect((best?.quickEstimate?.low ?? 0) <= (best?.quickEstimate?.high ?? -1)).toBe(true);
    expect(last?.confidence).toBeLessThan(ASSISTED_ENTRY_THRESHOLD);
    expect(last?.quickEstimate).toBeUndefined();
  });

  it('saisie libre : libellé conservé, classement minimal honnête, aucun attribut inventé', () => {
    const best = demoRecognize('wine', { kind: 'text', text: 'Clos Rougeard Le Bourg 2014' }).candidates[0];
    expect(best?.label).toBe('Clos Rougeard Le Bourg 2014');
    expect(best?.attributes).toEqual({});
    expect(best?.classification).toEqual(['Vin']);
  });
});

describe('demoRecognizeSheet — planche démo', () => {
  it.each(['stamp', 'coin'] as const)('%s : 6 à 12 objets, stables pour une même photo', (domain) => {
    for (const path of ['demo/p1.jpg', 'demo/p2.jpg', 'demo/une-autre-planche.jpg']) {
      const first = demoRecognizeSheet(domain, sheetPhoto(path));
      const again = demoRecognizeSheet(domain, sheetPhoto(path));
      expect(first.detections.length).toBeGreaterThanOrEqual(6);
      expect(first.detections.length).toBeLessThanOrEqual(12);
      expect(first.truncated).toBe(false);
      expect(first.detections.map((d) => d.candidates[0]?.label)).toEqual(
        again.detections.map((d) => d.candidates[0]?.label),
      );
      expect(first.detections.map((d) => d.index)).toEqual(first.detections.map((_, i) => i));
      for (const detection of first.detections) {
        expect(detection.position).toMatch(/^rangée \d, case \d$/);
        expect(detection.candidates.every((c) => c.domain === domain)).toBe(true);
      }
    }
  });

  it('refuse un domaine sans planche et une entrée qui n’est pas une photo unique', () => {
    const codeOf = (run: () => unknown): string | null => {
      try {
        run();
        return null;
      } catch (error) {
        return isVelumError(error) ? error.code : 'NON_VELUM';
      }
    };
    expect(codeOf(() => demoRecognizeSheet('wine', sheetPhoto('demo/x.jpg')))).toBe('INVALID_INPUT');
    expect(codeOf(() => demoRecognizeSheet('stamp', { kind: 'text', text: 'classeur' }))).toBe('INVALID_INPUT');
    expect(codeOf(() => demoRecognizeSheet('coin', sheetPhoto('demo/ok.jpg')))).toBeNull();
  });

  it('alimente la file du mode classeur (lignes identifiées, incertaines, valeur indicative)', () => {
    const sheet = demoRecognizeSheet('stamp', sheetPhoto('demo/p1.jpg'));
    let state: BatchState = batchReducer(EMPTY_BATCH, {
      type: 'enqueue',
      id: 'p1',
      source: 'sheet',
      media: [{ role: 'detail', storagePath: 'demo/p1.jpg' }],
    });
    state = batchReducer(state, { type: 'start', id: 'p1' });
    state = batchReducer(state, { type: 'sheetRecognized', id: 'p1', ...sheet });
    const summary = batchSummary(state);
    expect(summary.total).toBe(sheet.detections.length);
    expect(summary.identified + summary.uncertain).toBe(sheet.detections.length);
    expect(summary.identified).toBeGreaterThan(0);
    expect(summary.indicativeTotal?.currency).toBe('EUR');
  });
});
