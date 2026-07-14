import { describe, expect, it } from 'vitest';
import {
  appendEvent,
  createPassport,
  provenanceSummary,
  verifyPassport,
  type ProvenanceEvent,
} from './provenance.ts';

const genesis: ProvenanceEvent = { type: 'created', at: '2026-01-01T00:00:00Z', actor: 'owner-1' };

describe('passeport de provenance', () => {
  it('crée un passeport avec un maillon de genèse', () => {
    const p = createPassport('item-1', genesis);
    expect(p.chain).toHaveLength(1);
    expect(p.head).toHaveLength(64);
    expect(verifyPassport(p).valid).toBe(true);
  });

  it('chaîne les événements et reste vérifiable', () => {
    let p = createPassport('item-1', genesis);
    p = appendEvent(p, { type: 'appraised', at: '2026-02-01T00:00:00Z', valueEUR: 1200 });
    p = appendEvent(p, { type: 'sold', at: '2026-03-01T00:00:00Z', actor: 'owner-2', valueEUR: 1500 });
    expect(p.chain).toHaveLength(3);
    expect(p.chain[1]?.prevHash).toBe(p.chain[0]?.hash);
    expect(p.head).toBe(p.chain[2]?.hash);
    expect(verifyPassport(p).valid).toBe(true);
  });

  it('déterministe : mêmes entrées → mêmes hash (rejouable)', () => {
    const a = appendEvent(createPassport('item-1', genesis), { type: 'appraised', at: '2026-02-01T00:00:00Z', valueEUR: 1200 });
    const b = appendEvent(createPassport('item-1', genesis), { type: 'appraised', at: '2026-02-01T00:00:00Z', valueEUR: 1200 });
    expect(a.head).toBe(b.head);
  });

  it('détecte une falsification de contenu', () => {
    let p = createPassport('item-1', genesis);
    p = appendEvent(p, { type: 'appraised', at: '2026-02-01T00:00:00Z', valueEUR: 1200 });
    // Falsification : on gonfle la valeur sans recalculer le hash.
    const tampered = {
      ...p,
      chain: p.chain.map((l, i) =>
        i === 1 ? { ...l, event: { ...l.event, valueEUR: 99999 } } : l,
      ),
    };
    const v = verifyPassport(tampered);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(1);
  });

  it('détecte une rupture de chaînage (maillon supprimé)', () => {
    let p = createPassport('item-1', genesis);
    p = appendEvent(p, { type: 'appraised', at: '2026-02-01T00:00:00Z' });
    p = appendEvent(p, { type: 'sold', at: '2026-03-01T00:00:00Z' });
    const broken = { ...p, chain: [p.chain[0]!, p.chain[2]!] }; // on saute le maillon 1
    expect(verifyPassport(broken).valid).toBe(false);
  });

  it('produit un résumé lisible', () => {
    let p = createPassport('item-1', genesis);
    p = appendEvent(p, { type: 'appraised', at: '2026-02-01T00:00:00Z', valueEUR: 1200 });
    const s = provenanceSummary(p);
    expect(s).toHaveLength(2);
    expect(s[1]).toMatch(/appraised/);
    expect(s[1]).toMatch(/1200/);
  });
});
