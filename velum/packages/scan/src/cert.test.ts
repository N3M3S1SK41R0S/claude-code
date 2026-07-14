import { describe, expect, it } from 'vitest';
import { detectSlabSwap, parseCertScan } from './cert';

describe('parseCertScan', () => {
  it('URL NGC', () => {
    const c = parseCertScan('https://www.ngccoin.com/certlookup/1234567-001/');
    expect(c?.service).toBe('NGC');
    expect(c?.certNumber).toBe('1234567-001');
    expect(c?.verifyUrl).toContain('ngccoin.com/certlookup/1234567-001');
  });

  it('URL PCGS avec grade', () => {
    const c = parseCertScan('https://www.pcgs.com/cert/12345678/65');
    expect(c?.service).toBe('PCGS');
    expect(c?.certNumber).toBe('12345678');
    expect(c?.grade).toBe('65');
  });

  it('préfixe explicite NGC', () => {
    const c = parseCertScan('NGC 1234567-01');
    expect(c?.service).toBe('NGC');
    expect(c?.certNumber).toBe('1234567-01');
  });

  it('numéro brut avec tiret = NGC', () => {
    expect(parseCertScan('7654321-002')?.service).toBe('NGC');
  });

  it('numéro purement numérique 8 chiffres = PCGS', () => {
    const c = parseCertScan('81234567');
    expect(c?.service).toBe('PCGS');
    expect(c?.certNumber).toBe('81234567');
  });

  it('entrée non reconnue → null (jamais de devinette)', () => {
    expect(parseCertScan('bonjour')).toBeNull();
    expect(parseCertScan('')).toBeNull();
    expect(parseCertScan('123')).toBeNull();
  });
});

describe('detectSlabSwap', () => {
  it('grades cohérents', () => {
    expect(detectSlabSwap('MS 65', 'MS65').match).toBe(true);
  });
  it('écart de grade → signale le slab-swap', () => {
    const r = detectSlabSwap('MS65', 'MS67');
    expect(r.match).toBe(false);
    expect(r.note).toMatch(/slab-swap/i);
  });
});
