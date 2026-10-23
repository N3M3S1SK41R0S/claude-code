import { describe, expect, it } from 'vitest';

import {
  batchCaptureDomain,
  collectionQuickAccess,
  homeQuickAccess,
} from './collectionViewQuickAccess';
import { routes } from './routes';

const ALL = ['wine', 'coin', 'art', 'stamp', 'watch'] as const;

describe('batchCaptureDomain', () => {
  it('privilégie les timbres, puis les pièces, sinon le premier domaine actif', () => {
    expect(batchCaptureDomain(ALL)).toBe('stamp');
    expect(batchCaptureDomain(['wine', 'coin'])).toBe('coin');
    expect(batchCaptureDomain(['art', 'wine'])).toBe('art');
    expect(batchCaptureDomain([])).toBeNull();
  });
});

describe('collectionQuickAccess', () => {
  it('avec du vin : 8 accès, outils de cave inclus, liens via routes', () => {
    const entries = collectionQuickAccess({ hasWine: true, activeDomains: ALL });
    expect(entries.map((e) => e.id)).toEqual([
      'carnet',
      'wishlist',
      'cellarPeak',
      'sommelier',
      'community',
      'batch',
      'eventSommelier',
      'blindTasting',
    ]);
    const href = Object.fromEntries(entries.map((e) => [e.id, e.href]));
    expect(href['wishlist']).toBe(routes.wishlist());
    expect(href['cellarPeak']).toBe(routes.cellarPeak());
    expect(href['community']).toBe(routes.community());
    expect(href['batch']).toBe(routes.captureBatch('stamp'));
    expect(href['sommelier']).toBe(routes.cellarSommelier());
  });

  it('sans vin : pas d’apogée ni d’outils de dégustation, le sommelier reste', () => {
    const ids = collectionQuickAccess({ hasWine: false, activeDomains: ALL }).map((e) => e.id);
    expect(ids).toEqual(['carnet', 'wishlist', 'sommelier', 'community', 'batch']);
  });

  it('identifiants uniques et une seule action mise en avant', () => {
    const entries = collectionQuickAccess({ hasWine: true, activeDomains: ALL });
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(entries.filter((e) => e.gilded)).toHaveLength(1);
  });

  it('sans domaine actif : pas de mode classeur', () => {
    const ids = collectionQuickAccess({ hasWine: false, activeDomains: [] }).map((e) => e.id);
    expect(ids).not.toContain('batch');
  });
});

describe('homeQuickAccess', () => {
  it('organise l’accueil autour des espaces, capture en tête', () => {
    const entries = homeQuickAccess(ALL);
    expect(entries.map((e) => e.id)).toEqual([
      'capture',
      'batch',
      'collection',
      'wishlist',
      'community',
      'cellarPeak',
      'market',
    ]);
    expect(entries[0]?.gilded).toBe(true);
    expect(entries.find((e) => e.id === 'capture')?.href).toBe(routes.captureTab());
    expect(entries.find((e) => e.id === 'collection')?.href).toBe(routes.collection());
    expect(entries.find((e) => e.id === 'market')?.href).toBe(routes.market());
  });

  it('masque « Vins à l’apogée » si le module Vin est désactivé', () => {
    const ids = homeQuickAccess(['coin', 'stamp']).map((e) => e.id);
    expect(ids).not.toContain('cellarPeak');
    expect(ids).toContain('batch');
  });
});
