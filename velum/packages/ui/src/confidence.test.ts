/** Tests des paliers du badge de confiance (§3.3). */
import { describe, expect, it } from 'vitest';

import { confidenceTone, formatConfidence } from './confidence';

describe('confidenceTone', () => {
  it('≥ 0.7 → success (borne incluse)', () => {
    expect(confidenceTone(0.7)).toBe('success');
    expect(confidenceTone(0.85)).toBe('success');
    expect(confidenceTone(1)).toBe('success');
  });

  it('≥ 0.4 et < 0.7 → warning (bornes)', () => {
    expect(confidenceTone(0.4)).toBe('warning');
    expect(confidenceTone(0.55)).toBe('warning');
    expect(confidenceTone(0.699)).toBe('warning');
  });

  it('< 0.4 → danger', () => {
    expect(confidenceTone(0.399)).toBe('danger');
    expect(confidenceTone(0.1)).toBe('danger');
    expect(confidenceTone(0)).toBe('danger');
  });
});

describe('formatConfidence', () => {
  it('formate en « NN % » arrondi', () => {
    expect(formatConfidence(0.724)).toBe('72 %');
    expect(formatConfidence(0.5)).toBe('50 %');
    expect(formatConfidence(1)).toBe('100 %');
    expect(formatConfidence(0)).toBe('0 %');
  });

  it('borne les valeurs hors [0, 1]', () => {
    expect(formatConfidence(1.4)).toBe('100 %');
    expect(formatConfidence(-0.2)).toBe('0 %');
  });
});
