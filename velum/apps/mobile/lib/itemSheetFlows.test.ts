import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueuedMutation } from '@velum/api-client';
import { VelumError, type AnalysisResult, type VelumItem } from '@velum/core';

import { hasFullAnalysis } from './analysisState';
import { createDemoClient } from './demo/demoClient';
import {
  fullSheetState,
  hasCorrections,
  isValuationOutdated,
  quickEstimateOf,
} from './itemSheet';
import {
  generateFullSheet,
  persistItemPatch,
  revalueItem,
  saveIdentityCorrection,
  type ItemSheetFlowDeps,
} from './itemSheetFlows';

const T0 = new Date('2026-10-23T08:00:00.000Z');

function item(attributes: Record<string, unknown>, overrides: Partial<VelumItem> = {}): VelumItem {
  return {
    id: 'i1',
    ownerId: 'o',
    domain: 'stamp',
    title: 'Cérès 1850',
    attributes,
    confidence: 0.6,
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

/** Client minimal : update / analyze / valuate / enqueue scriptés. */
function fakeDeps(options: {
  update?: (id: string, patch: Partial<VelumItem>) => Promise<VelumItem>;
  analyze?: () => Promise<AnalysisResult>;
}) {
  const queued: QueuedMutation[] = [];
  const updates: { id: string; patch: Partial<VelumItem> }[] = [];
  const analyzeCalls: unknown[] = [];
  const valuateCalls: unknown[] = [];
  const client = {
    items: {
      update: async (id: string, patch: Partial<VelumItem>) => {
        updates.push({ id, patch });
        if (options.update) return options.update(id, patch);
        return { ...item({}), ...patch } as VelumItem;
      },
    },
    edge: {
      analyze: async (...args: unknown[]) => {
        analyzeCalls.push(args);
        if (options.analyze) return options.analyze();
        return { engine: 'phila_v1', payload: { rarity: { level: 'rare' } }, confidence: 0.8, sources: [], disclaimers: ['Indicatif'] };
      },
      valuate: async (...args: unknown[]) => {
        valuateCalls.push(args);
        return { central: 100, ci80: [80, 120], ci95: [60, 140], nSources: 3, reliability: 60, currency: 'EUR', observations: [] };
      },
    },
    queue: {
      enqueue: async (mutation: QueuedMutation) => {
        queued.push(mutation);
      },
    },
  };
  let clock = T0.getTime();
  const deps = {
    client: client as unknown as ItemSheetFlowDeps['client'],
    now: () => new Date((clock += 1000)),
    mutationId: () => `mut-${queued.length + 1}`,
  } satisfies ItemSheetFlowDeps;
  return { deps, queued, updates, analyzeCalls, valuateCalls };
}

describe('persistItemPatch', () => {
  it('enregistre en ligne', async () => {
    const { deps, updates, queued } = fakeDeps({});
    const out = await persistItemPatch(deps, item({}), { title: 'Cérès 1849' });
    expect(out.queued).toBe(false);
    expect(updates).toEqual([{ id: 'i1', patch: { title: 'Cérès 1849', updatedAt: '2026-10-23T08:00:01.000Z' } }]);
    expect(queued).toEqual([]);
  });

  it('met en file hors-ligne et renvoie l’objet localement à jour', async () => {
    const { deps, queued } = fakeDeps({ update: () => Promise.reject(new Error('réseau')) });
    const out = await persistItemPatch(deps, item({ year: 1850 }), { attributes: { year: 1849 } });
    expect(out.queued).toBe(true);
    expect(out.item.attributes).toEqual({ year: 1849 });
    expect(out.item.updatedAt).toBe('2026-10-23T08:00:01.000Z');
    expect(queued).toEqual([
      {
        id: 'mut-1',
        table: 'items',
        type: 'update',
        payload: { id: 'i1', attributes: { year: 1849 }, updatedAt: '2026-10-23T08:00:01.000Z' },
        queuedAt: '2026-10-23T08:00:01.000Z',
      },
    ]);
  });
});

describe('saveIdentityCorrection', () => {
  it('n’enregistre rien sans modification réelle', async () => {
    const { deps, updates } = fakeDeps({});
    const base = item({ year: '1850' });
    const out = await saveIdentityCorrection(deps, base, { title: 'Cérès 1850', values: { year: '1850' } });
    expect(out).toEqual({ changed: false, identityChanged: false, queued: false, item: base });
    expect(updates).toEqual([]);
  });

  it('enregistre la désignation et les attributs corrigés', async () => {
    const { deps, updates } = fakeDeps({});
    const out = await saveIdentityCorrection(deps, item({ year: 1850 }), {
      title: 'Cérès 1849',
      values: { year: '1849' },
    });
    expect(out.changed).toBe(true);
    expect(out.identityChanged).toBe(true);
    const patch = updates[0]?.patch;
    expect(patch?.title).toBe('Cérès 1849');
    expect(patch?.attributes?.['year']).toBe(1849);
    expect(hasCorrections(patch?.attributes ?? {})).toBe(true);
  });
});

describe('generateFullSheet', () => {
  it('fusionne dans la version la plus récente, horodatée à la demande', async () => {
    let current = item({ country: 'France', analysisStatus: 'pending' });
    const { deps, updates, analyzeCalls } = fakeDeps({
      analyze: async () => {
        // Une correction arrive PENDANT la génération.
        current = item({
          country: 'France',
          year: 1849,
          analysisStatus: 'pending',
          corrections: [{ field: 'year', from: null, to: 1849, at: '2026-10-23T08:00:01.500Z' }],
        });
        return { engine: 'phila_v1', payload: { a: 1 }, confidence: 0.8, sources: [], disclaimers: ['Indicatif'] };
      },
    });
    await generateFullSheet(deps, () => current);
    expect(analyzeCalls[0]).toEqual([
      'stamp',
      { id: 'i1', domain: 'stamp', label: 'Cérès 1850', confidence: 0.6, attributes: { country: 'France' } },
    ]);
    const attributes = updates[0]?.patch.attributes ?? {};
    expect(attributes['year']).toBe(1849);
    expect(attributes['analyzedAt']).toBe('2026-10-23T08:00:01.000Z');
    expect(attributes).not.toHaveProperty('analysisStatus');
    // La fiche décrit l'identité d'AVANT la correction : elle est périmée.
    expect(fullSheetState({ attributes })).toBe('outdated');
  });

  it('refuse un payload inexploitable sans rien enregistrer', async () => {
    const { deps, updates } = fakeDeps({
      analyze: async () =>
        ({ engine: 'x', payload: 'texte', confidence: 0.5, sources: [], disclaimers: [] }) as unknown as AnalysisResult,
    });
    const error = await generateFullSheet(deps, () => item({})).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VelumError);
    expect((error as VelumError).code).toBe('ANALYSIS_FAILED');
    expect(updates).toEqual([]);
  });

  it('propage l’échec de la génération (Réessayer côté écran)', async () => {
    const { deps, updates } = fakeDeps({
      analyze: () => Promise.reject(new VelumError('SOURCE_UNAVAILABLE', 'panne')),
    });
    await expect(generateFullSheet(deps, () => item({}))).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    expect(updates).toEqual([]);
  });
});

describe('revalueItem', () => {
  it('estime l’identité courante et persiste côté serveur', async () => {
    const { deps, valuateCalls } = fakeDeps({});
    await revalueItem(deps, item({ year: 1849, analysis: { a: 1 } }));
    expect(valuateCalls[0]).toEqual([
      'stamp',
      { id: 'i1', domain: 'stamp', label: 'Cérès 1850', confidence: 0.6, attributes: { year: 1849 } },
      'i1',
    ]);
  });
});

describe('parcours complet en mode démo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Le client démo simule la latence réseau (setTimeout) : on avance l'horloge. */
  async function settle<T>(promise: Promise<T>): Promise<T> {
    await vi.advanceTimersByTimeAsync(1000);
    return promise;
  }

  it('objet sans fiche → charger ; corriger → relancer l’estimation et régénérer', async () => {
    const client = createDemoClient();
    const deps: ItemSheetFlowDeps = { client, now: () => new Date(), mutationId: () => 'mut-demo' };

    // Objet enregistré par le scan éclair : fiche à charger, fourchette indicative.
    const created = await client.items.insert({
      ownerId: 'demo-user',
      domain: 'stamp',
      title: 'Cérès 20 c noir 1850',
      confidence: 0.55,
      attributes: {
        country: 'France',
        year: 1850,
        analysisStatus: 'pending',
        quickEstimate: { low: 300, high: 900, currency: 'EUR' },
      },
    });
    const latest = async () => (await client.items.get(created.id)) as VelumItem;
    expect(fullSheetState(await latest())).toBe('missing');
    expect(quickEstimateOf((await latest()).attributes)).toEqual({ low: 300, high: 900 });

    // 1. Charger la fiche complète.
    const snapshot = await latest();
    const loaded = await settle(generateFullSheet(deps, () => snapshot));
    expect(loaded.queued).toBe(false);
    expect(hasFullAnalysis(await latest())).toBe(true);
    expect(fullSheetState(await latest())).toBe('complete');

    // 2. Estimer (aucune estimation au départ).
    expect(await client.valuations.latest(created.id)).toBeNull();
    await settle(revalueItem(deps, await latest()));
    const first = await client.valuations.latest(created.id);
    expect(first).not.toBeNull();

    // 3. Corriger l'année mal lue (une minute plus tard).
    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    const corrected = await saveIdentityCorrection(deps, await latest(), {
      title: 'Cérès 20 c noir 1849',
      values: { country: 'France', year: '1849' },
    });
    expect(corrected.changed).toBe(true);
    const afterCorrection = await latest();
    expect(afterCorrection.title).toBe('Cérès 20 c noir 1849');
    expect(afterCorrection.attributes['year']).toBe(1849);
    expect(quickEstimateOf(afterCorrection.attributes)).toBeNull();
    expect(fullSheetState(afterCorrection)).toBe('outdated');
    expect(isValuationOutdated(afterCorrection, first)).toBe(true);

    // 4. Relancer l'estimation : elle porte sur l'identité corrigée.
    vi.setSystemTime(new Date(T0.getTime() + 120_000));
    await settle(revalueItem(deps, afterCorrection));
    const second = await client.valuations.latest(created.id);
    expect(second?.sources[0]?.matchedLabel).toBe('Cérès 20 c noir 1849');
    expect(isValuationOutdated(await latest(), second)).toBe(false);

    // 5. Régénérer la fiche complète.
    const current = await latest();
    await settle(generateFullSheet(deps, () => current));
    expect(fullSheetState(await latest())).toBe('complete');
    expect(hasCorrections((await latest()).attributes)).toBe(true);
  });
});
