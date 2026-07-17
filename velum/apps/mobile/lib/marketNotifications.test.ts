import { describe, expect, it } from 'vitest';
import { isVelumError } from '@velum/core';

import { parseMarketNotifications } from './marketNotifications';

describe('parseMarketNotifications', () => {
  it('mappe les lignes PostgREST valides en camelCase', () => {
    expect(
      parseMarketNotifications(
        [
          {
            id: 'notif-1',
            title: 'Alerte de prix',
            body: null,
            created_at: '2026-07-16T10:00:00.000Z',
          },
        ],
        null,
      ),
    ).toEqual([
      {
        id: 'notif-1',
        title: 'Alerte de prix',
        body: null,
        createdAt: '2026-07-16T10:00:00.000Z',
      },
    ]);
  });

  it('accepte une réponse vide réelle', () => {
    expect(parseMarketNotifications(null, null)).toEqual([]);
    expect(parseMarketNotifications([], null)).toEqual([]);
  });

  it('ne transforme jamais une panne PostgREST en liste vide', () => {
    try {
      parseMarketNotifications([], { message: 'network unavailable' });
      throw new Error('parseMarketNotifications aurait dû échouer');
    } catch (error) {
      expect(isVelumError(error)).toBe(true);
      if (isVelumError(error)) expect(error.code).toBe('SOURCE_UNAVAILABLE');
    }
  });

  it.each([
    [{ id: '', title: null, body: null, created_at: '2026-07-16T10:00:00.000Z' }],
    [{ id: 'notif-1', title: 42, body: null, created_at: '2026-07-16T10:00:00.000Z' }],
    [{ id: 'notif-1', title: null, body: null, created_at: 'date-invalide' }],
    [null],
  ])('refuse une ligne malformée au lieu de l’afficher', (row) => {
    expect(() => parseMarketNotifications([row], null)).toThrow();
  });
});
