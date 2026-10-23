import { describe, expect, it } from 'vitest';
import { DEFAULT_BACK_FALLBACK, goBackOrFallback, type BackNavigator } from './backNavigation';

function fakeNavigator(canGoBack: boolean) {
  const calls: string[] = [];
  const navigator: BackNavigator = {
    canGoBack: () => canGoBack,
    back: () => calls.push('back'),
    replace: (href) => calls.push(`replace:${href}`),
  };
  return { navigator, calls };
}

describe('goBackOrFallback', () => {
  it('revient en arrière quand un historique existe', () => {
    const { navigator, calls } = fakeNavigator(true);
    expect(goBackOrFallback(navigator)).toBe('back');
    expect(calls).toEqual(['back']);
  });

  it('remplace par la collection quand l’historique est vide (lien direct)', () => {
    const { navigator, calls } = fakeNavigator(false);
    expect(goBackOrFallback(navigator)).toBe('fallback');
    expect(calls).toEqual([`replace:${DEFAULT_BACK_FALLBACK}`]);
  });

  it('respecte une destination de repli explicite', () => {
    const { navigator, calls } = fakeNavigator(false);
    goBackOrFallback(navigator, '/community');
    expect(calls).toEqual(['replace:/community']);
  });
});
