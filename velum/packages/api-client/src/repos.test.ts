import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';
import {
  createAlertsRepo,
  createItemsRepo,
  createProfileApi,
  createProvenanceRepo,
  createTastingNotesRepo,
  createValuationsRepo,
} from './repos';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';

function itemRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'itm-1',
    owner_id: 'usr-1',
    domain: 'wine',
    title: null,
    attributes: {},
    confidence: null,
    acquired_at: null,
    acquired_price: null,
    condition: null,
    notes: null,
    storage_location: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('items repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['items'] = [
      itemRow({ id: 'a', domain: 'wine', updated_at: '2026-07-01T00:00:00Z' }),
      itemRow({ id: 'b', domain: 'coin', updated_at: '2026-07-03T00:00:00Z' }),
      itemRow({ id: 'c', domain: 'wine', updated_at: '2026-07-02T00:00:00Z' }),
    ];
  });

  it('list trie par updated_at décroissant et mappe en camelCase', async () => {
    const items = await createItemsRepo(asSupabase(fake)).list();
    expect(items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(items[0]?.ownerId).toBe('usr-1');
    expect(items[0]?.updatedAt).toBe('2026-07-03T00:00:00Z');
  });

  it('list filtre par domaine quand fourni', async () => {
    const items = await createItemsRepo(asSupabase(fake)).list('wine');
    expect(items.map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('get retourne null quand l’objet n’existe pas', async () => {
    const repo = createItemsRepo(asSupabase(fake));
    expect(await repo.get('inconnu')).toBeNull();
    expect((await repo.get('a'))?.id).toBe('a');
  });

  it('insert mappe NewItem en snake_case et retourne le VelumItem créé', async () => {
    const repo = createItemsRepo(asSupabase(fake));
    const item = await repo.insert({
      ownerId: 'usr-1',
      domain: 'stamp',
      title: 'Cérès 1849',
      attributes: { yearIssued: 1849 },
    });
    expect(item.domain).toBe('stamp');
    expect(item.ownerId).toBe('usr-1');
    expect(item.id).toBeTruthy();
    const stored = fake.row('items', item.id);
    expect(stored?.['owner_id']).toBe('usr-1');
    expect(stored?.['title']).toBe('Cérès 1849');
  });

  it('update pousse un updated_at frais (new Date().toISOString())', async () => {
    const before = Date.now();
    const repo = createItemsRepo(asSupabase(fake));
    const item = await repo.update('a', { title: 'Renommé', updatedAt: '2020-01-01T00:00:00Z' });
    expect(item.title).toBe('Renommé');
    // updated_at n'est pas l'ancien horodatage ni celui du patch : il est « maintenant ».
    const stamp = Date.parse(item.updatedAt);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(Date.now());
    expect(fake.row('items', 'a')?.['title']).toBe('Renommé');
  });

  it('remove supprime la ligne', async () => {
    await createItemsRepo(asSupabase(fake)).remove('a');
    expect(fake.row('items', 'a')).toBeUndefined();
    expect(fake.tables['items']).toHaveLength(2);
  });

  it('erreur PostgREST → VelumError SOURCE_UNAVAILABLE', async () => {
    fake.offline = true;
    const repo = createItemsRepo(asSupabase(fake));
    await expect(repo.list()).rejects.toSatisfy(
      (e: unknown) => isVelumError(e) && e.code === 'SOURCE_UNAVAILABLE',
    );
  });
});

describe('valuations repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['valuations'] = [
      {
        id: 'v1',
        item_id: 'itm-1',
        central: 100,
        ci80_low: 90,
        ci80_high: 110,
        ci95_low: 80,
        ci95_high: 120,
        reliability: 60,
        sources: [],
        valued_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'v2',
        item_id: 'itm-1',
        central: 130,
        ci80_low: 120,
        ci80_high: 140,
        ci95_low: 110,
        ci95_high: 150,
        reliability: 72,
        sources: [],
        valued_at: '2026-07-09T00:00:00Z',
      },
      {
        id: 'v3',
        item_id: 'autre',
        central: 999,
        ci80_low: 1,
        ci80_high: 2,
        ci95_low: 1,
        ci95_high: 2,
        reliability: 1,
        sources: [],
        valued_at: '2026-07-10T00:00:00Z',
      },
    ];
  });

  it('history retourne l’historique du plus récent au plus ancien', async () => {
    const records = await createValuationsRepo(asSupabase(fake)).history('itm-1');
    expect(records.map((r) => r.id)).toEqual(['v2', 'v1']);
    expect(records[0]?.ci95High).toBe(150);
    expect(records[0]?.itemId).toBe('itm-1');
  });

  it('latest retourne la valorisation la plus récente, ou null', async () => {
    const repo = createValuationsRepo(asSupabase(fake));
    expect((await repo.latest('itm-1'))?.id).toBe('v2');
    expect(await repo.latest('sans-valorisation')).toBeNull();
  });
});

describe('alerts repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['alerts'] = [
      { id: 'a1', item_id: 'itm-1', type: 'price_threshold', config: { threshold: 500 }, active: true },
      { id: 'a2', item_id: 'itm-2', type: 'drink_window', config: {}, active: false },
    ];
  });

  it('list retourne toutes les alertes, ou celles d’un item', async () => {
    const repo = createAlertsRepo(asSupabase(fake));
    expect((await repo.list()).map((a) => a.id)).toEqual(['a1', 'a2']);
    const filtered = await repo.list('itm-2');
    expect(filtered.map((a) => a.id)).toEqual(['a2']);
    expect(filtered[0]?.itemId).toBe('itm-2');
  });

  it('upsert insère sans id puis remplace avec id', async () => {
    const repo = createAlertsRepo(asSupabase(fake));
    const created = await repo.upsert({
      itemId: 'itm-1',
      type: 'opportunity',
      config: { note: 'à surveiller' },
      active: true,
    });
    expect(created.id).toBeTruthy();
    expect(fake.tables['alerts']).toHaveLength(3);

    const updated = await repo.upsert({ ...created, active: false });
    expect(updated.id).toBe(created.id);
    expect(updated.active).toBe(false);
    expect(fake.tables['alerts']).toHaveLength(3);
  });

  it('remove supprime l’alerte', async () => {
    await createAlertsRepo(asSupabase(fake)).remove('a1');
    expect(fake.tables['alerts']?.map((a) => a['id'])).toEqual(['a2']);
  });
});

describe('profile api', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['profiles'] = [
      {
        id: 'usr-1',
        display_name: 'Pierre',
        locale: 'fr',
        a11y_mode: false,
        plan: 'free',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
  });

  it('get retourne le profil mappé (ou null si absent)', async () => {
    const api = createProfileApi(asSupabase(fake));
    const profile = await api.get();
    expect(profile).toEqual({
      id: 'usr-1',
      displayName: 'Pierre',
      locale: 'fr',
      a11yMode: false,
      plan: 'free',
      createdAt: '2026-01-01T00:00:00Z',
    });

    fake.tables['profiles'] = [];
    expect(await api.get()).toBeNull();
  });

  it('update exige une session active', async () => {
    const api = createProfileApi(asSupabase(fake));
    await expect(api.update({ displayName: 'X' })).rejects.toSatisfy(
      (e: unknown) => isVelumError(e) && e.code === 'UNAUTHORIZED',
    );
  });

  it('update mappe le patch (dont expoPushToken) sur la ligne du user connecté', async () => {
    fake.session = { user: { id: 'usr-1' } };
    const api = createProfileApi(asSupabase(fake));
    await api.update({ displayName: 'Pierre T.', a11yMode: true, expoPushToken: 'tok-1' });
    const row = fake.row('profiles', 'usr-1');
    expect(row?.['display_name']).toBe('Pierre T.');
    expect(row?.['a11y_mode']).toBe(true);
    expect(row?.['expo_push_token']).toBe('tok-1');
  });
});

describe('tasting notes repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['tasting_notes'] = [
      { id: 'n1', item_id: 'a', rating: 90, note: 'Superbe', tasted_at: '2026-02-01', created_at: '2026-02-01T00:00:00Z' },
      { id: 'n2', item_id: 'a', rating: null, note: 'Encore fermé', tasted_at: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
      { id: 'n3', item_id: 'b', rating: 80, note: null, tasted_at: '2026-03-01', created_at: '2026-03-01T00:00:00Z' },
    ];
  });

  it('list filtre par item et trie du plus récent au plus ancien', async () => {
    const notes = await createTastingNotesRepo(asSupabase(fake)).list('a');
    expect(notes.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(notes[0]?.rating).toBeNull();
    expect(notes[1]?.rating).toBe(90);
  });

  it('add insère une note et retourne le TastingNote créé', async () => {
    const repo = createTastingNotesRepo(asSupabase(fake));
    const created = await repo.add({ itemId: 'a', rating: 88, note: 'Belle évolution', tastedAt: '2026-07-01' });
    expect(created.itemId).toBe('a');
    expect(created.rating).toBe(88);
    expect((fake.tables['tasting_notes'] ?? []).length).toBe(4);
  });

  it('remove supprime la note', async () => {
    const repo = createTastingNotesRepo(asSupabase(fake));
    await repo.remove('n1');
    expect((fake.tables['tasting_notes'] ?? []).map((r) => r['id'])).toEqual(['n2', 'n3']);
  });
});

describe('provenance repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.tables['provenance_entries'] = [
      { id: 'p2', item_id: 'a', owner_label: 'Moi', acquired_from: 'Drouot', note: null, event_date: '2020-06-15', created_at: '2020-06-15T00:00:00Z' },
      { id: 'p1', item_id: 'a', owner_label: 'Collection X', acquired_from: 'Galerie', note: 'Acquis en 1998', event_date: '1998-01-01', created_at: '2020-01-01T00:00:00Z' },
    ];
  });

  it('list filtre par item et trie par date d’événement croissante', async () => {
    const entries = await createProvenanceRepo(asSupabase(fake)).list('a');
    expect(entries.map((e) => e.id)).toEqual(['p1', 'p2']);
    expect(entries[0]?.ownerLabel).toBe('Collection X');
  });

  it('add insère une étape et remove la supprime', async () => {
    const repo = createProvenanceRepo(asSupabase(fake));
    const created = await repo.add({ itemId: 'a', ownerLabel: 'Acheteur', acquiredFrom: 'Vente privée', eventDate: '2026-07-01' });
    expect(created.acquiredFrom).toBe('Vente privée');
    expect((fake.tables['provenance_entries'] ?? []).length).toBe(3);
    await repo.remove(created.id);
    expect((fake.tables['provenance_entries'] ?? []).length).toBe(2);
  });
});
