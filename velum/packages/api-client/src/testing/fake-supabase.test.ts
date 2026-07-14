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
