/**
 * Scan éclair et mode classeur (plateau de pièces) du plugin numismatique —
 * vision simulée, aucun réseau.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SHEET_DETECTIONS,
  RECOGNITION_MAX_TOKENS,
  SHEET_RECOGNITION_MAX_TOKENS,
  isVelumError,
  type VisionModel,
} from '@velum/core';
import { parseArrayWithSalvage } from './json.ts';
import { coinPlugin } from './plugin.ts';

type VisionRequest = Parameters<VisionModel['complete']>[0];

class FakeVision implements VisionModel {
  readonly requests: VisionRequest[] = [];
  constructor(private readonly responses: string[]) {}
  async complete(req: VisionRequest): Promise<string> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (next === undefined) throw new Error('FakeVision : plus de réponse fixture');
    return next;
  }
}

const PHOTO = {
  kind: 'photo' as const,
  media: [
    { role: 'obverse' as const, storagePath: 'u/a.jpg', base64: 'AAA=' },
    { role: 'reverse' as const, storagePath: 'u/b.jpg', base64: 'BBB=' },
  ],
};

describe('coinPlugin.recognize — scan éclair', () => {
  it('prompt compact (avers/revers, atelier), budget réduit', async () => {
    const vision = new FakeVision(['{"candidates":[]}']);
    await coinPlugin.recognize(PHOTO, { vision });
    const req = vision.requests[0];
    expect(req?.maxTokens).toBe(RECOGNITION_MAX_TOKENS);
    expect(req?.prompt).toContain('avers');
    expect(req?.prompt).toContain('revers');
    expect(req?.prompt).toContain('"estimate"');
    expect(req?.system).toContain("marque d'atelier");
  });

  it('conserve fourchette et classement, nettoie les attributs', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: '5 Francs Semeuse 1960',
            confidence: 0.9,
            attributes: { country: 'France', type: '5 Francs Semeuse', year: '1960', mintMark: '', metal: null },
            estimate: { low: 8, high: 15 },
            classification: 'France > Semeuse argent > 1959–1969',
          },
        ],
      }),
    ]);
    const best = (await coinPlugin.recognize(PHOTO, { vision })).candidates[0];
    expect(best?.attributes).toEqual({ country: 'France', type: '5 Francs Semeuse', year: 1960 });
    expect(best?.quickEstimate).toEqual({ low: 8, high: 15, currency: 'EUR' });
    expect(best?.classification).toEqual(['France', 'Semeuse argent', '1959–1969']);
  });

  it('écarte les fourchettes aberrantes (devise étrangère, valeur hors plafond)', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          { label: 'Double Eagle', confidence: 0.7, attributes: {}, estimate: { low: 1e8, high: 2e8 } },
          { label: 'Morgan dollar', confidence: 0.6, attributes: {}, estimate: { low: 30, high: 50, currency: 'USD' } },
        ],
      }),
    ]);
    const result = await coinPlugin.recognize(PHOTO, { vision });
    expect(result.candidates.every((c) => c.quickEstimate === undefined)).toBe(true);
  });
});

describe('coinPlugin.recognizeSheet — plateau de pièces', () => {
  it('identifie chaque pièce, en saisie assistée si illisible', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        detections: [
          { position: 'case 1', candidates: [{ label: '10 Francs Hercule 1965', confidence: 0.75, attributes: { year: 1965 } }] },
          { position: 'case 2', candidates: [{ label: 'Pièce usée', confidence: 0.1, attributes: {} }] },
        ],
      }),
    ]);
    const result = await coinPlugin.recognizeSheet(
      { kind: 'photo', media: [{ role: 'detail', storagePath: '', base64: 'data:image/jpeg;base64,CCC=' }] },
      { vision },
    );
    expect(vision.requests[0]?.maxTokens).toBe(SHEET_RECOGNITION_MAX_TOKENS);
    expect(vision.requests[0]?.images?.[0]).toEqual({ base64: 'CCC=', mediaType: 'image/jpeg' });
    expect(vision.requests[0]?.prompt).toContain('plateau');
    expect(result.truncated).toBe(false);
    expect(result.detections).toHaveLength(2);
    expect(result.detections[0]?.needsAssistedEntry).toBe(false);
    expect(result.detections[0]?.candidates[0]?.domain).toBe('coin');
    expect(result.detections[1]?.needsAssistedEntry).toBe(true);
  });

  it(`borne à ${MAX_SHEET_DETECTIONS} pièces et signale la troncature (réponse coupée comprise)`, async () => {
    const many = Array.from({ length: 26 }, (_, i) => ({
      position: `case ${i + 1}`,
      candidates: [{ label: `Pièce ${i + 1}`, confidence: 0.6, attributes: {} }],
    }));
    const vision = new FakeVision([JSON.stringify({ detections: many }), JSON.stringify({ detections: many }).slice(0, 200)]);
    const capped = await coinPlugin.recognizeSheet(PHOTO, { vision });
    expect(capped.detections).toHaveLength(MAX_SHEET_DETECTIONS);
    expect(capped.truncated).toBe(true);
    const cut = await coinPlugin.recognizeSheet(PHOTO, { vision });
    expect(cut.detections.length).toBeGreaterThan(0);
    expect(cut.detections.length).toBeLessThan(26);
    expect(cut.truncated).toBe(true);
  });

  it('refuse une entrée sans photo', async () => {
    const vision = new FakeVision([]);
    await expect(coinPlugin.recognizeSheet({ kind: 'file', fileRows: [] }, { vision })).rejects.toSatisfy(
      (error: unknown) => isVelumError(error) && error.code === 'INVALID_INPUT',
    );
  });
});

describe('parseArrayWithSalvage (copie numismatique)', () => {
  it('lit le JSON complet ou récupère les éléments entiers', () => {
    expect(parseArrayWithSalvage('{"detections":[{"a":1}]}', 'detections').complete).toBe(true);
    expect(parseArrayWithSalvage('{"detections":[{"a":1},{"b":', 'detections').items).toEqual([{ a: 1 }]);
  });
});
