import { beforeEach, describe, expect, it } from 'vitest';
import { isVelumError, type WishlistEntry } from '@velum/core';
import { asSupabase, FakeSupabase } from './testing/fake-supabase';
import {
  compareWishlistEntries,
  createWishlistRepo,
  newWishlistEntryToRow,
  rowToWishlistEntry,
  wishlistAttributesBytes,
  wishlistDbError,
  wishlistPatchToRow,
  WISHLIST_ATTRIBUTES_MAX_BYTES,
  WISHLIST_NOTES_MAX_LENGTH,
  WISHLIST_TITLE_MAX_LENGTH,
  type WishlistRow,
} from './wishlist';

/** Ligne de table du fake (enregistrement générique). */
function stored(row: WishlistRow): Record<string, unknown> {
  return { ...row };
}

function wishRow(overrides: Partial<WishlistRow> = {}): WishlistRow {
  return {
    id: 'w-1',
    owner_id: 'usr-1',
    domain: 'wine',
    kind: 'wish',
    title: 'Domaine Tempier Bandol 2019',
    notes: null,
    attributes: {},
    source: 'manual',
    source_item_id: null,
    target_price: null,
    priority: 'medium',
    acquired: false,
    acquired_at: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

async function expectVelumError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(isVelumError(error)).toBe(true);
    if (isVelumError(error)) expect(error.code).toBe(code);
    return;
  }
  throw new Error(`une VelumError ${code} était attendue`);
}

describe('mappers wishlist', () => {
  it('rowToWishlistEntry mappe en camelCase et convertit le numeric texte', () => {
    const entry = rowToWishlistEntry(
      wishRow({ target_price: '59.90', source_item_id: 'itm-9', acquired: true, acquired_at: '2026-08-01T10:00:00Z' }),
    );
    expect(entry).toMatchObject({
      ownerId: 'usr-1',
      targetPrice: 59.9,
      sourceItemId: 'itm-9',
      acquired: true,
      acquiredAt: '2026-08-01T10:00:00Z',
    });
  });

  it('rowToWishlistEntry est défensif : attributs non-objet → {}, prix illisible → null', () => {
    const entry = rowToWishlistEntry(
      wishRow({
        attributes: ['pas', 'un', 'objet'] as unknown as Record<string, unknown>,
        target_price: 'abc',
      }),
    );
    expect(entry.attributes).toEqual({});
    expect(entry.targetPrice).toBeNull();
    expect(rowToWishlistEntry(wishRow({ attributes: null })).attributes).toEqual({});
  });

  it('newWishlistEntryToRow applique les défauts neutres et nettoie la saisie', () => {
    const row = newWishlistEntryToRow(
      { domain: 'coin', title: '  10 Francs Coq  ', notes: '   ', targetPrice: 120.456 },
      'usr-1',
    );
    expect(row).toEqual({
      owner_id: 'usr-1',
      domain: 'coin',
      kind: 'wish',
      title: '10 Francs Coq',
      notes: null,
      attributes: {},
      source: 'manual',
      source_item_id: null,
      target_price: 120.46,
      priority: 'medium',
    });
  });

  it('newWishlistEntryToRow refuse titre vide/trop long, notes trop longues, prix négatif ou infini', () => {
    const base = { domain: 'wine' as const, title: 'Valide' };
    const cases = [
      { ...base, title: '   ' },
      { ...base, title: 'x'.repeat(WISHLIST_TITLE_MAX_LENGTH + 1) },
      { ...base, notes: 'n'.repeat(WISHLIST_NOTES_MAX_LENGTH + 1) },
      { ...base, targetPrice: -1 },
      { ...base, targetPrice: Number.POSITIVE_INFINITY },
      { ...base, targetPrice: Number.NaN },
      { ...base, attributes: [] as unknown as Record<string, unknown> },
    ];
    for (const input of cases) {
      let caught: unknown = null;
      try {
        newWishlistEntryToRow(input, 'usr-1');
      } catch (error) {
        caught = error;
      }
      expect(isVelumError(caught) && caught.code === 'INVALID_INPUT').toBe(true);
    }
  });

  it('attributs bornés comme la contrainte SQL (octet_length(attributes::text) ≤ 16 Ko)', () => {
    // Même rendu que Postgres pour jsonb::text (vérifié sur PostgreSQL 16) :
    // espaces après « : » et « , », caractères non ASCII sur plusieurs octets.
    const sample = { b: [1, 2.5, { x: null }], a: 'é"\n', c: true, e: {}, f: [] };
    expect(wishlistAttributesBytes(sample)).toBe(
      new TextEncoder().encode('{"b": [1, 2.5, {"x": null}], "a": "é\\"\\n", "c": true, "e": {}, "f": []}').length,
    );
    // ~15,6 Ko en JSON compact, mais plus de 16 Ko une fois rendu par Postgres.
    const many: Record<string, number> = {};
    for (let i = 0; i < 1600; i++) many[`k${String(i).padStart(4, '0')}`] = 1;
    expect(JSON.stringify(many).length).toBeLessThan(WISHLIST_ATTRIBUTES_MAX_BYTES);
    expect(wishlistAttributesBytes(many)).toBeGreaterThan(WISHLIST_ATTRIBUTES_MAX_BYTES);
    for (const attributes of [many, { note: 'x'.repeat(WISHLIST_ATTRIBUTES_MAX_BYTES) }]) {
      let caught: unknown = null;
      try {
        newWishlistEntryToRow({ domain: 'wine', title: 'Valide', attributes }, 'usr-1');
      } catch (error) {
        caught = error;
      }
      expect(isVelumError(caught) && caught.code === 'INVALID_INPUT').toBe(true);
      expect(() => wishlistPatchToRow({ attributes })).toThrow();
    }
    expect(newWishlistEntryToRow({ domain: 'wine', title: 'Valide', attributes: sample }, 'usr-1')['attributes']).toBe(
      sample,
    );
  });

  it('wishlistPatchToRow ne transmet que les champs fournis, jamais acquired_at', () => {
    expect(wishlistPatchToRow({})).toEqual({});
    expect(
      wishlistPatchToRow({ acquired: true, targetPrice: null, notes: '', title: ' Nouveau ' }),
    ).toEqual({ acquired: true, target_price: null, notes: null, title: 'Nouveau' });
    expect(wishlistPatchToRow({ domain: 'art', kind: 'idea', priority: 'high', attributes: { artist: 'X' } })).toEqual({
      domain: 'art',
      kind: 'idea',
      priority: 'high',
      attributes: { artist: 'X' },
    });
  });

  it('wishlistDbError classe les erreurs PostgREST', () => {
    expect(wishlistDbError('Ajout', { message: 'check', code: '23514' }).code).toBe('INVALID_INPUT');
    expect(wishlistDbError('Ajout', { message: 'fk', code: '23503' }).code).toBe('INVALID_INPUT');
    expect(wishlistDbError('Ajout', { message: 'rls', code: '42501' }).code).toBe('UNAUTHORIZED');
    expect(wishlistDbError('Maj', { message: '0 rows', code: 'PGRST116' }).code).toBe('INVALID_INPUT');
    expect(wishlistDbError('Lecture', { message: 'timeout' }).code).toBe('SOURCE_UNAVAILABLE');
  });

  it('compareWishlistEntries : en cours avant obtenues, puis plus récentes', () => {
    const e = (id: string, createdAt: string, acquired = false): WishlistEntry =>
      rowToWishlistEntry(wishRow({ id, created_at: createdAt, acquired, acquired_at: acquired ? createdAt : null }));
    const sorted = [
      e('old', '2026-01-01T00:00:00Z'),
      e('done', '2026-09-01T00:00:00Z', true),
      e('new', '2026-06-01T00:00:00Z'),
    ].sort(compareWishlistEntries);
    expect(sorted.map((x) => x.id)).toEqual(['new', 'old', 'done']);
  });
});

describe('wishlist repo', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase(() => '2026-10-23T08:00:00.000Z');
    fake.session = { user: { id: 'usr-1' } };
    fake.tables['wishlist_entries'] = [
      wishRow({ id: 'a', domain: 'wine', created_at: '2026-07-01T00:00:00Z' }),
      wishRow({
        id: 'b',
        domain: 'coin',
        created_at: '2026-07-03T00:00:00Z',
        acquired: true,
        acquired_at: '2026-07-05T00:00:00Z',
      }),
      wishRow({ id: 'c', domain: 'wine', created_at: '2026-07-02T00:00:00Z' }),
    ].map(stored);
  });

  it('list : envies en cours d’abord, puis les plus récentes', async () => {
    const entries = await createWishlistRepo(asSupabase(fake)).list();
    expect(entries.map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('list filtre par catégorie quand fournie', async () => {
    const entries = await createWishlistRepo(asSupabase(fake)).list('wine');
    expect(entries.map((e) => e.id)).toEqual(['c', 'a']);
  });

  it('list : panne réseau → SOURCE_UNAVAILABLE (jamais une liste vide)', async () => {
    fake.offline = true;
    await expectVelumError(createWishlistRepo(asSupabase(fake)).list(), 'SOURCE_UNAVAILABLE');
  });

  it('add écrit owner_id depuis la session et retourne l’entrée créée', async () => {
    const entry = await createWishlistRepo(asSupabase(fake)).add({
      domain: 'stamp',
      title: ' Cérès 20c noir 1849 ',
      kind: 'idea',
      source: 'scan',
      attributes: { country: 'France', year: 1849 },
      targetPrice: 300,
      priority: 'high',
    });
    expect(entry).toMatchObject({
      ownerId: 'usr-1',
      domain: 'stamp',
      title: 'Cérès 20c noir 1849',
      kind: 'idea',
      source: 'scan',
      targetPrice: 300,
      priority: 'high',
      acquired: false,
      createdAt: '2026-10-23T08:00:00.000Z',
    });
    const stored = fake.row('wishlist_entries', entry.id);
    expect(stored?.['owner_id']).toBe('usr-1');
    expect(stored?.['attributes']).toEqual({ country: 'France', year: 1849 });
    expect(stored).not.toHaveProperty('acquired_at');
  });

  it('add sans session → UNAUTHORIZED, sans rien écrire', async () => {
    fake.session = null;
    await expectVelumError(
      createWishlistRepo(asSupabase(fake)).add({ domain: 'wine', title: 'X' }),
      'UNAUTHORIZED',
    );
    expect(fake.tables['wishlist_entries']).toHaveLength(3);
  });

  it('add avec saisie invalide → INVALID_INPUT avant tout appel', async () => {
    fake.offline = true; // prouverait un appel réseau (SOURCE_UNAVAILABLE)
    await expectVelumError(
      createWishlistRepo(asSupabase(fake)).add({ domain: 'wine', title: '  ' }),
      'INVALID_INPUT',
    );
  });

  it('update applique le patch et relit la ligne', async () => {
    const repo = createWishlistRepo(asSupabase(fake));
    const updated = await repo.update('a', { acquired: true, priority: 'high' });
    expect(updated).toMatchObject({ id: 'a', acquired: true, priority: 'high' });
    expect(fake.row('wishlist_entries', 'a')?.['priority']).toBe('high');
  });

  it('update sans champ relit l’entrée sans écrire', async () => {
    const repo = createWishlistRepo(asSupabase(fake));
    const before = { ...fake.row('wishlist_entries', 'c') };
    const entry = await repo.update('c', {});
    expect(entry.id).toBe('c');
    expect(fake.row('wishlist_entries', 'c')).toEqual(before);
  });

  it('update d’une entrée inconnue → erreur explicite', async () => {
    const repo = createWishlistRepo(asSupabase(fake));
    let caught: unknown = null;
    try {
      await repo.update('inconnue', { title: 'X' });
    } catch (error) {
      caught = error;
    }
    expect(isVelumError(caught)).toBe(true);
  });

  it('remove supprime la ligne ; panne → SOURCE_UNAVAILABLE', async () => {
    const repo = createWishlistRepo(asSupabase(fake));
    await repo.remove('a');
    expect(fake.row('wishlist_entries', 'a')).toBeUndefined();
    fake.offline = true;
    await expectVelumError(repo.remove('c'), 'SOURCE_UNAVAILABLE');
  });
});
