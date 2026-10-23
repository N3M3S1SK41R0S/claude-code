/**
 * Garde-fou : toutes les clés i18n construites dynamiquement par l'écran
 * « Mes envies » (segments, tri, types, priorités, origines, problèmes
 * communauté, erreurs de formulaire) existent en FR et en EN.
 */
import { describe, expect, it } from 'vitest';
import type { WishlistSource } from '@velum/core';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import {
  PRIORITY_BADGE_KEY,
  WISHLIST_KINDS,
  WISHLIST_PRIORITIES,
  WISHLIST_SEGMENTS,
  WISHLIST_SORTS,
  buildWishlistInput,
  emptyWishlistForm,
  type CommunityProblem,
} from './wishlist';

function lookup(catalog: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    catalog,
  );
}

const SOURCES: readonly WishlistSource[] = ['manual', 'item', 'scan', 'tasting', 'market'];
const PROBLEMS: readonly CommunityProblem[] = ['plan', 'notYet', 'unavailable', 'generic'];

function dynamicKeys(): string[] {
  const invalid = buildWishlistInput({
    ...emptyWishlistForm('wine'),
    title: 'x'.repeat(500),
    notes: 'n'.repeat(5000),
    targetPrice: 'abc',
  });
  const formErrors = invalid.ok ? [] : Object.values(invalid.errors);
  const empty = buildWishlistInput(emptyWishlistForm('wine'));
  const titleRequired = empty.ok ? [] : Object.values(empty.errors);
  return [
    ...WISHLIST_SEGMENTS.map((s) => `wishlist.segments.${s}`),
    ...WISHLIST_SORTS.map((s) => `wishlist.sort.${s}`),
    ...WISHLIST_KINDS.flatMap((k) => [`wishlist.kind.${k}`, `wishlist.kind.${k}Hint`]),
    ...WISHLIST_PRIORITIES.map((p) => `wishlist.priority.${p}`),
    ...Object.values(PRIORITY_BADGE_KEY),
    ...SOURCES.map((s) => `wishlist.source.${s}`),
    ...PROBLEMS.map((p) => `wishlist.community.${p}`),
    ...formErrors,
    ...titleRequired,
  ];
}

describe('clés i18n dynamiques de la liste d’envies', () => {
  it('produit bien des clés à vérifier', () => {
    expect(dynamicKeys().length).toBeGreaterThan(25);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('toutes présentes et non vides (%s)', (_locale, catalog) => {
    const missing = dynamicKeys().filter((key) => {
      const value = lookup(catalog, key);
      return typeof value !== 'string' || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });
});
