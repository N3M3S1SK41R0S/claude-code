import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';
import {
  alertToRow,
  itemPatchToRow,
  itemPayloadToRow,
  itemToRow,
  newItemToRow,
  profilePatchToRow,
  rowToAlert,
  rowToItem,
  rowToProfile,
  rowToValuation,
  type AlertRow,
  type ItemRow,
  type ProfileRow,
  type ValuationRow,
} from './mappers';

const itemRow: ItemRow = {
  id: 'itm-1',
  owner_id: 'usr-1',
  domain: 'wine',
  title: 'Château Margaux 2015',
  attributes: { vintage: 2015, appellation: 'Margaux' },
  confidence: 0.92,
  acquired_at: '2020-06-15',
  acquired_price: 450,
  condition: 'excellent',
  notes: 'Cave enterrée',
  storage_location: 'Cave A3',
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-05T09:30:00Z',
};

describe('mappers items', () => {
  it('rowToItem convertit snake_case → camelCase', () => {
    const item = rowToItem(itemRow);
    expect(item).toEqual({
      id: 'itm-1',
      ownerId: 'usr-1',
      domain: 'wine',
      title: 'Château Margaux 2015',
      attributes: { vintage: 2015, appellation: 'Margaux' },
      confidence: 0.92,
      acquiredAt: '2020-06-15',
      acquiredPrice: 450,
      condition: 'excellent',
      notes: 'Cave enterrée',
      storageLocation: 'Cave A3',
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-05T09:30:00Z',
    } satisfies VelumItem);
  });

  it('itemToRow est l’inverse exact de rowToItem', () => {
    expect(itemToRow(rowToItem(itemRow))).toEqual(itemRow);
  });

  it('rowToItem coerce les numeric sérialisés en chaîne', () => {
    const item = rowToItem({ ...itemRow, acquired_price: '450.50' });
    expect(item.acquiredPrice).toBe(450.5);
  });

  it('rowToItem préserve les null', () => {
    const item = rowToItem({
      ...itemRow,
      title: null,
      confidence: null,
      acquired_at: null,
      acquired_price: null,
      condition: null,
      notes: null,
      storage_location: null,
    });
    expect(item.title).toBeNull();
    expect(item.confidence).toBeNull();
    expect(item.acquiredPrice).toBeNull();
    expect(item.storageLocation).toBeNull();
  });

  it('itemPatchToRow ne mappe que les clés fournies', () => {
    expect(itemPatchToRow({ title: 'Nouveau titre', updatedAt: '2026-07-06T00:00:00Z' })).toEqual({
      title: 'Nouveau titre',
      updated_at: '2026-07-06T00:00:00Z',
    });
  });

  it('itemPayloadToRow ignore les clés inconnues et les undefined', () => {
    expect(
      itemPayloadToRow({ title: 'T', foo: 'bar', notes: undefined, acquiredPrice: 12 }),
    ).toEqual({ title: 'T', acquired_price: 12 });
  });

  it('newItemToRow mappe une entrée de création (id client optionnel)', () => {
    expect(
      newItemToRow({ ownerId: 'usr-1', domain: 'coin', title: '5 Francs Semeuse 1960' }),
    ).toEqual({ owner_id: 'usr-1', domain: 'coin', title: '5 Francs Semeuse 1960' });
    expect(newItemToRow({ id: 'local-1', ownerId: 'usr-1', domain: 'stamp' })).toEqual({
      id: 'local-1',
      owner_id: 'usr-1',
      domain: 'stamp',
    });
  });
});

describe('mappers valuations', () => {
  it('rowToValuation convertit les bornes d’IC et coerce les numeric', () => {
    const row: ValuationRow = {
      id: 'val-1',
      item_id: 'itm-1',
      central: '520.00',
      ci80_low: 480,
      ci80_high: 560,
      ci95_low: '450.00',
      ci95_high: 600,
      reliability: 74,
      sources: [
        {
          price: 510,
          currency: 'EUR',
          ageDays: 12,
          sourceWeight: 0.7,
          source: { name: 'eBay sold', kind: 'marketplace_sold' },
        },
      ],
      valued_at: '2026-07-08T12:00:00Z',
    };
    const record = rowToValuation(row);
    expect(record).toEqual({
      id: 'val-1',
      itemId: 'itm-1',
      central: 520,
      ci80Low: 480,
      ci80High: 560,
      ci95Low: 450,
      ci95High: 600,
      reliability: 74,
      sources: row.sources,
      valuedAt: '2026-07-08T12:00:00Z',
    });
  });
});

describe('mappers alerts', () => {
  const alertRow: AlertRow = {
    id: 'alr-1',
    item_id: 'itm-1',
    type: 'price_threshold',
    config: { threshold: 600 },
    active: true,
  };

  it('rowToAlert convertit snake_case → camelCase', () => {
    expect(rowToAlert(alertRow)).toEqual({
      id: 'alr-1',
      itemId: 'itm-1',
      type: 'price_threshold',
      config: { threshold: 600 },
      active: true,
    });
  });

  it('alertToRow omet id quand absent (insertion) et le garde sinon', () => {
    expect(
      alertToRow({ itemId: 'itm-1', type: 'drink_window', config: {}, active: false }),
    ).toEqual({ item_id: 'itm-1', type: 'drink_window', config: {}, active: false });
    expect(
      alertToRow({ id: 'alr-2', itemId: 'itm-1', type: 'opportunity', config: {}, active: true }),
    ).toEqual({ id: 'alr-2', item_id: 'itm-1', type: 'opportunity', config: {}, active: true });
  });
});

describe('mappers profile', () => {
  it('rowToProfile convertit snake_case → camelCase', () => {
    const row: ProfileRow = {
      id: 'usr-1',
      display_name: 'Pierre',
      locale: 'fr',
      a11y_mode: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(rowToProfile(row)).toEqual({
      id: 'usr-1',
      displayName: 'Pierre',
      locale: 'fr',
      a11yMode: true,
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('profilePatchToRow mappe uniquement les champs fournis (dont expoPushToken)', () => {
    expect(profilePatchToRow({})).toEqual({});
    expect(
      profilePatchToRow({
        displayName: 'Pierre',
        a11yMode: false,
        expoPushToken: 'ExponentPushToken[xyz]',
      }),
    ).toEqual({
      display_name: 'Pierre',
      a11y_mode: false,
      expo_push_token: 'ExponentPushToken[xyz]',
    });
    expect(profilePatchToRow({ expoPushToken: null, locale: 'en' })).toEqual({
      expo_push_token: null,
      locale: 'en',
    });
  });
});
