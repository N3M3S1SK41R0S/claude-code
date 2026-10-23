import { describe, expect, it } from 'vitest';
import {
  MARKET_CARRIERS as API_MARKET_CARRIERS,
  MARKET_MAX_AMOUNT,
  MARKET_MIN_ASK_PRICE,
  normalizeTrackingNumber as apiNormalizeTrackingNumber,
} from '@velum/api-client';
import { REDACTION_TOKEN } from '@velum/config';
import type { VelumItem } from '@velum/core';

import {
  MARKET_CARRIERS,
  amountProblemMessage,
  amountToInput,
  checkMarketAmount,
  estimateFromValuation,
  exchangePreview,
  formatPrice,
  formatRate,
  nextCommissionTier,
  normalizeTrackingNumber,
  orderCommission,
  parseFrenchAmount,
  parsePositiveAmount,
  redactionPreview,
  sellPreview,
  shipmentInput,
  signedCashAdjustment,
  sortItemsForExchange,
} from './marketForms';

/** Normalise les espaces insécables d'Intl pour comparer. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('parseFrenchAmount', () => {
  it.each([
    ['1 250,50', 1250.5],
    ['1250,5', 1250.5],
    ['1250.5', 1250.5],
    ['1.250,50', 1250.5],
    ['1,250.50', 1250.5],
    ['1.250.000', 1250000],
    ['1 250 €', 1250],
    ['1 250 EUR', 1250],
    ['  320  ', 320],
    ['0', 0],
    ['12,345', 12.35],
  ])('« %s » → %d', (raw, expected) => {
    expect(parseFrenchAmount(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '-5', '1,2,3', '12a', '1.2.3,4,5', '€'])('« %s » → null', (raw) => {
    expect(parseFrenchAmount(raw)).toBeNull();
  });

  it('prix ou valeur déclarée : bornes serveur (1 € minimum, numeric(14, 2) maximum)', () => {
    expect(MARKET_MIN_ASK_PRICE).toBe(1);
    expect(parsePositiveAmount('0')).toBeNull();
    expect(parsePositiveAmount('0,01')).toBeNull();
    expect(parsePositiveAmount('0,99')).toBeNull();
    expect(parsePositiveAmount('1')).toBe(1);
    expect(parsePositiveAmount('0,995')).toBe(1); // arrondi au centime d’abord, comme numeric(14, 2)
    expect(parsePositiveAmount('999 999 999 999,99')).toBe(MARKET_MAX_AMOUNT);
    expect(parsePositiveAmount('1 000 000 000 000')).toBeNull();
    expect(checkMarketAmount('abc')).toEqual({ ok: false, problem: 'invalid' });
    expect(checkMarketAmount('')).toEqual({ ok: false, problem: 'invalid' });
    expect(checkMarketAmount('0,50')).toEqual({ ok: false, problem: 'belowMin' });
    expect(checkMarketAmount('1 000 000 000 000')).toEqual({ ok: false, problem: 'aboveMax' });
    expect(checkMarketAmount('1 250,50')).toEqual({ ok: true, value: 1250.5 });
  });

  it('message clair d’un montant refusé : minimum et maximum chiffrés', () => {
    const below = amountProblemMessage('belowMin', 'fr');
    expect(below.key).toBe('community.amountBelowMin');
    expect(plain(below.params?.['min'] ?? '')).toBe('1 €');
    const above = amountProblemMessage('aboveMax', 'fr');
    expect(above.key).toBe('community.amountAboveMax');
    expect(plain(above.params?.['max'] ?? '')).toBe('999 999 999 999,99 €');
    expect(amountProblemMessage('invalid', 'en')).toEqual({ key: 'community.invalidAmount' });
  });

  it('pré-remplit un champ à partir d’une valeur', () => {
    expect(amountToInput(1250)).toBe('1250');
    expect(amountToInput(1250.5)).toBe('1250,50');
    expect(amountToInput(null)).toBe('');
    expect(amountToInput(0)).toBe('');
    expect(amountToInput(Number.NaN)).toBe('');
  });

  it('retient l’estimation centrale d’une valorisation', () => {
    expect(estimateFromValuation({ central: 412.456 })).toBe(412.46);
    expect(estimateFromValuation({ central: 0 })).toBeNull();
    expect(estimateFromValuation(null)).toBeNull();
  });

  it('formate au centime et en pourcentage selon la locale', () => {
    expect(plain(formatPrice(15.5, 'fr'))).toBe('15,50 €');
    expect(plain(formatPrice(16, 'fr'))).toBe('16 €');
    expect(formatPrice(15.5, 'en')).toBe('€15.50');
    expect(plain(formatPrice(1250.5, 'fr'))).toBe('1 250,50 €');
    expect(formatPrice(12, 'en', 'USD')).toBe('US$12');
    expect(formatPrice(12, 'fr', 'XX')).toBe('12 XX');
    expect(plain(formatRate(0.05, 'fr'))).toBe('5 %');
    expect(formatRate(0.035, 'en')).toBe('3.5%');
  });
});

describe('commission d’une commande', () => {
  it('au centime, demi-centime au supérieur : identique au registre SQL (round(numeric, 2))', () => {
    // Vecteur partagé avec marketplace_hardening_checks (X15) : 20,70 × 5 % = 1,035 → 1,04.
    expect(orderCommission({ amount: 20.7, commissionRate: 0.05 })).toBe(1.04);
    expect(orderCommission({ amount: 150, commissionRate: 0.05 })).toBe(7.5);
    expect(orderCommission({ amount: 333.33, commissionRate: 0.03 })).toBe(10);
    expect(orderCommission({ amount: -5, commissionRate: 0.05 })).toBe(0);
  });
});

describe('commission dégressive', () => {
  it('annonce le palier suivant et les ventes restantes', () => {
    expect(nextCommissionTier(0)).toEqual({ rate: 0.04, minSales: 10, salesNeeded: 10 });
    expect(nextCommissionTier(9)).toEqual({ rate: 0.04, minSales: 10, salesNeeded: 1 });
    expect(nextCommissionTier(10)).toEqual({ rate: 0.03, minSales: 25, salesNeeded: 15 });
    expect(nextCommissionTier(49)).toEqual({ rate: 0.02, minSales: 50, salesNeeded: 1 });
    expect(nextCommissionTier(50)).toBeNull();
  });
});

describe('sellPreview', () => {
  it('vente sous le seuil : décomposition sans expertise', () => {
    const p = sellPreview({
      kind: 'sale',
      priceInput: '320',
      completedSales: 3,
      estimatedValue: 300,
      voluntaryCertification: false,
    });
    expect(p.certification).toBe('none');
    expect(p.certificationFee).toBe(0);
    expect(p.sale).toEqual({ price: 320, commissionRate: 0.05, commission: 16, certificationFee: 0, sellerNet: 304 });
    expect(p.exchange).toBeNull();
    expect(p.nextTier?.salesNeeded).toBe(7);
  });

  it('au-delà de 500 € (estimation incluse) : expertise obligatoire, frais déduits', () => {
    const p = sellPreview({
      kind: 'sale_or_exchange',
      priceInput: '450',
      completedSales: 12,
      estimatedValue: 900, // on ne contourne pas le seuil en sous-déclarant
      voluntaryCertification: false,
    });
    expect(p.requirement).toEqual({ required: true, reason: 'threshold', referenceValue: 900 });
    expect(p.certification).toBe('required');
    expect(p.certificationFee).toBe(30); // 2 % de 900 = 18 → minimum 30 €
    expect(p.sale).toEqual({ price: 450, commissionRate: 0.04, commission: 18, certificationFee: 30, sellerNet: 402 });
    expect(p.exchange).toEqual({ commissionRate: 0.04, commission: 18 });
  });

  it('certification volontaire sous le seuil ; échange seul sans décomposition de vente', () => {
    const p = sellPreview({
      kind: 'exchange',
      priceInput: '200',
      completedSales: 0,
      estimatedValue: null,
      voluntaryCertification: true,
    });
    expect(p.certification).toBe('voluntary');
    expect(p.certificationFee).toBe(30);
    expect(p.sale).toBeNull();
    expect(p.exchange).toEqual({ commissionRate: 0.05, commission: 10 });
  });

  it('prix invalide : aucun calcul trompeur', () => {
    const p = sellPreview({
      kind: 'sale',
      priceInput: 'abc',
      completedSales: 0,
      estimatedValue: null,
      voluntaryCertification: true,
    });
    expect(p.value).toBeNull();
    expect(p.sale).toBeNull();
    expect(p.certificationFee).toBe(0);
  });

  it('objet déjà certifié : la certification le suit — ni « obligatoire » ni frais', () => {
    const p = sellPreview({
      kind: 'sale',
      priceInput: '900',
      completedSales: 0,
      estimatedValue: 950,
      voluntaryCertification: true,
      alreadyCertified: true,
    });
    expect(p.certification).toBe('already');
    expect(p.requirement.required).toBe(false);
    expect(p.certificationFee).toBe(0);
    expect(p.sale).toEqual({ price: 900, commissionRate: 0.05, commission: 45, certificationFee: 0, sellerNet: 855 });
  });
});

describe('proposition d’échange', () => {
  it('soulte signée selon le sens', () => {
    expect(signedCashAdjustment('add', '50')).toBe(50);
    expect(signedCashAdjustment('ask', '50')).toBe(-50);
    expect(signedCashAdjustment('ask', '')).toBe(0);
    expect(signedCashAdjustment('add', '0')).toBe(0);
    expect(signedCashAdjustment('add', 'abc')).toBeNull();
  });

  it('aperçu : ma commission, équilibre, expertise par accord mutuel', () => {
    const p = exchangePreview({
      listingValue: 320,
      offeredValueInput: '250',
      cashDirection: 'add',
      cashInput: '50',
      completedSales: 0,
      mutualCertification: true,
    });
    expect(p.myCommission).toEqual({ commissionRate: 0.05, commission: 12.5 });
    expect(p.balance).toBe(-20);
    expect(p.requirement.reason).toBe('mutual_agreement');
    expect(p.certificationFee).toBe(30);
    expect(p.myCertificationShare).toBe(15);
  });

  it('expertise obligatoire si l’un des deux objets dépasse le seuil', () => {
    const p = exchangePreview({
      listingValue: 300,
      offeredValueInput: '800',
      cashDirection: 'ask',
      cashInput: '',
      completedSales: 0,
      mutualCertification: false,
    });
    expect(p.requirement).toEqual({ required: true, reason: 'threshold', referenceValue: 800 });
    expect(p.myCertificationShare).toBe(0);
    expect(p.balance).toBe(500);
  });

  it('seuil évalué objet par objet : mon objet = max(valeur déclarée, estimation VELUM)', () => {
    // Estimé 800 €, déclaré 400 € contre une annonce à 300 € : le serveur
    // ouvre une expertise de seuil sur MON objet, à ma charge.
    const p = exchangePreview({
      listingValue: 300,
      listingCertified: false,
      offeredValueInput: '400',
      offeredEstimate: 800,
      cashDirection: 'add',
      cashInput: '',
      completedSales: 0,
    });
    expect(p.requirement).toEqual({ required: true, reason: 'threshold', referenceValue: 800 });
    expect(p.thresholdItems).toEqual({ mine: true, theirs: false });
    expect(p.certificationFee).toBe(30); // à ma charge (frais indicatifs)
  });

  it('annonce déjà certifiée : aucune expertise de seuil pour elle', () => {
    const certified = exchangePreview({
      listingValue: 780,
      listingCertified: true,
      offeredValueInput: '50',
      offeredEstimate: null,
      cashDirection: 'add',
      cashInput: '',
      completedSales: 0,
    });
    expect(certified.requirement.required).toBe(false);
    expect(certified.certificationFee).toBe(0);
    // Non certifiée : expertise de l'objet de l'annonce, à la charge de son propriétaire (pas la mienne).
    const notCertified = exchangePreview({
      listingValue: 780,
      listingCertified: false,
      offeredValueInput: '50',
      offeredEstimate: null,
      cashDirection: 'add',
      cashInput: '',
      completedSales: 0,
    });
    expect(notCertified.requirement.reason).toBe('threshold');
    expect(notCertified.thresholdItems).toEqual({ mine: false, theirs: true });
    expect(notCertified.certificationFee).toBe(0);
  });

  it('mon objet déjà certifié : pas de nouvelle expertise malgré l’estimation', () => {
    const p = exchangePreview({
      listingValue: 300,
      listingCertified: false,
      offeredValueInput: '400',
      offeredEstimate: 800,
      offeredCertified: true,
      cashDirection: 'add',
      cashInput: '',
      completedSales: 0,
    });
    expect(p.requirement.required).toBe(false);
    expect(p.thresholdItems).toEqual({ mine: false, theirs: false });
  });

  it('valeur invalide : pas de commission ni d’équilibre', () => {
    const p = exchangePreview({
      listingValue: 300,
      offeredValueInput: '',
      cashDirection: 'add',
      cashInput: '',
      completedSales: 0,
      mutualCertification: false,
    });
    expect(p.myCommission).toBeNull();
    expect(p.balance).toBeNull();
    expect(p.requirement.required).toBe(false);
  });

  it('propose d’abord mes objets de la même catégorie', () => {
    const item = (id: string, domain: VelumItem['domain']) => ({ id, domain }) as VelumItem;
    const sorted = sortItemsForExchange([item('a', 'wine'), item('b', 'coin'), item('c', 'wine'), item('d', 'coin')], 'coin');
    expect(sorted.map((i) => i.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(sortItemsForExchange([item('a', 'wine')], null).map((i) => i.id)).toEqual(['a']);
  });
});

describe('expédition', () => {
  it('normalise le numéro de suivi (blancs retirés, majuscules) et refuse le texte libre', () => {
    expect(normalizeTrackingNumber(' 6a 1234 5678 901 ')).toBe('6A12345678901');
    expect(normalizeTrackingNumber('ll123456789fr')).toBe('LL123456789FR');
    expect(normalizeTrackingNumber('')).toBeNull();
    expect(normalizeTrackingNumber('AB1')).toBeNull();
    expect(normalizeTrackingNumber('appelez-moi@exemple.com')).toBeNull();
    expect(normalizeTrackingNumber('Colis remis en main propre')).toBeNull();
  });

  it('une seule liste de transporteurs : celle de @velum/api-client (réplique de market_carriers())', () => {
    expect(MARKET_CARRIERS).toBe(API_MARKET_CARRIERS);
    expect(MARKET_CARRIERS).not.toContain('Royal Mail');
  });

  it('règle UI (au moins un chiffre) = sous-ensemble strict du format serveur', () => {
    const samples = [
      ' 6a 1234 5678 901 ',
      'LL123456789FR',
      'ab-1234',
      'ABCD',
      'abcd-efgh',
      '1234',
      '-1234',
      'A'.repeat(39) + '1',
      'A'.repeat(40) + '1',
      'écrivez-moi',
      'bob@yahoo.fr',
      'www.site.fr',
      '',
    ];
    for (const sample of samples) {
      const ui = normalizeTrackingNumber(sample);
      if (ui !== null) {
        // Tout suivi accepté par l’UI l’est par le dépôt / le serveur, à l’identique.
        expect(apiNormalizeTrackingNumber(sample)).toBe(ui);
        expect(ui).toMatch(/^[A-Z0-9][A-Z0-9-]{3,39}$/);
        expect(ui).toMatch(/[0-9]/);
      }
    }
    expect(normalizeTrackingNumber('ABCD')).toBeNull(); // valide côté serveur, sans chiffre : refusé ici
    expect(apiNormalizeTrackingNumber('ABCD')).toBe('ABCD');
    expect(normalizeTrackingNumber('-1234')).toBeNull();
    expect(normalizeTrackingNumber('A'.repeat(40) + '1')).toBeNull();
  });

  it('n’envoie que le suivi et le transporteur choisi — jamais de date de livraison', () => {
    // Le serveur (guard_order_terms) refuse toute date de livraison posée par
    // le vendeur : seule celle de l’acheteur ou du transporteur compte.
    const withCarrier = shipmentInput(' ll 123 456 789 fr', 'Colissimo');
    expect(withCarrier).toEqual({ trackingNumber: 'LL123456789FR', carrier: 'Colissimo' });
    expect(withCarrier).not.toHaveProperty('deliveredAt');
    expect(shipmentInput('LL123456789FR', null)).toEqual({ trackingNumber: 'LL123456789FR' });
    expect(shipmentInput('  ', 'La Poste')).toBeNull();
    expect(MARKET_CARRIERS).toContain('Colissimo');
  });
});

describe('redactionPreview', () => {
  it('montre le texte masqué seulement si des coordonnées y figurent', () => {
    expect(redactionPreview('Très bel état, appelez le 06 12 34 56 78')).toBe(
      `Très bel état, appelez le ${REDACTION_TOKEN}`,
    );
    expect(redactionPreview('Très bel état')).toBeNull();
    expect(redactionPreview('   ')).toBeNull();
  });
});
