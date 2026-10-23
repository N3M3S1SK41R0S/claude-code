import { describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';

import { communitySearchText, segmentCounts, statsByDomain } from '../wishlist';
import { DEMO_OWNER } from './demoData';
import { createDemoWishlistRepo, seedWishlist } from './demoWishlist';

/** Horloge démo figée qui avance d'une minute à chaque lecture. */
function steppingClock(start = '2026-10-23T08:00:00.000Z'): () => Date {
  let t = Date.parse(start);
  return () => {
    const d = new Date(t);
    t += 60_000;
    return d;
  };
}

function repo() {
  let n = 0;
  return createDemoWishlistRepo({ now: steppingClock(), nextId: () => `wish-test-${++n}`, latencyMs: 0 });
}

async function expectInvalid(promise: Promise<unknown>): Promise<void> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(isVelumError(caught) && caught.code === 'INVALID_INPUT').toBe(true);
}

describe('jeu démo de la liste d’envies', () => {
  const seed = seedWishlist();

  it('couvre les 5 catégories et les 3 segments, avec des identifiants uniques', () => {
    expect(new Set(seed.map((e) => e.domain))).toEqual(new Set(['wine', 'coin', 'stamp', 'art', 'watch']));
    expect(segmentCounts(seed, null)).toEqual({ wish: 5, idea: 3, acquired: 2 });
    expect(new Set(seed.map((e) => e.id)).size).toBe(seed.length);
    expect(seed.every((e) => e.ownerId === DEMO_OWNER)).toBe(true);
  });

  it('est cohérent : obtenue ⇔ date d’obtention, titres valides, prix positifs', () => {
    for (const e of seed) {
      expect(e.acquired).toBe(e.acquiredAt !== null);
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.targetPrice === null || e.targetPrice >= 0).toBe(true);
    }
  });

  it('propose plusieurs origines, dont dégustation, scan, communauté', () => {
    const sources = new Set(seed.map((e) => e.source));
    for (const s of ['manual', 'tasting', 'scan', 'market'] as const) expect(sources.has(s)).toBe(true);
  });

  it('contient des envies présentes dans le catalogue démo de la communauté', () => {
    const coin = seed.find((e) => e.id === 'demo-wish-6');
    expect(coin && communitySearchText(coin)).toBe('Napoléon III 20 Francs Or');
  });

  it('a des statistiques par catégorie (vin : 2 envies, 1 idée, 1 obtenue)', () => {
    const wine = statsByDomain(seed, ['wine']).find((s) => s.domain === 'wine');
    expect(wine?.stats).toMatchObject({ wishes: 2, ideas: 1, acquired: 1, targetBudget: 105 });
  });
});

describe('dépôt démo de la liste d’envies', () => {
  it('list : en cours d’abord puis plus récentes, filtrable par catégorie', async () => {
    const entries = await repo().list();
    const firstAcquired = entries.findIndex((e) => e.acquired);
    expect(firstAcquired).toBeGreaterThan(0);
    expect(entries.slice(firstAcquired).every((e) => e.acquired)).toBe(true);
    const wine = await repo().list('wine');
    expect(wine.map((e) => e.id)).toEqual(['demo-wish-3', 'demo-wish-1', 'demo-wish-4', 'demo-wish-5']);
  });

  it('list renvoie des copies : muter le résultat ne touche pas le dépôt', async () => {
    const r = repo();
    const [first] = await r.list('stamp');
    if (!first) throw new Error('entrée attendue');
    first.title = 'muté';
    first.attributes['country'] = 'muté';
    const [again] = await r.list('stamp');
    expect(again?.title).toBe('Cérès 20c noir 1849');
    expect(again?.attributes['country']).toBe('France');
  });

  it('add normalise, applique les défauts et date avec l’horloge injectée', async () => {
    const r = repo();
    const created = await r.add({ domain: 'art', title: '  Gravure de Buffet ', notes: '  ', targetPrice: 120.456 });
    expect(created).toMatchObject({
      id: 'wish-test-1',
      ownerId: DEMO_OWNER,
      kind: 'wish',
      title: 'Gravure de Buffet',
      notes: null,
      targetPrice: 120.46,
      priority: 'medium',
      source: 'manual',
      acquired: false,
      acquiredAt: null,
      createdAt: '2026-10-23T08:00:00.000Z',
    });
    expect((await r.list('art'))[0]?.id).toBe('wish-test-1');
  });

  it('add refuse comme le serveur : titre vide, prix négatif', async () => {
    const r = repo();
    await expectInvalid(r.add({ domain: 'wine', title: '   ' }));
    await expectInvalid(r.add({ domain: 'wine', title: 'X', targetPrice: -3 }));
    expect(await r.list('wine')).toHaveLength(4);
  });

  it('update : acquiredAt posé puis effacé seulement quand `acquired` change', async () => {
    const r = repo();
    const acquired = await r.update('demo-wish-1', { acquired: true });
    expect(acquired.acquired).toBe(true);
    expect(acquired.acquiredAt).toBe('2026-10-23T08:00:00.000Z');

    const edited = await r.update('demo-wish-1', { notes: 'Achetée chez le caviste' });
    expect(edited.acquiredAt).toBe('2026-10-23T08:00:00.000Z');
    expect(edited.updatedAt).toBe('2026-10-23T08:01:00.000Z');

    const reopened = await r.update('demo-wish-1', { acquired: false });
    expect(reopened.acquiredAt).toBeNull();
  });

  it('update : patch vide sans effet, entrée inconnue ou titre vide refusés', async () => {
    const r = repo();
    const same = await r.update('demo-wish-2', {});
    expect(same.updatedAt).toBe('2026-07-10T00:00:00Z');
    await expectInvalid(r.update('inconnue', { title: 'X' }));
    await expectInvalid(r.update('demo-wish-2', { title: ' ' }));
  });

  it('remove supprime l’entrée (idempotent)', async () => {
    const r = repo();
    await r.remove('demo-wish-9');
    await r.remove('demo-wish-9');
    expect((await r.list()).some((e) => e.id === 'demo-wish-9')).toBe(false);
  });

  it('deux dépôts démo sont indépendants', async () => {
    const a = repo();
    const b = repo();
    await a.remove('demo-wish-10');
    expect((await b.list('watch')).map((e) => e.id)).toEqual(['demo-wish-10']);
  });
});
