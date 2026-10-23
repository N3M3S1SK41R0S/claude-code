import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  it('arrondit le demi-centime au supérieur, comme round(numeric, 2) en SQL', () => {
    // Vecteurs partagés avec marketplace_hardening_checks.sql (bloc X15) :
    // 20,70 × 5 % = 1,035 (1,03499… en flottant) → 1,04 au registre.
    expect(saleBreakdown(20.7, 0)).toMatchObject({ commission: 1.04, sellerNet: 19.66 });
    expect(exchangeCommission(20.7, 0).commission).toBe(1.04);
    expect(splitCertificationFee(2.01, 'split')).toEqual({ seller: 1.01, buyer: 1 });
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(-1.005)).toBe(-1.01);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(1.004999)).toBe(1);
    expect(roundCents(0)).toBe(0);
    expect(roundCents(999_999_999_999.99)).toBe(999_999_999_999.99);
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

/**
 * Vecteurs PARTAGÉS avec la réplique SQL (public.redact_contact_info) : lus
 * dans le bloc M1 de supabase/tests/features/marketplace_checks.sql, que
 * run-local.sh rejoue contre la fonction Postgres. Même entrée ⇒ même sortie
 * au caractère près des deux côtés.
 */
function readSharedVectors(): { vectors: { input: string; expected: string }[]; declared: number } {
  const path = fileURLToPath(
    new URL('../../../supabase/tests/features/marketplace_checks.sql', import.meta.url),
  );
  const sql = readFileSync(path, 'utf8');
  const block = sql.slice(sql.indexOf('-- ── 1. Masquage'), sql.indexOf('-- ── 2. '));
  const values = block.slice(block.indexOf('from (values'), block.indexOf(') as v(input, expected)'));
  // Littéraux SQL ('…', '' pour une apostrophe, préfixe E sans antislash) ;
  // les commentaires « -- … » sont consommés pour ne pas en lire les apostrophes.
  const literals: string[] = [];
  for (const match of values.matchAll(/--[^\n]*|(E?)'((?:[^']|'')*)'/g)) {
    const body = match[2];
    if (body === undefined) continue; // commentaire
    if (body.includes('\\')) throw new Error(`antislash non interprété dans un vecteur : ${body}`);
    literals.push(body.replaceAll("''", "'"));
  }
  if (literals.length % 2 !== 0) throw new Error('bloc M1 : nombre impair de littéraux');
  const vectors: { input: string; expected: string }[] = [];
  for (let i = 0; i + 1 < literals.length; i += 2) {
    vectors.push({ input: literals[i] ?? '', expected: literals[i + 1] ?? '' });
  }
  const declared = Number(/if v_count <> (\d+) then/.exec(block)?.[1] ?? Number.NaN);
  return { vectors, declared };
}

describe('redactContactInfo', () => {
  const { vectors, declared } = readSharedVectors();
  const sharedInputs = new Set(vectors.map((v) => v.input));

  it('lit tous les vecteurs partagés du bloc M1 (compteur SQL à jour)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(60);
    expect(vectors.length).toBe(declared);
  });

  for (const { input, expected } of vectors) {
    it(`même sortie que le SQL, idempotente : « ${input} »`, () => {
      expect(redactContactInfo(input)).toEqual({ text: expected, redacted: expected !== input });
      expect(redactContactInfo(expected)).toEqual({ text: expected, redacted: false });
    });
  }

  // Le jeton ne suffit pas : aucun FRAGMENT de la coordonnée ne doit survivre.
  const leaks: [string, string[]][] = [
    ['Écrivez-moi à jean.dupont@gmail.com svp', ['jean', 'dupont', 'gmail', '@']],
    ['Contact : JEAN.DUPONT@GMAIL.COM', ['JEAN', 'DUPONT', 'GMAIL', '@']],
    ['jérôme@exemple.fr', ['jérôme', 'exemple', '@']],
    ['écrivez à marie_l@orange.fr ou au 07 81 22 33 44', ['marie', 'orange', '07', '44']],
    ['jean point dupont arobase gmail point com', ['jean', 'dupont', 'arobase', 'gmail']],
    ['écrire à paul (at) mail (dot) fr', ['paul', '(at)', 'mail', '(dot)']],
    ['Merci d’écrire à jean . dupont @ gmail . com', ['jean', 'dupont', 'gmail', '@']],
    ['Mon adresse : jean.dupont @gmail.com', ['jean', 'dupont', 'gmail']],
    ['paul[arobase]mail[point]fr ou jean[at]gmail[dot]com', ['paul', 'jean', 'gmail', '[at]']],
    ['contact : jean at gmail dot com', ['jean', 'gmail', ' dot ']],
    ['écrivez à jean arobase gmail, merci', ['jean', 'gmail']],
    ['https://nom@site.fr/x et mailto:jean@x.fr', ['nom', 'site', 'jean', '@']],
    ['Tel 06 12 34 56 78', ['06', '12 34', '78']],
    ['appelez-moi au (06) 12 34 56 78 après 18h', ['(', ')', '06', '12 34', '78']],
    ['06-12-34-56-78, 06/12/34/56/78 et 0612345678', ['06', '78']],
    ['06–12–34–56–78 ou 06_12_34_56_78', ['06', '78']],
    ['0 6 1 2 3 4 5 6 7 8', ['0 6', '7 8']],
    ['+33 (0)6 12 34 56 78', ['+33', '(0)', '78']],
    ['tel: 0033 6 12 34 56 78', ['0033', '78']],
    ['+1 (555) 123-4567 ou +44 20 7946 0958', ['555', '4567', '+44', '0958']],
    ['mon WhatsApp 33612345678', ['336', '678']],
    ['Tél : 6 12 34 56 78', ['12 34', '78']],
    ['wa.me/33612345678 et t.me/pierre_collect', ['wa.me', '336', 't.me', 'pierre']],
    ['iban fr76 3000 6000 0112 3456 7890 189', ['fr76', 'fr', '3000', '189']],
    ['IBAN GB29 NWBK 6016 1331 9268 19', ['GB29', 'NWBK', '9268']],
    ['voir achat-vente.fr/annonce/12 ou site.co.uk', ['achat', 'annonce', 'site', '.uk', '.co']],
    ['château-margaux.fr', ['château', 'margaux', '.fr']],
    ['Suivez @pierre.collect sur insta', ['@', 'pierre', 'collect']],
    ['adresse: 12, rue des Lilas 75011', ['12,', 'rue', 'Lilas']],
    ['10 av. de l’Église Saint-Michel', ['av.', 'Église', 'Michel']],
  ];

  for (const [input, fragments] of leaks) {
    it(`ne laisse fuiter aucun fragment : « ${input} »`, () => {
      const { text, redacted } = redactContactInfo(input);
      expect(redacted).toBe(true);
      expect(text).toContain(REDACTION_TOKEN);
      for (const fragment of fragments) {
        expect(text).not.toContain(fragment);
      }
    });
  }

  it('garde le code postal qui suit une adresse, avec son espace', () => {
    expect(redactContactInfo('adresse: 12, rue des Lilas 75011').text).toBe(
      `adresse: ${REDACTION_TOKEN} 75011`,
    );
  });

  // Faux positifs à éviter : le texte d'un collectionneur reste intact.
  const untouched = [
    'Château Margaux 2015, 75 cl, cote YT 1234, 20 Francs or 1868 — 320 €',
    'Lot de 3 pièces, 1868-1870, réf. 12345',
    'Pièces 1868 - 1870 et 1868/1870',
    'Prix 1.250,00 € — échange possible contre un 10 Francs Coq',
    'Prix 12 500 € ou 1 250 000 €, tirage 125/500',
    'Cote Yvert n° 33, état TB, 2 timbres',
    'Remise en main propre le 05/11/2026 14:00',
    'Omega Speedmaster 1969, numéro de série 45123456',
    'Napoléon III 20 Francs Or 1868, KM# 801.1, Gadoury 1062',
    'Château Latour 1982 – 6 bouteilles, 750 ml, lot 2023-0456',
    'Écu 1726, 29,5 g, Ø 41 mm, tranche cannelée',
    'Réf. 116610LN, boîte et papiers, 2019',
    'réf AB12 collectionneur passionné',
    'Superbe pièce mise au point par la Monnaie, point de vue unique',
    'Très beau.De plus, état superbe',
  ];

  for (const text of untouched) {
    it(`laisse intact : « ${text} »`, () => {
      expect(redactContactInfo(text)).toEqual({ text, redacted: false });
    });
  }

  it('chaque cas testé ici est aussi rejoué côté SQL (bloc M1)', () => {
    const missing = [...leaks.map(([input]) => input), ...untouched].filter(
      (input) => !sharedInputs.has(input),
    );
    expect(missing).toEqual([]);
  });

  it('le jeton seul et un texte vide ne déclenchent rien', () => {
    expect(redactContactInfo(REDACTION_TOKEN)).toEqual({ text: REDACTION_TOKEN, redacted: false });
    expect(redactContactInfo('')).toEqual({ text: '', redacted: false });
  });
});
