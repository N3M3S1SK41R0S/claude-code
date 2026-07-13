import { describe, expect, it } from 'vitest';
import { createVelumClient } from './client';
import { MutationQueue, MUTATION_QUEUE_STORAGE_KEY } from './queue';
import { createMemoryStorage } from './storage';

describe('createVelumClient', () => {
  it('assemble toutes les façades sans toucher au réseau', () => {
    const client = createVelumClient({
      supabaseUrl: 'https://exemple.supabase.co',
      supabaseAnonKey: 'anon-key-publique',
    });

    expect(client.supabase).toBeDefined();
    expect(client.queue).toBeInstanceOf(MutationQueue);
    expect(typeof client.auth.signInWithEmail).toBe('function');
    expect(typeof client.auth.deleteAccount).toBe('function');
    expect(typeof client.edge.recognize).toBe('function');
    expect(typeof client.items.list).toBe('function');
    expect(typeof client.valuations.latest).toBe('function');
    expect(typeof client.alerts.upsert).toBe('function');
    expect(typeof client.profile.update).toBe('function');
  });

  it('branche la file de mutations sur le StorageAdapter fourni', async () => {
    const storage = createMemoryStorage();
    const client = createVelumClient({
      supabaseUrl: 'https://exemple.supabase.co',
      supabaseAnonKey: 'anon-key-publique',
      storage,
    });

    await client.queue.enqueue({
      id: 'm1',
      table: 'items',
      type: 'delete',
      payload: { id: 'i1' },
      queuedAt: new Date().toISOString(),
    });
    expect(await storage.getItem(MUTATION_QUEUE_STORAGE_KEY)).not.toBeNull();
    expect(await client.queue.size()).toBe(1);
  });
});
