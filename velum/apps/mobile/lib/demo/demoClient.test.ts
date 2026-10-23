import { describe, expect, it } from 'vitest';

import { createDemoClient } from './demoClient';

describe('client démo — câblage des dépôts', () => {
  it('plateformes : le seuil d’expertise lit les estimations VELUM de l’objet', async () => {
    const client = createDemoClient();
    const watch = await client.items.insert({ ownerId: 'demo-user', domain: 'watch', title: 'Omega Seamaster 300' });
    // Sans estimation : une annonce à 100 € est publiée.
    const before = await client.marketplace.createListing({ itemId: watch.id, askPrice: 100 });
    expect(before.status).toBe('active');
    await client.marketplace.withdrawListing(before.id);
    // Estimation VELUM (> 500 €) : la même annonce attend l'expertise, comme sur le serveur.
    const valuation = await client.edge.valuate(
      'watch',
      { id: 'c1', domain: 'watch', label: 'Omega Seamaster 300', confidence: 0.8, attributes: {} },
      watch.id,
    );
    expect(valuation.central).toBeGreaterThan(500);
    const after = await client.marketplace.createListing({ itemId: watch.id, askPrice: 100 });
    expect(after.status).toBe('pending_certification');
  });

  it('plateformes : synthèse des commissions disponible (aperçus au taux du serveur)', async () => {
    const client = createDemoClient();
    await expect(client.marketplace.commissionSummary?.()).resolves.toMatchObject({
      currency: 'EUR',
      currentRate: 0.05,
    });
  });

  it('envies : un objet supprimé détache l’envie qui en provient', async () => {
    const client = createDemoClient();
    const coin = await client.items.insert({ ownerId: 'demo-user', domain: 'coin', title: 'Écu Louis XV 1726' });
    const entry = await client.wishlist.add({
      domain: 'coin',
      kind: 'wish',
      title: 'Écu Louis XV 1726 (meilleur état)',
      source: 'item',
      sourceItemId: coin.id,
    });
    expect(entry.sourceItemId).toBe(coin.id);
    await client.items.remove(coin.id);
    const reread = (await client.wishlist.list()).find((e) => e.id === entry.id);
    expect(reread?.sourceItemId).toBeNull();
    // Comme le trigger serveur : une envie ne se rattache pas à un objet absent.
    await expect(
      client.wishlist.add({ domain: 'coin', title: 'Autre écu', source: 'item', sourceItemId: coin.id }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('file hors-ligne : bouchon conforme au rapport de rejeu (rejected: 0)', async () => {
    const client = createDemoClient();
    await expect(client.queue.replay()).resolves.toEqual({
      applied: 0,
      skipped: 0,
      failed: 0,
      rejected: 0,
      rejections: [],
    });
  });
});
