/** Scan éclair du plugin vin : fourchette indicative, classement, sortie compacte. */
import { describe, expect, it } from 'vitest';
import { RECOGNITION_MAX_TOKENS, type VisionModel } from '@velum/core';
import { WINE_RECOGNITION_SYSTEM_PROMPT, winePlugin } from './index.ts';

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

describe('winePlugin.recognize — scan éclair', () => {
  it('demande fourchette par bouteille et classement, avec un budget réduit', async () => {
    const vision = new FakeVision(['{"candidates":[]}']);
    await winePlugin.recognize({ kind: 'text', text: 'Pauillac 2016' }, { vision });
    expect(vision.requests[0]?.maxTokens).toBe(RECOGNITION_MAX_TOKENS);
    expect(WINE_RECOGNITION_SYSTEM_PROMPT).toContain('"estimate"');
    expect(WINE_RECOGNITION_SYSTEM_PROMPT).toContain('Vin › région › appellation');
    expect(WINE_RECOGNITION_SYSTEM_PROMPT).toContain('JSON minifié');
  });

  it('conserve fourchette et classement, retire les attributs vides', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'Château Pichon Baron 2016',
            confidence: 0.84,
            attributes: { producer: 'Château Pichon Baron', vintage: '2016', cuvee: '', farming: null },
            estimate: { low: 110, high: 160 },
            classification: ['Vin', 'Bordeaux', 'Pauillac'],
          },
        ],
      }),
    ]);
    const best = (await winePlugin.recognize({ kind: 'text', text: 'Pichon Baron 2016' }, { vision }))
      .candidates[0];
    expect(best?.attributes).toEqual({ producer: 'Château Pichon Baron', vintage: 2016 });
    expect(best?.quickEstimate).toEqual({ low: 110, high: 160, currency: 'EUR' });
    expect(best?.classification).toEqual(['Vin', 'Bordeaux', 'Pauillac']);
  });

  it('pas de prix pour une identification incertaine ni pour une valeur aberrante', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          { label: 'Vin rouge (illisible)', confidence: 0.2, attributes: {}, estimate: { low: 5, high: 10 } },
          { label: 'Romanée-Conti 1945', confidence: 0.6, attributes: {}, estimate: { low: 4e6, high: 9e6 } },
        ],
      }),
    ]);
    const result = await winePlugin.recognize({ kind: 'text', text: 'vieux bourgogne' }, { vision });
    expect(result.candidates.map((c) => c.quickEstimate)).toEqual([undefined, undefined]);
  });
});
