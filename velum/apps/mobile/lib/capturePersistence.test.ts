import { describe, expect, it, vi } from 'vitest';
import { isVelumError, type Candidate, type VelumItem } from '@velum/core';
import type { NewItemMedia } from '@velum/api-client';

import {
  correctCandidate,
  createSerialQueue,
  fullCaptureAttributes,
  insertCapturedItem,
  newItemFromCandidate,
  quickCaptureAttributes,
  runInBackground,
} from './capturePersistence';
import { analysisStatusOf, hasFullAnalysis } from './analysisState';

const item: VelumItem = {
  id: 'item-1',
  ownerId: 'user-1',
  domain: 'wine',
  title: 'Château Test 2019',
  attributes: {},
  confidence: 0.8,
  acquiredAt: null,
  acquiredPrice: null,
  condition: null,
  notes: null,
  storageLocation: null,
  createdAt: '2026-07-14T12:00:00Z',
  updatedAt: '2026-07-14T12:00:00Z',
};

const input = {
  ownerId: 'user-1',
  domain: 'wine' as const,
  title: 'Château Test 2019',
};

describe('insertCapturedItem', () => {
  it('crée un objet texte sans appeler item_media', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => []);

    await expect(
      insertCapturedItem(input, [], {
        items: { insert, remove },
        itemMedia: { addMany },
      }),
    ).resolves.toBe(item);

    expect(insert).toHaveBeenCalledOnce();
    expect(addMany).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('rattache les chemins non vides et déduplique chaque rôle', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => []);

    await insertCapturedItem(
      input,
      [
        { role: 'label', storagePath: ' user-1/ancienne.jpg ' },
        { role: 'capsule' },
        { role: 'label', storagePath: 'user-1/label.jpg' },
      ],
      { items: { insert, remove }, itemMedia: { addMany } },
    );

    expect(addMany).toHaveBeenCalledWith([
      { itemId: 'item-1', kind: 'label', storagePath: 'user-1/label.jpg' },
    ]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('supprime l’objet incomplet si le rattachement échoue', async () => {
    const attachmentError = new Error('item_media indisponible');
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => undefined);
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => {
      throw attachmentError;
    });

    await expect(
      insertCapturedItem(
        input,
        [{ role: 'label', storagePath: 'user-1/label.jpg' }],
        { items: { insert, remove }, itemMedia: { addMany } },
      ),
    ).rejects.toBe(attachmentError);

    expect(remove).toHaveBeenCalledWith('item-1');
  });

  it('rend visible un échec du rollback avec l’identifiant de l’objet', async () => {
    const insert = vi.fn(async () => item);
    const remove = vi.fn(async () => {
      throw new Error('suppression refusée');
    });
    const addMany = vi.fn(async (_rows: NewItemMedia[]) => {
      throw new Error('rattachement refusé');
    });

    await expect(
      insertCapturedItem(
        input,
        [{ role: 'label', storagePath: 'user-1/label.jpg' }],
        { items: { insert, remove }, itemMedia: { addMany } },
      ),
    ).rejects.toSatisfy(
      (cause: unknown) =>
        isVelumError(cause) &&
        cause.code === 'SOURCE_UNAVAILABLE' &&
        cause.details?.['itemId'] === 'item-1',
    );
  });
});

const stampCandidate: Candidate = {
  id: 'stamp-1',
  domain: 'stamp',
  label: 'Cérès 20c noir',
  confidence: 0.82,
  attributes: {
    country: 'France',
    catalogNumber: 'YT 3',
    year: 1849,
    faceValue: 20,
    // Clés réservées qu'un modèle ou un fichier ne doit pas pouvoir forger :
    analysis: { faux: true },
    analysisStatus: 'complete',
  },
  quickEstimate: { low: 40, high: 90, currency: 'EUR' },
  classification: ['France', 'Cérès', '1849–1850'],
};

describe('attributs selon le mode d’enregistrement', () => {
  it('scan éclair : identité + fourchette + classement, fiche complète « à charger »', () => {
    const attributes = quickCaptureAttributes(stampCandidate);
    expect(attributes).toEqual({
      country: 'France',
      catalogNumber: 'YT 3',
      year: 1849,
      faceValue: 20,
      quickEstimate: { low: 40, high: 90, currency: 'EUR' },
      classification: ['France', 'Cérès', '1849–1850'],
      analysisStatus: 'pending',
    });
    expect(hasFullAnalysis({ attributes })).toBe(false);
    expect(analysisStatusOf({ attributes })).toBe('pending');
    // Copies défensives : l'objet ne partage pas les tableaux du candidat.
    expect(attributes['classification']).not.toBe(stampCandidate.classification);
  });

  it('scan éclair sans fourchette ni classement : aucune clé vide', () => {
    const attributes = quickCaptureAttributes({ ...stampCandidate, quickEstimate: undefined, classification: [] });
    expect('quickEstimate' in attributes).toBe(false);
    expect('classification' in attributes).toBe(false);
  });

  it('fiche complète : payload, moteur, avertissements et horodatage', () => {
    const attributes = fullCaptureAttributes(
      stampCandidate,
      { engine: 'phila_v1', payload: { rarity: { level: 'rare' } }, disclaimers: ['Estimation indicative.'] },
      new Date('2026-10-23T08:00:00Z'),
    );
    expect(attributes).toMatchObject({
      analysis: { rarity: { level: 'rare' } },
      analysisEngine: 'phila_v1',
      disclaimers: ['Estimation indicative.'],
      analyzedAt: '2026-10-23T08:00:00.000Z',
      quickEstimate: { low: 40, high: 90, currency: 'EUR' },
    });
    expect('analysisStatus' in attributes).toBe(false);
    expect(analysisStatusOf({ attributes })).toBe('complete');
  });

  it('newItemFromCandidate reprend libellé et confiance', () => {
    expect(newItemFromCandidate('user-1', 'stamp', stampCandidate, { a: 1 })).toEqual({
      ownerId: 'user-1',
      domain: 'stamp',
      title: 'Cérès 20c noir',
      confidence: 0.82,
      attributes: { a: 1 },
    });
  });
});

describe('correctCandidate — correction avant enregistrement', () => {
  const now = new Date('2026-10-23T09:00:00Z');

  it('trace les corrections, garde les champs non affichés et retire la fourchette périmée', () => {
    const { candidate, changed } = correctCandidate({
      candidate: stampCandidate,
      domain: 'stamp',
      // Formulaire partiel : seuls les champs principaux sont envoyés.
      values: { country: 'France', catalogNumber: 'YT 4', year: '1849' },
      label: 'Cérès 40c orange',
      now,
    });
    expect(changed).toBe(true);
    expect(candidate.label).toBe('Cérès 40c orange');
    expect(candidate.attributes['catalogNumber']).toBe('YT 4');
    // Champ non affiché conservé tel quel (nombre lu, pas de fausse correction).
    expect(candidate.attributes['faceValue']).toBe(20);
    expect(candidate.attributes['corrections']).toEqual([
      { field: 'catalogNumber', from: 'YT 3', to: 'YT 4', at: '2026-10-23T09:00:00.000Z' },
      { field: 'title', from: 'Cérès 20c noir', to: 'Cérès 40c orange', at: '2026-10-23T09:00:00.000Z' },
    ]);
    expect(candidate.quickEstimate).toBeUndefined();
    expect(candidate.classification).toEqual(['France', 'Cérès', '1849–1850']);
    expect(candidate.confidence).toBe(0.82);
  });

  it('libellé seul corrigé : la fourchette reste valable', () => {
    const { candidate } = correctCandidate({
      candidate: stampCandidate,
      domain: 'stamp',
      values: {},
      label: 'Cérès 20 c. noir sur blanc',
      now,
    });
    expect(candidate.quickEstimate).toEqual(stampCandidate.quickEstimate);
  });

  it('aucune modification → candidat inchangé', () => {
    const result = correctCandidate({ candidate: stampCandidate, domain: 'stamp', values: { year: '1849' }, label: '', now });
    expect(result.changed).toBe(false);
    expect(result.candidate).toBe(stampCandidate);
  });

  it('vider un champ le retire et le trace', () => {
    const { candidate } = correctCandidate({
      candidate: stampCandidate,
      domain: 'stamp',
      values: { year: '' },
      label: '',
      now,
    });
    expect('year' in candidate.attributes).toBe(false);
    expect(candidate.attributes['corrections']).toEqual([
      { field: 'year', from: 1849, to: null, at: '2026-10-23T09:00:00.000Z' },
    ]);
  });
});

describe('tâches d’arrière-plan', () => {
  it('runInBackground ne rejette jamais et signale l’échec', async () => {
    const onError = vi.fn();
    await expect(runInBackground(async () => 'ok', onError)).resolves.toBe('ok');
    const failure = new Error('valorisation indisponible');
    await expect(
      runInBackground(async () => {
        throw failure;
      }, onError),
    ).resolves.toBe('failed');
    expect(onError).toHaveBeenCalledWith(failure);
    // Même un rapporteur défaillant n'interrompt rien.
    await expect(
      runInBackground(
        async () => {
          throw failure;
        },
        () => {
          throw new Error('toast cassé');
        },
      ),
    ).resolves.toBe('failed');
  });

  it('createSerialQueue exécute une tâche à la fois, dans l’ordre, malgré les échecs', async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const onError = vi.fn();
    const queue = createSerialQueue(onError);
    const task = (name: string, fail = false) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      order.push(name);
      active -= 1;
      if (fail) throw new Error(name);
    };
    const results = await Promise.all([
      queue.push(task('a')),
      queue.push(task('b', true)),
      queue.push(task('c')),
    ]);
    expect(results).toEqual(['ok', 'failed', 'ok']);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxActive).toBe(1);
    expect(onError).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(queue.pending()).toBe(0);
  });
});
