/** Scan éclair du plugin montres : fourchette indicative, classement, sortie compacte. */
import { describe, expect, it } from 'vitest';
import { RECOGNITION_MAX_TOKENS, type VisionModel } from '@velum/core';
import { watchPlugin } from './index.ts';

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

describe('watchPlugin.recognize — scan éclair', () => {
  it('demande fourchette et classement avec un budget réduit', async () => {
    const vision = new FakeVision(['{"candidates":[]}']);
    await watchPlugin.recognize(
      { kind: 'photo', media: [{ role: 'dial', storagePath: 'u/d.jpg', base64: 'AAA=' }] },
      { vision },
    );
    expect(vision.requests[0]?.maxTokens).toBe(RECOGNITION_MAX_TOKENS);
    expect(vision.requests[0]?.prompt).toContain('"estimate"');
    expect(vision.requests[0]?.prompt).toContain('montre authentique');
  });

  it('conserve fourchette et classement d’un candidat fiable', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'Omega Speedmaster Professional 3570.50',
            confidence: 0.78,
            attributes: { brand: 'Omega', model: 'Speedmaster Professional', reference: '3570.50' },
            estimate: { low: 4200, high: 5600 },
            classification: ['Omega', 'Speedmaster', 'années 1990'],
          },
          { label: 'Hommage', confidence: 1.4, attributes: {}, estimate: { low: 50, high: 90 } },
        ],
      }),
    ]);
    const result = await watchPlugin.recognize({ kind: 'text', text: 'Speedmaster' }, { vision });
    const best = result.candidates[0];
    expect(best?.quickEstimate).toEqual({ low: 4200, high: 5600, currency: 'EUR' });
    expect(best?.classification).toEqual(['Omega', 'Speedmaster', 'années 1990']);
    // Confiance hors bornes → 0 → aucune fourchette.
    expect(result.candidates[1]?.confidence).toBe(0);
    expect(result.candidates[1]?.quickEstimate).toBeUndefined();
  });
});
