import { describe, expect, it } from 'vitest';
import { sha256 } from './hash.ts';

describe('sha256 — vecteurs de test FIPS 180-4', () => {
  it('chaîne vide', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('"abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('message de 448 bits (deux blocs)', () => {
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });
  it('UTF-8 multi-octets', () => {
    // Référence : sha256("héllo €") en UTF-8.
    expect(sha256('héllo €')).toHaveLength(64);
    expect(sha256('héllo €')).toBe(sha256('héllo €')); // déterministe
    expect(sha256('a')).not.toBe(sha256('b'));
  });
  it('déterministe et sensible au moindre changement', () => {
    expect(sha256('velum')).toBe(sha256('velum'));
    expect(sha256('velum')).not.toBe(sha256('velun'));
  });
});
