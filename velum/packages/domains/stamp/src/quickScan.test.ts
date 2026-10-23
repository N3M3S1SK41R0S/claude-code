/**
 * Scan éclair (fourchette indicative + classement) et mode classeur (planche
 * multi-timbres) du plugin philatélique — vision simulée, aucun réseau.
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
import { stampPlugin } from './plugin.ts';

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

const PHOTO = { kind: 'photo' as const, media: [{ role: 'front' as const, storagePath: 'u/a.jpg', base64: 'AAA=' }] };

describe('stampPlugin.recognize — scan éclair', () => {
  it('demande une sortie compacte avec fourchette et classement, budget réduit', async () => {
    const vision = new FakeVision(['{"candidates":[]}']);
    await stampPlugin.recognize(PHOTO, { vision });
    const req = vision.requests[0];
    expect(req?.maxTokens).toBe(RECOGNITION_MAX_TOKENS);
    expect(req?.prompt).toContain('"estimate"');
    expect(req?.prompt).toContain('"classification"');
    expect(req?.prompt).toContain('JSON minifié');
    expect(req?.system).toContain('YT 123');
    expect(req?.system).toContain('dentelure');
    expect(req?.system).toContain('filigrane');
    expect(req?.system).toContain('verso');
  });

  it('normalise référence, statut et année ; conserve fourchette et classement', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          {
            label: 'Cérès 20c noir',
            confidence: 0.82,
            attributes: { country: 'France', catalogNumber: 'yt 3', status: 'oblitéré', year: '1849', color: '' },
            estimate: { low: 90, high: 40 },
            classification: ['France', 'Cérès', '1849–1850'],
          },
        ],
      }),
    ]);
    const result = await stampPlugin.recognize(PHOTO, { vision });
    const best = result.candidates[0];
    expect(best?.attributes).toEqual({
      country: 'France',
      catalogNumber: 'YT 3',
      catalog: 'yvert_tellier',
      status: 'oblitere',
      year: 1849,
    });
    expect(best?.quickEstimate).toEqual({ low: 40, high: 90, currency: 'EUR' });
    expect(best?.classification).toEqual(['France', 'Cérès', '1849–1850']);
  });

  it('écarte une fourchette aberrante et toute fourchette d’un candidat incertain', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        candidates: [
          { label: 'Timbre rarissime', confidence: 0.6, attributes: {}, estimate: { low: 1e7, high: 9e9 } },
          { label: 'Peut-être Merson', confidence: 0.2, attributes: { status: 'zzz' }, estimate: { low: 5, high: 9 } },
        ],
      }),
    ]);
    const result = await stampPlugin.recognize(PHOTO, { vision });
    expect(result.candidates[0]?.quickEstimate).toBeUndefined();
    expect(result.candidates[1]?.quickEstimate).toBeUndefined();
    // Statut inconnu : retiré plutôt que deviné.
    expect(result.candidates[1]?.attributes['status']).toBeUndefined();
  });
});

function detection(position: string, label: string, confidence: number) {
  return {
    position,
    candidates: [{ label, confidence, attributes: { country: 'France' }, estimate: { low: 1, high: 3 } }],
  };
}

describe('stampPlugin.recognizeSheet — mode classeur', () => {
  it('identifie chaque timbre de la planche dans l’ordre de lecture', async () => {
    const vision = new FakeVision([
      JSON.stringify({
        detections: [
          detection('rangée 1, case 1', 'Semeuse 10c rouge', 0.8),
          { position: 'rangée 1, case 2', candidates: [] },
          {
            position: 'rangée 1, case 3',
            candidates: [
              { label: 'Marianne de Gandon 15f', confidence: 0.3, attributes: {} },
              { label: 'Marianne de Gandon 12f', confidence: 0.55, attributes: { catalogNumber: 'Yvert 812' } },
            ],
          },
        ],
        more: false,
      }),
    ]);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });

    expect(vision.requests[0]?.maxTokens).toBe(SHEET_RECOGNITION_MAX_TOKENS);
    expect(vision.requests[0]?.images).toHaveLength(1);
    expect(vision.requests[0]?.prompt).toContain('"detections"');
    expect(result.stage).toBe('llm_vision');
    expect(result.truncated).toBe(false);
    expect(result.detections.map((d) => d.index)).toEqual([0, 1, 2]);
    expect(result.detections[0]?.position).toBe('rangée 1, case 1');
    expect(result.detections[0]?.candidates[0]?.quickEstimate).toEqual({ low: 1, high: 3, currency: 'EUR' });
    expect(result.detections[0]?.needsAssistedEntry).toBe(false);
    // Case illisible : conservée, en saisie assistée.
    expect(result.detections[1]?.candidates).toEqual([]);
    expect(result.detections[1]?.needsAssistedEntry).toBe(true);
    // Candidats retriés et référence normalisée.
    expect(result.detections[2]?.candidates[0]?.label).toBe('Marianne de Gandon 12f');
    expect(result.detections[2]?.candidates[0]?.attributes['catalogNumber']).toBe('YT 812');
  });

  it(`borne à ${MAX_SHEET_DETECTIONS} détections et signale la troncature`, async () => {
    const many = Array.from({ length: 30 }, (_, i) => detection(`case ${i + 1}`, `Timbre ${i + 1}`, 0.7));
    const vision = new FakeVision([JSON.stringify({ detections: many })]);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(result.detections).toHaveLength(MAX_SHEET_DETECTIONS);
    expect(result.truncated).toBe(true);
  });

  it('« more » du modèle → truncated', async () => {
    const vision = new FakeVision([JSON.stringify({ detections: [detection('a', 'Timbre', 0.7)], more: true })]);
    expect((await stampPlugin.recognizeSheet(PHOTO, { vision })).truncated).toBe(true);
  });

  it('réponse coupée par le budget : garde les détections complètes', async () => {
    const full = JSON.stringify({
      detections: [detection('a', 'Timbre A', 0.7), detection('b', 'Timbre B', 0.6), detection('c', 'Timbre C', 0.6)],
    });
    const cut = full.slice(0, full.indexOf('Timbre C') + 4);
    const vision = new FakeVision([cut]);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(result.detections.map((d) => d.candidates[0]?.label)).toEqual(['Timbre A', 'Timbre B']);
    expect(result.truncated).toBe(true);
  });

  it('réponse illisible → aucune détection, sans fausse troncature', async () => {
    const vision = new FakeVision(['Je ne vois aucun timbre.']);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(result).toEqual({ detections: [], stage: 'llm_vision', truncated: false });
  });

  it('réponse coupée DANS le premier timbre → aucune détection mais troncature signalée', async () => {
    const vision = new FakeVision(['{"detections":[{"position":"r1","candidates":[{"label":"Cér']);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(result).toEqual({ detections: [], stage: 'llm_vision', truncated: true });
  });

  it('texte parasite avec accolades avant un JSON complet → pas de fausse troncature', async () => {
    const answer = JSON.stringify({ detections: [detection('a', 'Timbre A', 0.7)], more: false });
    const vision = new FakeVision([`Voici {le résultat} : ${answer}`]);
    const result = await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(result.detections.map((d) => d.candidates[0]?.label)).toEqual(['Timbre A']);
    expect(result.truncated).toBe(false);
  });

  it('demande UN seul candidat par timbre (sortie bornée pour 24 timbres)', async () => {
    const vision = new FakeVision(['{"detections":[]}']);
    await stampPlugin.recognizeSheet(PHOTO, { vision });
    expect(vision.requests[0]?.prompt).toContain('un seul candidat par timbre');
    expect(vision.requests[0]?.prompt).not.toContain('au plus 2 candidats');
  });

  it('exige une photo (pas de texte) et laisse remonter une panne de vision', async () => {
    const vision = new FakeVision([]);
    await expect(stampPlugin.recognizeSheet({ kind: 'text', text: 'classeur' }, { vision })).rejects.toSatisfy(
      (error: unknown) => isVelumError(error) && error.code === 'INVALID_INPUT',
    );
    expect(vision.requests).toHaveLength(0);
    await expect(stampPlugin.recognizeSheet(PHOTO, { vision })).rejects.toThrow('plus de réponse');
  });
});

describe('parseArrayWithSalvage', () => {
  it('lit un JSON complet (fences tolérées)', () => {
    const out = parseArrayWithSalvage('```json\n{"detections":[{"a":1}],"more":true}\n```', 'detections');
    expect(out).toEqual({ items: [{ a: 1 }], root: { detections: [{ a: 1 }], more: true }, complete: true, found: true });
  });

  it('récupère les éléments complets d’un JSON coupé, accolades dans les chaînes comprises', () => {
    const out = parseArrayWithSalvage('{"detections":[{"p":"case {1}"},{"p":"b\\"}"},{"p":"c', 'detections');
    expect(out.items).toEqual([{ p: 'case {1}' }, { p: 'b"}' }]);
    expect(out.complete).toBe(false);
    expect(out.root).toBeNull();
  });

  it('clé absente → aucun élément', () => {
    expect(parseArrayWithSalvage('{"autre":[', 'detections').items).toEqual([]);
    expect(parseArrayWithSalvage('{"autre":[', 'detections').found).toBe(false);
    expect(parseArrayWithSalvage('{"detections":[{"a":1}],"x":', 'detections').items).toEqual([{ a: 1 }]);
    expect(parseArrayWithSalvage('{"detections":[{"a":1}],"x":', 'detections').found).toBe(true);
  });

  it('ignore un préfixe parasite entre accolades devant le JSON racine', () => {
    const out = parseArrayWithSalvage('Voici {le résultat} : {"detections":[{"a":1}],"more":true}', 'detections');
    expect(out).toEqual({ items: [{ a: 1 }], root: { detections: [{ a: 1 }], more: true }, complete: true, found: true });
    // Préfixe JSON valide mais sans la clé : la vraie racine est celle qui porte la clé.
    const json = parseArrayWithSalvage('{"note":"x"} {"detections":[{"a":2}]}', 'detections');
    expect(json.items).toEqual([{ a: 2 }]);
    expect(json.complete).toBe(true);
  });
});
