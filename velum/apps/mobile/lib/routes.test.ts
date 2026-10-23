import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('routes', () => {
  it('construit les chemins avec paramètres encodés, sans paramètres vides', () => {
    expect(routes.community()).toBe('/community');
    expect(routes.community('coin', 'exchange', 'napoléon or')).toBe(
      '/community?domain=coin&mode=exchange&text=napol%C3%A9on%20or',
    );
    expect(routes.wishlist(null)).toBe('/wishlist');
    expect(routes.wishlist('wine')).toBe('/wishlist?domain=wine');
    expect(routes.capture('stamp', 'quick')).toBe('/capture/stamp?mode=quick');
    expect(routes.captureBatch('stamp')).toBe('/capture/batch?domain=stamp');
    expect(routes.sell('it 1')).toBe('/community/sell?itemId=it%201');
    expect(routes.cellarSommelier('')).toBe('/cellar-sommelier');
  });
});
