/**
 * Liste d'envies — implémentation DÉMO en mémoire du contrat WishlistRepo.
 */
import type { WishlistRepo } from '@velum/api-client';
import { VelumError, type WishlistEntry } from '@velum/core';

import { DEMO_OWNER, nowIso } from './demoData';

function seedWishlist(): WishlistEntry[] {
  const base = {
    ownerId: DEMO_OWNER,
    notes: null,
    attributes: {},
    sourceItemId: null,
    targetPrice: null,
    acquired: false,
    acquiredAt: null,
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
  };
  return [
    {
      ...base,
      id: 'demo-wish-1',
      domain: 'wine',
      kind: 'wish',
      title: 'Domaine Tempier Bandol La Tourtine 2019',
      notes: 'Goûté chez des amis — superbe sur un gigot.',
      attributes: { producer: 'Domaine Tempier', appellation: 'Bandol', vintage: 2019 },
      source: 'tasting',
      targetPrice: 60,
      priority: 'high',
    },
    {
      ...base,
      id: 'demo-wish-2',
      domain: 'coin',
      kind: 'idea',
      title: '10 Francs Coq or — compléter la série',
      source: 'manual',
      priority: 'medium',
    },
  ];
}

export function createDemoWishlistRepo(): WishlistRepo {
  const entries: WishlistEntry[] = seedWishlist();

  const find = (id: string): WishlistEntry => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new VelumError('INVALID_INPUT', 'Envie introuvable (démo)');
    return entry;
  };

  return {
    async list(domain) {
      return entries
        .filter((e) => domain === undefined || e.domain === domain)
        .sort((a, b) =>
          a.acquired === b.acquired
            ? b.createdAt.localeCompare(a.createdAt)
            : a.acquired
              ? 1
              : -1,
        );
    },

    async add(input) {
      const entry: WishlistEntry = {
        id: `wish-${Math.random().toString(36).slice(2, 10)}`,
        ownerId: DEMO_OWNER,
        domain: input.domain,
        kind: input.kind ?? 'wish',
        title: input.title,
        notes: input.notes ?? null,
        attributes: input.attributes ?? {},
        source: input.source ?? 'manual',
        sourceItemId: input.sourceItemId ?? null,
        targetPrice: input.targetPrice ?? null,
        priority: input.priority ?? 'medium',
        acquired: false,
        acquiredAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      entries.unshift(entry);
      return entry;
    },

    async update(id, patch) {
      const entry = find(id);
      Object.assign(entry, patch, { updatedAt: nowIso() });
      if (patch.acquired !== undefined) {
        entry.acquiredAt = patch.acquired ? nowIso() : null;
      }
      return entry;
    },

    async remove(id) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx >= 0) entries.splice(idx, 1);
    },
  };
}
