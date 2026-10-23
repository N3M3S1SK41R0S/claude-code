/** Scan éclair du plugin tableaux : fourchette prudente, classement, sortie compacte. */
import { describe, expect, it } from 'vitest';
import { RECOGNITION_MAX_TOKENS, type VisionModel } from '@velum/core';
import { ART_RECOGNITION_SYSTEM_PROMPT, artPlugin } from './index.ts';

type VisionRequest = Parameters<VisionModel['complete']>[0];

class FakeVision implements VisionModel {
  readonly requests: VisionRequest[] = [];
  constructor(private readonly responses: string[]) {}
  async complete(req: VisionRequest): Promise<string> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (next === undefined) throw new Error('FakeVision : aucune réponse restante');
    return next;
  }
}

describe('artPlugin.recognize — scan éclair', () => {
  it('demande une fourchette liée à l’attribution qualifiée, budget réduit', async () => {
    const vision = new FakeVision(['{"candidates":[]}']);
    await artPlugin.recognize({ kind: 'text', text: 'paysage provençal signé' }, { vision });
    expect(vision.requests[0]?.maxTokens).toBe(RECOGNITION_MAX_TOKENS);
    expect(ART_RECOGNITION_SYSTEM_PROMPT).toContain('attribution qualifiée');
    expect(ART_RECOGNITION_SYSTEM_PROMPT).toContain('"classification"');
  });

  it('conserve fourchette et classement, retire les attributs vides', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'École provençale — Paysage aux oliviers',
            confidence: 0.55,
            attributes: { attributionQualifier: 'ecole_de', artist: '', technique: 'huile sur toile' },
            estimate: { low: 300, high: 800 },
            classification: ['Peinture', 'École provençale', 'début XXe'],
          },
        ],
      }),
    ]);
    const best = (await artPlugin.recognize({ kind: 'text', text: 'paysage provençal' }, { vision }))
      .candidates[0];
    expect(best?.attributes).toEqual({ attributionQualifier: 'ecole_de', technique: 'huile sur toile' });
    expect(best?.quickEstimate).toEqual({ low: 300, high: 800, currency: 'EUR' });
    expect(best?.classification).toEqual(['Peinture', 'École provençale', 'début XXe']);
  });

  it('écarte une fourchette non informative', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [{ label: 'Anonyme — Marine', confidence: 0.5, attributes: {}, estimate: { low: 10, high: 50000 } }],
      }),
    ]);
    const result = await artPlugin.recognize({ kind: 'text', text: 'marine' }, { vision });
    expect(result.candidates[0]?.quickEstimate).toBeUndefined();
  });
});
