import { describe, expect, it } from 'vitest';
import {
  REDACTION_TOKEN,
  certificationRequirement,
  defaultCertificationFeePayer,
  estimateCertificationFee,
  exchangeCommission,
  redactContactInfo,
  roundCents,
  saleBreakdown,
  splitCertificationFee,
} from './marketplace';

describe('saleBreakdown', () => {
  it('applique le taux dégressif du vendeur et déduit la commission du net', () => {
    expect(saleBreakdown(200, 0)).toEqual({
      price: 200,
      commissionRate: 0.05,
      commission: 10,
      certificationFee: 0,
      sellerNet: 190,
    });
    expect(saleBreakdown(1000, 60, 40)).toEqual({
      price: 1000,
      commissionRate: 0.02,
      commission: 20,
      certificationFee: 40,
      sellerNet: 940,
    });
  });

  it('arrondit au centime', () => {
    expect(saleBreakdown(19.99, 12).commission).toBe(0.8);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe('exchangeCommission', () => {
  it('chaque partie paie son taux sur la valeur de l’objet cédé', () => {
    expect(exchangeCommission(400, 0)).toEqual({ commissionRate: 0.05, commission: 20 });
    expect(exchangeCommission(400, 30)).toEqual({ commissionRate: 0.03, commission: 12 });
    expect(exchangeCommission(-5, 0).commission).toBe(0);
  });
});

describe('certificationRequirement', () => {
  it('impose l’expertise au-delà de 500 € (strictement)', () => {
    expect(certificationRequirement({ value: 500 })).toEqual({
      required: false,
      reason: null,
      referenceValue: 500,
    });
    expect(certificationRequirement({ value: 500.01 }).reason).toBe('threshold');
  });

  it('ne se contourne pas en sous-déclarant : l’estimation VELUM compte', () => {
    expect(certificationRequirement({ value: 300, estimatedValue: 750 })).toEqual({
      required: true,
      reason: 'threshold',
      referenceValue: 750,
    });
  });

  it('sous le seuil, possible sur accord des deux parties', () => {
    expect(certificationRequirement({ value: 120, mutualAgreement: true }).reason).toBe(
      'mutual_agreement',
    );
  });

  it('frais : vendeur au seuil, partagés sur accord mutuel', () => {
    expect(defaultCertificationFeePayer('threshold')).toBe('seller');
    expect(defaultCertificationFeePayer('mutual_agreement')).toBe('split');
    expect(splitCertificationFee(45, 'split')).toEqual({ seller: 22.5, buyer: 22.5 });
    expect(splitCertificationFee(45.01, 'split')).toEqual({ seller: 22.51, buyer: 22.5 });
    expect(splitCertificationFee(45, 'buyer')).toEqual({ seller: 0, buyer: 45 });
  });

  it('barème indicatif borné', () => {
    expect(estimateCertificationFee(100)).toBe(30);
    expect(estimateCertificationFee(5000)).toBe(100);
    expect(estimateCertificationFee(1_000_000)).toBe(400);
  });
});

describe('redactContactInfo', () => {
  const cases: [string, string][] = [
    ['Écrivez-moi à jean.dupont@gmail.com svp', 'e-mail'],
    ['jean point dupont arobase gmail point com', 'e-mail en toutes lettres'],
    ['Tel 06 12 34 56 78', 'téléphone espacé'],
    ['+33612345678', 'téléphone international'],
    ['06.12.34.56.78', 'téléphone pointé'],
    ['voir https://exemple.fr/annonce', 'URL'],
    ['mon site www.collection-pierre.fr', 'www'],
    ['passez sur monshop.com', 'domaine nu'],
    ['IBAN FR76 3000 6000 0112 3456 7890 189', 'IBAN'],
    ['insta @pierre_collect', 'pseudo réseau social'],
    ['RDV au 12 rue de la Paix', 'adresse'],
  ];

  for (const [text, label] of cases) {
    it(`masque : ${label}`, () => {
      const result = redactContactInfo(text);
      expect(result.redacted).toBe(true);
      expect(result.text).toContain(REDACTION_TOKEN);
    });
  }

  it('laisse intact un texte sans coordonnées (millésimes, prix, références)', () => {
    const text = 'Château Margaux 2015, 75 cl, cote YT 1234, 20 Francs or 1868 — 320 €';
    expect(redactContactInfo(text)).toEqual({ text, redacted: false });
  });

  it('est idempotent', () => {
    const once = redactContactInfo('mail: a.b@c.fr').text;
    expect(redactContactInfo(once)).toEqual({ text: once, redacted: false });
  });
});
