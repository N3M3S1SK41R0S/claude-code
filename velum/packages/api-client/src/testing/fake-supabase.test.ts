import { describe, expect, it } from 'vitest';

import { FakeSupabase } from './fake-supabase';

describe('FakeSupabase — horloge injectée', () => {
  it('utilise un même instant déterministe pour created_at et updated_at', async () => {
    const timestamp = '2030-01-02T03:04:05.000Z';
    let calls = 0;
    const fake = new FakeSupabase(() => {
      calls += 1;
      return timestamp;
    });

    await fake.from('items').insert({ id: 'item-clock' }).select('*').single();

    expect(fake.row('items', 'item-clock')).toMatchObject({
      created_at: timestamp,
      updated_at: timestamp,
    });
    expect(calls).toBe(1);
  });

  it('préserve les horodatages explicitement fournis', async () => {
    const fake = new FakeSupabase(() => '2030-01-02T03:04:05.000Z');

    await fake
      .from('items')
      .insert({
        id: 'item-explicit',
        created_at: '2020-01-01T00:00:00.000Z',
        updated_at: '2020-01-02T00:00:00.000Z',
      })
      .select('*')
      .single();

    expect(fake.row('items', 'item-explicit')).toMatchObject({
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-02T00:00:00.000Z',
    });
  });
});

describe('FakeSupabase — single() au format PostgREST', () => {
  it('aucune ligne ⇒ erreur PGRST116', async () => {
    const fake = new FakeSupabase();
    const result = await fake.from('items').select('*').eq('id', 'absent').single();
    expect(result).toEqual({
      data: null,
      error: { message: 'aucune ligne ne correspond (simulé)', code: 'PGRST116' },
    });
  });
});

describe('FakeSupabase — rpc()', () => {
  it('journalise les appels et renvoie une réponse fixe', async () => {
    const fake = new FakeSupabase();
    fake.rpcResponses['my_exchanges'] = { data: [{ id: 'x1' }] };
    await expect(fake.rpc('my_exchanges')).resolves.toEqual({ data: [{ id: 'x1' }], error: null });
    expect(fake.rpcCalls).toEqual([{ fn: 'my_exchanges', args: {} }]);
  });

  it('calcule la réponse à partir des arguments nommés', async () => {
    const fake = new FakeSupabase();
    fake.rpcResponses['market_buy'] = (args) => ({ data: [{ listing: args['p_listing'] }] });
    await expect(fake.rpc('market_buy', { p_listing: 'l1' })).resolves.toEqual({
      data: [{ listing: 'l1' }],
      error: null,
    });
  });

  it('propage les erreurs simulées (code compris)', async () => {
    const fake = new FakeSupabase();
    fake.rpcResponses['market_catalogue'] = { error: { message: 'Platine requis', code: 'VL402' } };
    await expect(fake.rpc('market_catalogue')).resolves.toEqual({
      data: null,
      error: { message: 'Platine requis', code: 'VL402' },
    });
  });

  it('fonction inconnue ⇒ PGRST202 ; panne réseau ⇒ erreur sans journalisation', async () => {
    const fake = new FakeSupabase();
    const unknown = await fake.rpc('inexistante');
    expect(unknown.error?.code).toBe('PGRST202');
    fake.offline = true;
    const offline = await fake.rpc('inexistante');
    expect(offline).toEqual({ data: null, error: { message: 'réseau indisponible (simulé)' } });
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it('single() / maybeSingle() sur un résultat de fonction', async () => {
    const fake = new FakeSupabase();
    fake.rpcResponses['vide'] = { data: [] };
    fake.rpcResponses['une'] = { data: [{ id: 'a' }, { id: 'b' }] };
    await expect(fake.rpc('une').single()).resolves.toEqual({ data: { id: 'a' }, error: null });
    await expect(fake.rpc('vide').maybeSingle()).resolves.toEqual({ data: null, error: null });
    const missing = await fake.rpc('vide').single();
    expect(missing.error?.code).toBe('PGRST116');
  });
});
