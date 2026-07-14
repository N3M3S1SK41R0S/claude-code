import { describe, expect, it } from 'vitest';
import { buildMuseumGallery, buildShareCard, confidenceBadge, type ShareCardInput } from './card.ts';

function input(partial: Partial<ShareCardInput> & Pick<ShareCardInput, 'itemId' | 'domain' | 'ci80' | 'reliability'>): ShareCardInput {
  return { title: partial.itemId, ...partial };
}

describe('confidenceBadge', () => {
  it('seuils high/medium/low', () => {
    expect(confidenceBadge(80)).toBe('high');
    expect(confidenceBadge(50)).toBe('medium');
    expect(confidenceBadge(20)).toBe('low');
  });
});

describe('buildShareCard', () => {
  it('affiche une FOURCHETTE, jamais un prix sec', () => {
    const c = buildShareCard(input({ itemId: 'w1', domain: 'wine', ci80: [250, 350], reliability: 80 }));
    expect(c.valueRange).toEqual([250, 350]);
    expect(c.badge).toBe('high');
    // La légende ne contient pas de valeur "centrale" unique, mais un intervalle.
    expect(c.caption).toMatch(/250.*350/);
    expect(c.caption).toMatch(/estimation/i);
  });

  it('ajoute le deep-link de provenance si passeport présent', () => {
    const c = buildShareCard(input({ itemId: 'w1', domain: 'wine', ci80: [10, 20], reliability: 60, provenanceHead: 'abcd' }));
    expect(c.provenanceLink).toBe('velum://provenance/abcd');
  });

  it('sans passeport → pas de deep-link', () => {
    const c = buildShareCard(input({ itemId: 'w1', domain: 'wine', ci80: [10, 20], reliability: 60 }));
    expect(c.provenanceLink).toBeUndefined();
  });
});

describe('buildMuseumGallery', () => {
  it('trie les pièces maîtresses (valeur médiane) en premier', () => {
    const g = buildMuseumGallery([
      input({ itemId: 'small', domain: 'coin', ci80: [10, 30], reliability: 70 }),
      input({ itemId: 'big', domain: 'art', ci80: [1000, 2000], reliability: 50 }),
      input({ itemId: 'mid', domain: 'wine', ci80: [100, 200], reliability: 60 }),
    ]);
    expect(g.map((e) => e.itemId)).toEqual(['big', 'mid', 'small']);
    expect(g[0]?.badge).toBe('medium');
  });

  it('n’expose pas de champ interne de tri', () => {
    const g = buildMuseumGallery([{ ...input({ itemId: 'a', domain: 'coin', ci80: [10, 30], reliability: 70 }), media: ['p1.jpg'] }]);
    expect(Object.keys(g[0] ?? {})).not.toContain('_mid');
    expect(g[0]?.media).toEqual(['p1.jpg']);
  });
});
