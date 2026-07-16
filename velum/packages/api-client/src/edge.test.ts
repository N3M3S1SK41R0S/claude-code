import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError, type Candidate, type CaptureInput } from '@velum/core';
import { createEdgeApi } from './edge';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

const candidate: Candidate = {
  id: 'cand-1',
  domain: 'coin',
  label: '5 Francs Semeuse 1960',
  confidence: 0.88,
  attributes: { year: 1960, mint: 'Paris' },
};

/** Erreur façon FunctionsHttpError : la Response est portée par `context`. */
function httpError(code: string, message: string): unknown {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: { json: async () => ({ error: { code, message } }) },
  };
}

describe('edge api', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
  });

  it('recognize invoque la fonction `recognize` avec { domain, input }', async () => {
    const input: CaptureInput = { kind: 'text', text: 'pièce argent Napoléon' };
    const result = {
      candidates: [candidate],
      stage: 'llm_vision',
      needsAssistedEntry: false,
    };
    fake.invokeResponses['recognize'] = { data: result };

    const api = createEdgeApi(asSupabase(fake));
    expect(await api.recognize('coin', input)).toEqual(result);
    expect(fake.invocations).toEqual([
      { fn: 'recognize', body: { domain: 'coin', input } },
    ]);
  });

  it('analyze route vers analyze-<domaine>', async () => {
    const analysis = {
      engine: 'numis_v1',
      payload: { grade: 'TTB' },
      confidence: 0.8,
      sources: [],
      disclaimers: ['Estimation indicative — ne vaut pas authentification.'],
    };
    fake.invokeResponses['analyze-coin'] = { data: analysis };

    const api = createEdgeApi(asSupabase(fake));
    expect(await api.analyze('coin', candidate)).toEqual(analysis);
    expect(fake.invocations[0]).toEqual({ fn: 'analyze-coin', body: { candidate } });
  });

  it('valuate passe itemId quand fourni, l’omet sinon', async () => {
    const valuation = {
      central: 12,
      ci80: [10, 14],
      ci95: [9, 16],
      nSources: 5,
      reliability: 61,
      currency: 'EUR',
      observations: [],
    };
    fake.invokeResponses['valuate'] = { data: valuation };

    const api = createEdgeApi(asSupabase(fake));
    expect(await api.valuate('coin', candidate, 'itm-1')).toEqual(valuation);
    expect(fake.invocations[0]).toEqual({
      fn: 'valuate',
      body: { domain: 'coin', candidate, itemId: 'itm-1' },
    });

    await api.valuate('coin', candidate);
    expect(fake.invocations[1]).toEqual({ fn: 'valuate', body: { domain: 'coin', candidate } });
  });

  it('arbitrate transmet l’identifiant et l’année uniquement quand fournie', async () => {
    const signal = {
      verdict: 'watch' as const,
      confidence: 0.2,
      trend: 'unknown' as const,
      sellWindow: false,
      reasons: ['Historique insuffisant — aucun signal.'],
    };
    fake.invokeResponses['arbiter'] = { data: signal };

    const api = createEdgeApi(asSupabase(fake));
    expect(await api.arbitrate('itm-1', 2026)).toEqual(signal);
    expect(fake.invocations[0]).toEqual({
      fn: 'arbiter',
      body: { itemId: 'itm-1', currentYear: 2026 },
    });

    await api.arbitrate('itm-2');
    expect(fake.invocations[1]).toEqual({ fn: 'arbiter', body: { itemId: 'itm-2' } });
  });

  it('mappe { error: { code, message } } vers VelumError (BUDGET_EXCEEDED)', async () => {
    fake.invokeResponses['recognize'] = {
      error: httpError('BUDGET_EXCEEDED', 'Quota mensuel de scans atteint'),
    };
    const api = createEdgeApi(asSupabase(fake));
    await expect(api.recognize('wine', { kind: 'text', text: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        isVelumError(e) && e.code === 'BUDGET_EXCEEDED' && e.message.includes('Quota'),
    );
  });

  it('mappe NO_OBSERVATIONS sur valuate', async () => {
    fake.invokeResponses['valuate'] = {
      error: httpError('NO_OBSERVATIONS', 'Aucune observation de prix disponible pour cet objet'),
    };
    const api = createEdgeApi(asSupabase(fake));
    await expect(api.valuate('art', { ...candidate, domain: 'art' })).rejects.toSatisfy(
      (e: unknown) => isVelumError(e) && e.code === 'NO_OBSERVATIONS',
    );
  });

  it('replie un code serveur inconnu sur SOURCE_UNAVAILABLE (code original en details)', async () => {
    fake.invokeResponses['recognize'] = { error: httpError('INTERNAL', 'Erreur interne du serveur') };
    const api = createEdgeApi(asSupabase(fake));
    await expect(api.recognize('wine', { kind: 'text', text: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        isVelumError(e) &&
        e.code === 'SOURCE_UNAVAILABLE' &&
        e.details?.['serverCode'] === 'INTERNAL',
    );
  });

  it('erreur réseau sans corps normalisé → SOURCE_UNAVAILABLE', async () => {
    fake.invokeResponses['recognize'] = { error: new Error('Failed to fetch') };
    const api = createEdgeApi(asSupabase(fake));
    await expect(api.recognize('wine', { kind: 'text', text: 'x' })).rejects.toSatisfy(
      (e: unknown) => isVelumError(e) && e.code === 'SOURCE_UNAVAILABLE',
    );
  });
});
