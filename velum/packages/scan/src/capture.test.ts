import { describe, expect, it } from 'vitest';
import { assessFrame, sequenceProgress } from './capture.ts';

describe('assessFrame', () => {
  it('accepte une trame nette, sans reflet, bien cadrée', () => {
    const d = assessFrame({ sharpness: 0.85, glare: 0.1, coverage: 0.6 });
    expect(d.accept).toBe(true);
    expect(d.issues).toEqual([]);
    expect(d.quality).toBeGreaterThan(0.7);
  });

  it('refuse le flou et guide', () => {
    const d = assessFrame({ sharpness: 0.3, glare: 0.1, coverage: 0.6 });
    expect(d.accept).toBe(false);
    expect(d.issues).toContain('blurry');
    expect(d.guidance.join(' ')).toMatch(/floue/i);
  });

  it('détecte reflet, trop loin, trop près', () => {
    expect(assessFrame({ sharpness: 0.9, glare: 0.8, coverage: 0.6 }).issues).toContain('glare');
    expect(assessFrame({ sharpness: 0.9, glare: 0.1, coverage: 0.1 }).issues).toContain('too_far');
    expect(assessFrame({ sharpness: 0.9, glare: 0.1, coverage: 0.98 }).issues).toContain('too_close');
  });

  it('cumule plusieurs défauts', () => {
    const d = assessFrame({ sharpness: 0.2, glare: 0.9, coverage: 0.1 });
    expect(d.issues.length).toBeGreaterThanOrEqual(3);
    expect(d.accept).toBe(false);
  });
});

describe('sequenceProgress', () => {
  it('pièce : avers/revers/tranche — indique le prochain angle', () => {
    const p = sequenceProgress('coin', ['obverse']);
    expect(p.complete).toBe(false);
    expect(p.missing).toEqual(['reverse', 'edge']);
    expect(p.nextRole).toBe('reverse');
    expect(p.guidance).toMatch(/revers/i);
  });

  it('séquence complète', () => {
    const p = sequenceProgress('coin', ['obverse', 'reverse', 'edge']);
    expect(p.complete).toBe(true);
    expect(p.missing).toEqual([]);
    expect(p.nextRole).toBeUndefined();
  });

  it('ignore les rôles superflus, ne compte que les requis', () => {
    const p = sequenceProgress('wine', ['label', 'detail']);
    expect(p.captured).toEqual(['label']);
    expect(p.missing).toEqual(['capsule']);
  });

  it('timbre : recto/verso', () => {
    expect(sequenceProgress('stamp', []).missing).toEqual(['front', 'back']);
  });
});
