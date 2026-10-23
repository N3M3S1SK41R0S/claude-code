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

  it('envies : recherche initiale facultative (rétro-compatible), envie précise par identifiant', () => {
    expect(routes.wishlist()).toBe('/wishlist');
    expect(routes.wishlist(null, 'napoléon or')).toBe('/wishlist?q=napol%C3%A9on%20or');
    expect(routes.wishlist('wine', '  Tempier ')).toBe('/wishlist?domain=wine&q=Tempier');
    expect(routes.wishlist('coin', '   ')).toBe('/wishlist?domain=coin');
    expect(routes.wishlist(undefined, '')).toBe('/wishlist');
    expect(routes.wishlistEntry('w 1')).toBe('/wishlist/w%201');
  });
});
