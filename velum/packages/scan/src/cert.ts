/**
 * Scan de vérification de certification PCGS / NGC — Quick Win #3.
 *
 * Le seul « table-stake » numismatique explicitement manquant : lire le
 * numéro de certification (QR / code-barres / URL / saisie) d'un slab gradé
 * et le normaliser vers l'URL de vérification officielle. Socle de la Vigie
 * anti-faux (détection de slab-swap : comparer le grade déclaré au certificat).
 *
 * Logique PURE : `parseCertScan` prend le contenu déjà décodé du QR/code-barres.
 */
export type GradingService = 'PCGS' | 'NGC';

export interface CertScan {
  service: GradingService;
  /** Numéro de certification normalisé. */
  certNumber: string;
  /** Grade encodé dans le label, si présent. */
  grade?: string;
  /** URL de vérification officielle. */
  verifyUrl: string;
}

/** Construit l'URL de vérification officielle d'un certificat. */
export function certVerifyUrl(service: GradingService, certNumber: string): string {
  return service === 'PCGS'
    ? `https://www.pcgs.com/cert/${certNumber}`
    : `https://www.ngccoin.com/certlookup/${certNumber}/`;
}

// NGC : numéro de soumission-pièce "1234567-001".
const NGC_NUMBER = /\b(\d{7}-\d{2,3})\b/;
// PCGS : numéro de certification à 7-8 chiffres, éventuellement suffixé "/<grade>".
const PCGS_NUMBER = /\b(\d{7,8})(?:\/(\d{1,2}))?\b/;

/**
 * Parse le contenu d'un scan de certificat (URL PCGS/NGC ou numéro brut) en
 * données structurées. Retourne null si aucun format reconnu — jamais de
 * devinette (principe #1).
 */
export function parseCertScan(raw: string): CertScan | null {
  const input = raw.trim();
  if (input === '') return null;
  const lower = input.toLowerCase();

  // 1) URLs officielles.
  if (lower.includes('ngccoin.com')) {
    const m = NGC_NUMBER.exec(input);
    if (m && m[1]) return { service: 'NGC', certNumber: m[1], verifyUrl: certVerifyUrl('NGC', m[1]) };
  }
  if (lower.includes('pcgs.com')) {
    const m = PCGS_NUMBER.exec(input);
    if (m && m[1]) {
      return {
        service: 'PCGS',
        certNumber: m[1],
        ...(m[2] ? { grade: m[2] } : {}),
        verifyUrl: certVerifyUrl('PCGS', m[1]),
      };
    }
  }

  // 2) Préfixe explicite ("NGC 1234567-001", "PCGS 12345678/65").
  if (/\bngc\b/i.test(input)) {
    const m = NGC_NUMBER.exec(input);
    if (m && m[1]) return { service: 'NGC', certNumber: m[1], verifyUrl: certVerifyUrl('NGC', m[1]) };
  }
  if (/\bpcgs\b/i.test(input)) {
    const m = PCGS_NUMBER.exec(input);
    if (m && m[1]) {
      return {
        service: 'PCGS',
        certNumber: m[1],
        ...(m[2] ? { grade: m[2] } : {}),
        verifyUrl: certVerifyUrl('PCGS', m[1]),
      };
    }
  }

  // 3) Numéro brut : le tiret "1234567-001" est la signature NGC.
  const ngc = NGC_NUMBER.exec(input);
  if (ngc && ngc[1]) return { service: 'NGC', certNumber: ngc[1], verifyUrl: certVerifyUrl('NGC', ngc[1]) };

  // 4) Numéro purement numérique 7-8 chiffres → PCGS par convention.
  if (/^\d{7,8}$/.test(input)) {
    return { service: 'PCGS', certNumber: input, verifyUrl: certVerifyUrl('PCGS', input) };
  }

  return null;
}

/**
 * Détection de slab-swap : le grade déclaré par le vendeur/label correspond-il
 * au grade retourné par le certificat ? Un écart est un signal (jamais un
 * verdict). Comparaison textuelle normalisée (majuscules, espaces).
 */
export function detectSlabSwap(certifiedGrade: string, declaredGrade: string): {
  match: boolean;
  note: string;
} {
  const norm = (s: string): string => s.trim().toUpperCase().replace(/\s+/g, '');
  const match = norm(certifiedGrade) === norm(declaredGrade);
  return {
    match,
    note: match
      ? 'Grade déclaré cohérent avec le certificat.'
      : `Écart grade déclaré (${declaredGrade}) vs certifié (${certifiedGrade}) — vérifiez que la pièce n’a pas été changée de coque (slab-swap).`,
  };
}
