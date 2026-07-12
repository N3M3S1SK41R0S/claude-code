import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';
import { itemDrinkWindow, itemIdentification, itemNumber, itemString } from './itemAttributes';

function item(attributes: Record<string, unknown>): VelumItem {
  return {
    id: 'i',
    ownerId: 'u',
    domain: 'wine',
    title: 'x',
    attributes,
    confidence: null,
    acquiredAt: null,
    acquiredPrice: null,
    condition: null,
    notes: null,
    storageLocation: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('itemAttributes (lecture canonique)', () => {
  it('itemString : attribut direct prioritaire, trimé', () => {
    expect(itemString(item({ region: '  Bordeaux ' }), 'region')).toBe('Bordeaux');
  });

  it('itemString : repli sur analysis.identification', () => {
    expect(itemString(item({ analysis: { identification: { region: 'Bourgogne' } } }), 'region')).toBe(
      'Bourgogne',
    );
  });

  it('itemString : null si absent ou vide', () => {
    expect(itemString(item({ region: '   ' }), 'region')).toBeNull();
    expect(itemString(item({}), 'region')).toBeNull();
  });

  it('itemNumber : direct puis repli identification, null si non fini', () => {
    expect(itemNumber(item({ vintage: 2016 }), 'vintage')).toBe(2016);
    expect(itemNumber(item({ analysis: { identification: { vintage: 2020 } } }), 'vintage')).toBe(2020);
    expect(itemNumber(item({ vintage: Number.NaN }), 'vintage')).toBeNull();
    expect(itemNumber(item({}), 'vintage')).toBeNull();
  });

  it('itemIdentification : objet ou null', () => {
    expect(itemIdentification(item({ analysis: { identification: { a: 1 } } }))).toEqual({ a: 1 });
    expect(itemIdentification(item({ analysis: 'pas-un-objet' }))).toBeNull();
    expect(itemIdentification(item({}))).toBeNull();
  });

  it('itemDrinkWindow : {from,to} valides seulement', () => {
    expect(
      itemDrinkWindow(item({ analysis: { tasting: { drinkWindow: { from: 2022, to: 2030 } } } })),
    ).toEqual({ from: 2022, to: 2030 });
    expect(
      itemDrinkWindow(item({ analysis: { tasting: { drinkWindow: { from: 2022 } } } })),
    ).toBeNull();
    expect(itemDrinkWindow(item({}))).toBeNull();
  });
});
