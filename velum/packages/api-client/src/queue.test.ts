import { beforeEach, describe, expect, it } from 'vitest';
import {
  MUTATION_QUEUE_STORAGE_KEY,
  MutationQueue,
  isDefinitiveRefusal,
  sameJsonValue,
  type QueuedMutation,
} from './queue';
import { createMemoryStorage, type StorageAdapter } from './storage';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

function mutation(overrides: Partial<QueuedMutation>): QueuedMutation {
  return {
    id: 'mut-1',
    table: 'items',
    type: 'insert',
    payload: {},
    queuedAt: '2026-07-10T08:00:00Z',
    ...overrides,
  };
}

describe('MutationQueue', () => {
  let fake: FakeSupabase;
  let storage: StorageAdapter;
  let queue: MutationQueue;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['items'] = [];
    storage = createMemoryStorage();
    queue = new MutationQueue(asSupabase(fake), storage);
  });

  it('enqueue persiste en JSON sous la clé velum.mutation-queue.v1', async () => {
    await queue.enqueue(mutation({ id: 'm1', payload: { id: 'i1', ownerId: 'u1', domain: 'wine' } }));
    expect(await queue.size()).toBe(1);

    const raw = await storage.getItem(MUTATION_QUEUE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  it('une nouvelle instance relit la file depuis le même stockage', async () => {
    await queue.enqueue(mutation({ id: 'm1' }));
    await queue.enqueue(mutation({ id: 'm2', type: 'delete', payload: { id: 'i1' } }));

    const revived = new MutationQueue(asSupabase(fake), storage);
    expect(await revived.size()).toBe(2);
  });

  it('replay applique les mutations dans l’ordre FIFO puis vide la file', async () => {
    await queue.enqueue(
      mutation({
        id: 'm1',
        type: 'insert',
        payload: { id: 'i1', ownerId: 'u1', domain: 'wine', title: 'Avant' },
      }),
    );
    await queue.enqueue(
      mutation({
        id: 'm2',
        type: 'update',
        // updatedAt volontairement dans le futur lointain : la mutation locale
        // doit toujours être « plus récente » que la ligne insérée à l'instant.
        payload: { id: 'i1', title: 'Après', updatedAt: '2999-01-01T00:00:00Z' },
      }),
    );

    const report = await queue.replay();
    expect(report).toEqual({ applied: 2, skipped: 0, failed: 0, rejected: 0, rejections: [] });
    expect(await queue.size()).toBe(0);
    expect(await storage.getItem(MUTATION_QUEUE_STORAGE_KEY)).toBeNull();

    const row = fake.row('items', 'i1');
    expect(row?.['title']).toBe('Après'); // l'update est bien passé APRÈS l'insert
    expect(row?.['owner_id']).toBe('u1'); // payload camelCase mappé en snake_case
  });

  it('conflit last-write-wins : update ignoré si le serveur est plus récent', async () => {
    fake.tables['items'] = [
      { id: 'i1', title: 'serveur', updated_at: '2026-07-10T12:00:00Z' },
    ];
    await queue.enqueue(
      mutation({
        id: 'm1',
        type: 'update',
        payload: { id: 'i1', title: 'client', updatedAt: '2026-07-01T00:00:00Z' },
      }),
    );

    const report = await queue.replay();
    expect(report).toEqual({ applied: 0, skipped: 1, failed: 0, rejected: 0, rejections: [] });
    expect(fake.row('items', 'i1')?.['title']).toBe('serveur'); // pas écrasé
    expect(await queue.size()).toBe(0); // la mutation perdante est retirée de la file
  });

  it('update appliqué quand la version locale est plus récente que le serveur', async () => {
    fake.tables['items'] = [
      { id: 'i1', title: 'serveur', updated_at: '2026-07-01T00:00:00Z' },
    ];
    await queue.enqueue(
      mutation({
        id: 'm1',
        type: 'update',
        payload: { id: 'i1', title: 'client', updatedAt: '2026-07-10T00:00:00Z' },
      }),
    );

    const report = await queue.replay();
    expect(report).toEqual({ applied: 1, skipped: 0, failed: 0, rejected: 0, rejections: [] });
    expect(fake.row('items', 'i1')?.['title']).toBe('client');
  });

  it('échec réseau : la mutation reste en file et est comptée failed', async () => {
    await queue.enqueue(mutation({ id: 'm1', payload: { id: 'i1', ownerId: 'u1', domain: 'art' } }));
    fake.offline = true;

    const report = await queue.replay();
    expect(report).toEqual({ applied: 0, skipped: 0, failed: 1, rejected: 0, rejections: [] });
    expect(await queue.size()).toBe(1); // toujours en file, sera retentée

    // Le réseau revient : le rejeu suivant applique la mutation.
    fake.offline = false;
    expect(await queue.replay()).toEqual({ applied: 1, skipped: 0, failed: 0, rejected: 0, rejections: [] });
    expect(fake.row('items', 'i1')?.['domain']).toBe('art');
  });

  it('échec réseau au milieu : les mutations suivantes restent aussi en file', async () => {
    await queue.enqueue(mutation({ id: 'm1', payload: { id: 'i1', ownerId: 'u1', domain: 'wine' } }));
    await queue.enqueue(mutation({ id: 'm2', payload: { id: 'i2', ownerId: 'u1', domain: 'coin' } }));
    fake.offline = true;

    const report = await queue.replay();
    expect(report.failed).toBe(1); // on s'arrête au premier échec (FIFO préservé)
    expect(await queue.size()).toBe(2);
  });

  it('delete retire la ligne côté serveur', async () => {
    fake.tables['items'] = [{ id: 'i1', title: 'à supprimer', updated_at: '2026-07-01T00:00:00Z' }];
    await queue.enqueue(mutation({ id: 'm1', type: 'delete', payload: { id: 'i1' } }));

    const report = await queue.replay();
    expect(report).toEqual({ applied: 1, skipped: 0, failed: 0, rejected: 0, rejections: [] });
    expect(fake.row('items', 'i1')).toBeUndefined();
  });

  it('update sur un objet supprimé côté serveur → skipped (delete gagne)', async () => {
    await queue.enqueue(
      mutation({
        id: 'm1',
        type: 'update',
        payload: { id: 'disparu', title: 'x', updatedAt: '2026-07-10T00:00:00Z' },
      }),
    );
    const report = await queue.replay();
    expect(report).toEqual({ applied: 0, skipped: 1, failed: 0, rejected: 0, rejections: [] });
    expect(await queue.size()).toBe(0);
  });

  it('clear vide la file', async () => {
    await queue.enqueue(mutation({ id: 'm1' }));
    await queue.enqueue(mutation({ id: 'm2' }));
    await queue.clear();
    expect(await queue.size()).toBe(0);
    expect(await storage.getItem(MUTATION_QUEUE_STORAGE_KEY)).toBeNull();
  });

  describe('refus définitif du serveur (la file n’est jamais bloquée)', () => {
    it('delete refusé par une règle métier (P0001) : retiré, signalé, la mutation suivante passe', async () => {
      fake.tables['items'] = [{ id: 'engage', title: 'Objet en vente', updated_at: '2026-07-01T00:00:00Z' }];
      refuseWrites(fake, (op) =>
        op === 'delete'
          ? { message: 'Objet engagé dans une vente ou un échange en cours', code: 'P0001' }
          : null,
      );
      await queue.enqueue(mutation({ id: 'm1', type: 'delete', payload: { id: 'engage' } }));
      await queue.enqueue(mutation({ id: 'm2', payload: { id: 'i2', ownerId: 'u1', domain: 'coin' } }));

      const report = await queue.replay();
      expect(report).toMatchObject({ applied: 1, skipped: 0, failed: 0, rejected: 1 });
      expect(report.rejections).toEqual([
        {
          mutationId: 'm1',
          type: 'delete',
          rowId: 'engage',
          code: 'P0001',
          message: 'Objet engagé dans une vente ou un échange en cours',
        },
      ]);
      expect(await queue.size()).toBe(0); // ni bloquée, ni rejouée plus tard
      expect(fake.row('items', 'engage')).toBeDefined(); // jamais supprimé en silence
      expect(fake.row('items', 'i2')?.['domain']).toBe('coin');
    });

    it('update refusé (date invalide, 22007) ou insert refusé (contrainte, 23514) : retirés', async () => {
      fake.tables['items'] = [{ id: 'i1', title: 'x', updated_at: '2026-07-01T00:00:00Z' }];
      refuseWrites(fake, (op) =>
        op === 'update'
          ? { message: 'invalid input syntax for type date: "juin 2020"', code: '22007' }
          : op === 'insert'
            ? { message: 'violates check constraint', code: '23514' }
            : null,
      );
      await queue.enqueue(
        mutation({
          id: 'm1',
          type: 'update',
          payload: { id: 'i1', acquiredAt: 'juin 2020', updatedAt: '2026-07-10T00:00:00Z' },
        }),
      );
      await queue.enqueue(mutation({ id: 'm2', payload: { id: 'i9', ownerId: 'u1', domain: 'wine' } }));

      const report = await queue.replay();
      expect(report).toMatchObject({ applied: 0, failed: 0, rejected: 2 });
      expect(report.rejections?.map((r) => r.code)).toEqual(['22007', '23514']);
      expect(await queue.size()).toBe(0);
    });

    it('panne transitoire (sans code, jeton expiré, surcharge) : la mutation reste en file', async () => {
      for (const error of [
        { message: 'TypeError: Failed to fetch', code: '' },
        { message: 'JWT expired', code: 'PGRST301' },
        { message: 'canceling statement due to statement timeout', code: '57014' },
      ]) {
        await queue.clear();
        fake.tables['items'] = [{ id: 'i1', title: 'x', updated_at: '2026-07-01T00:00:00Z' }];
        refuseWrites(fake, (op) => (op === 'delete' ? error : null));
        await queue.enqueue(mutation({ id: 'm1', type: 'delete', payload: { id: 'i1' } }));
        const report = await queue.replay();
        expect(report).toMatchObject({ applied: 0, failed: 1, rejected: 0 });
        expect(await queue.size()).toBe(1);
      }
    });

    it('isDefinitiveRefusal : règle métier, donnée invalide, contrainte, droit insuffisant', () => {
      for (const code of ['P0001', '22007', '22P02', '23505', '23514', '42501']) {
        expect(isDefinitiveRefusal({ code })).toBe(true);
      }
      for (const code of ['', 'PGRST301', 'PGRST000', '40001', '53300', '57014', '08006']) {
        expect(isDefinitiveRefusal({ code })).toBe(false);
      }
      expect(isDefinitiveRefusal(null)).toBe(false);
      expect(isDefinitiveRefusal({ message: 'sans code' })).toBe(false);
    });
  });

  describe('fusion par champ quand la mutation porte la version éditée (base)', () => {
    it('une écriture serveur sur d’AUTRES champs ne fait plus perdre la correction en file', async () => {
      // Correction hors-ligne (titre + attributs) éditée sur la version T0…
      await queue.enqueue(
        mutation({
          id: 'm1',
          type: 'update',
          payload: {
            id: 'i1',
            title: 'Pauillac 2019',
            attributes: { vintage: 2019, corrections: [{ field: 'vintage', from: 2015, to: 2019 }] },
            updatedAt: '2026-07-10T08:00:00Z',
          },
          base: { title: 'Pauillac 2015', attributes: { vintage: 2015 } },
        }),
      );
      // …puis, en ligne, le prix d'acquisition est modifié (updated_at serveur plus récent).
      fake.tables['items'] = [
        {
          id: 'i1',
          title: 'Pauillac 2015',
          attributes: { vintage: 2015 },
          acquired_price: 80,
          updated_at: '2026-07-10T09:00:00Z',
        },
      ];

      const report = await queue.replay();
      expect(report).toMatchObject({ applied: 1, skipped: 0, failed: 0 });
      const row = fake.row('items', 'i1');
      expect(row?.['title']).toBe('Pauillac 2019');
      expect(row?.['attributes']).toEqual({
        vintage: 2019,
        corrections: [{ field: 'vintage', from: 2015, to: 2019 }],
      });
      expect(row?.['acquired_price']).toBe(80); // l'écriture en ligne est conservée
    });

    it('champ modifié des deux côtés : le serveur l’emporte, les autres champs passent', async () => {
      await queue.enqueue(
        mutation({
          id: 'm1',
          type: 'update',
          payload: { id: 'i1', title: 'Local', notes: 'note locale', updatedAt: '2026-07-10T08:00:00Z' },
          base: { title: 'Avant', notes: null },
        }),
      );
      fake.tables['items'] = [
        { id: 'i1', title: 'Serveur', notes: null, updated_at: '2026-07-10T09:00:00Z' },
      ];

      expect(await queue.replay()).toMatchObject({ applied: 1, skipped: 0 });
      expect(fake.row('items', 'i1')?.['title']).toBe('Serveur');
      expect(fake.row('items', 'i1')?.['notes']).toBe('note locale');
    });

    it('tous les champs modifiés côté serveur : skipped ; jsonb réordonné = inchangé', async () => {
      await queue.enqueue(
        mutation({
          id: 'm1',
          type: 'update',
          payload: { id: 'i1', title: 'Local', updatedAt: '2026-07-10T08:00:00Z' },
          base: { title: 'Avant' },
        }),
      );
      await queue.enqueue(
        mutation({
          id: 'm2',
          type: 'update',
          payload: { id: 'i2', attributes: { a: 1, b: 3 }, updatedAt: '2026-07-10T08:00:00Z' },
          base: { attributes: { a: 1, b: 2 } },
        }),
      );
      fake.tables['items'] = [
        { id: 'i1', title: 'Serveur', updated_at: '2026-07-10T09:00:00Z' },
        // jsonb relu dans un autre ordre de clés : même valeur que la version éditée.
        { id: 'i2', attributes: { b: 2, a: 1 }, updated_at: '2026-07-10T09:00:00Z' },
      ];

      const report = await queue.replay();
      expect(report).toMatchObject({ applied: 1, skipped: 1 });
      expect(fake.row('items', 'i1')?.['title']).toBe('Serveur');
      expect(fake.row('items', 'i2')?.['attributes']).toEqual({ a: 1, b: 3 });
    });

    it('deux modifications hors-ligne successives du même objet sont toutes deux appliquées', async () => {
      // Au rejeu, la 1re pose updated_at = maintenant (trigger) : sans fusion
      // par champ, la 2de (éditée sur la version de la 1re) serait perdue.
      let clock = Date.parse('2026-07-11T00:00:00Z');
      const fakeWithClock = new FakeSupabase(() => new Date((clock += 1000)).toISOString());
      fakeWithClock.tables['items'] = [{ id: 'i1', title: 'v0', updated_at: '2026-07-01T00:00:00Z' }];
      setTriggerUpdatedAt(fakeWithClock);
      const q = new MutationQueue(asSupabase(fakeWithClock), createMemoryStorage());
      await q.enqueue(
        mutation({
          id: 'm1',
          type: 'update',
          payload: { id: 'i1', title: 'v1', updatedAt: '2026-07-10T08:00:00Z' },
          base: { title: 'v0' },
        }),
      );
      await q.enqueue(
        mutation({
          id: 'm2',
          type: 'update',
          payload: { id: 'i1', title: 'v2', updatedAt: '2026-07-10T08:05:00Z' },
          base: { title: 'v1' },
        }),
      );

      expect(await q.replay()).toMatchObject({ applied: 2, skipped: 0 });
      expect(fakeWithClock.row('items', 'i1')?.['title']).toBe('v2');
    });

    it('sameJsonValue : ordre des clés, numeric relu en chaîne, null ≡ undefined', () => {
      expect(sameJsonValue({ a: [1, { b: 'x' }], c: null }, { c: undefined, a: [1, { b: 'x' }] })).toBe(true);
      expect(sameJsonValue(1200.5, '1200.50')).toBe(true);
      expect(sameJsonValue([1, 2], [2, 1])).toBe(false);
      expect(sameJsonValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(sameJsonValue('', 0)).toBe(false);
    });
  });
});

type WriteOperation = 'insert' | 'update' | 'delete';

/**
 * Simule un refus (ou une panne) du serveur sur certaines écritures : la
 * règle reçoit l'opération et renvoie l'erreur PostgREST à produire (null →
 * comportement normal du fake). Les lectures ne sont jamais refusées.
 */
function refuseWrites(
  fake: FakeSupabase,
  rule: (op: WriteOperation) => { message: string; code?: string } | null,
): void {
  const from = FakeSupabase.prototype.from.bind(fake);
  fake.from = (table: string) => {
    const builder = from(table);
    let op: WriteOperation | null = null;
    const wrap = <K extends 'insert' | 'update' | 'delete'>(name: K) => {
      const original = builder[name].bind(builder) as (...args: unknown[]) => typeof builder;
      (builder as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
        op = name;
        return original(...args);
      };
    };
    wrap('insert');
    wrap('update');
    wrap('delete');
    const then = builder.then.bind(builder);
    builder.then = ((onFulfilled, onRejected) => {
      const error = op === null ? null : rule(op);
      if (error === null) return then(onFulfilled, onRejected);
      return Promise.resolve({ data: null, error }).then(onFulfilled, onRejected);
    }) as typeof builder.then;
    return builder;
  };
}

/** Comme le trigger `set_updated_at` : toute mise à jour pose updated_at = maintenant. */
function setTriggerUpdatedAt(fake: FakeSupabase): void {
  const from = FakeSupabase.prototype.from.bind(fake);
  fake.from = (table: string) => {
    const builder = from(table);
    const update = builder.update.bind(builder);
    builder.update = (row: Record<string, unknown>) => update({ ...row, updated_at: fake.now() });
    return builder;
  };
}
