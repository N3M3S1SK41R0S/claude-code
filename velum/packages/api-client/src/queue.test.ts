import { beforeEach, describe, expect, it } from 'vitest';
import { MUTATION_QUEUE_STORAGE_KEY, MutationQueue, type QueuedMutation } from './queue';
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
        payload: { id: 'i1', title: 'Après', updatedAt: '2026-07-10T09:00:00Z' },
      }),
    );

    const report = await queue.replay();
    expect(report).toEqual({ applied: 2, skipped: 0, failed: 0 });
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
    expect(report).toEqual({ applied: 0, skipped: 1, failed: 0 });
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
    expect(report).toEqual({ applied: 1, skipped: 0, failed: 0 });
    expect(fake.row('items', 'i1')?.['title']).toBe('client');
  });

  it('échec réseau : la mutation reste en file et est comptée failed', async () => {
    await queue.enqueue(mutation({ id: 'm1', payload: { id: 'i1', ownerId: 'u1', domain: 'art' } }));
    fake.offline = true;

    const report = await queue.replay();
    expect(report).toEqual({ applied: 0, skipped: 0, failed: 1 });
    expect(await queue.size()).toBe(1); // toujours en file, sera retentée

    // Le réseau revient : le rejeu suivant applique la mutation.
    fake.offline = false;
    expect(await queue.replay()).toEqual({ applied: 1, skipped: 0, failed: 0 });
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
    expect(report).toEqual({ applied: 1, skipped: 0, failed: 0 });
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
    expect(report).toEqual({ applied: 0, skipped: 1, failed: 0 });
    expect(await queue.size()).toBe(0);
  });

  it('clear vide la file', async () => {
    await queue.enqueue(mutation({ id: 'm1' }));
    await queue.enqueue(mutation({ id: 'm2' }));
    await queue.clear();
    expect(await queue.size()).toBe(0);
    expect(await storage.getItem(MUTATION_QUEUE_STORAGE_KEY)).toBeNull();
  });
});
