/**
 * Règles PURES des plateformes d'échange et de vente (Platine) — source
 * applicative unique, répliquée côté SQL (triggers / fonctions) : toute
 * évolution ici impose la même évolution dans la migration correspondante,
 * avec des vecteurs de test partagés.
 *
 * Décisions produit (octobre 2026) :
 *  - VENTE : le vendeur paie son taux dégressif (5 % → 2 %) sur le prix,
 *    prélevé à la libération du séquestre ; l'acheteur paie le prix affiché.
 *  - ÉCHANGE : chaque partie paie SON taux dégressif sur la valeur déclarée
 *    de l'objet qu'elle CÈDE (symétrique d'une vente) ; la soulte n'est pas
 *    commissionnée (ce n'est pas une vente de bien).
 *  - CERTIFICATION : obligatoire quand la valeur de référence (max de la
 *    valeur déclarée et de l'estimation VELUM — on ne contourne pas le seuil
 *    en sous-déclarant) DÉPASSE le seuil ; sous le seuil, possible sur accord
 *    des deux parties. Frais : vendeur (seuil), partagés (accord mutuel).
 *  - ANONYMAT : toute coordonnée saisie dans un texte libre est masquée.
 */
import { EXPERT_APPRAISAL_THRESHOLD_EUR, commissionRateFor } from './index';

/**
 * Miroirs structurels de `CertificationReason` / `CertificationFeePayer`
 * (@velum/core market.ts) — @velum/config ne dépend d'aucun paquet.
 */
export type CertificationReasonId = 'threshold' | 'mutual_agreement' | 'voluntary';
export type CertificationFeePayerId = 'seller' | 'buyer' | 'split';

/**
 * Arrondi monétaire au centime (évite les 12.000000001 €), demi-centime au
 * SUPÉRIEUR en valeur absolue — exactement round(numeric, 2) côté SQL. Le
 * produit flottant est d'abord ramené à 15 chiffres significatifs (1,035 vaut
 * 1,03499… en binaire, que Math.round arrondissait à 1,03 quand le registre
 * inscrit 1,04) : montants affichés et registre concordent au centime.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  return (Math.sign(value) * cents) / 100;
}

/** Décomposition d'une vente, affichée au vendeur AVANT publication. */
export interface SaleBreakdown {
  /** Prix payé par l'acheteur (EUR). */
  price: number;
  /** Taux dégressif du vendeur, figé à la création de l'annonce. */
  commissionRate: number;
  commission: number;
  /** Frais d'expertise à la charge du vendeur (0 si non requise). */
  certificationFee: number;
  /** Montant net versé au vendeur à la libération. */
  sellerNet: number;
}

export function saleBreakdown(
  price: number,
  completedSales: number,
  certificationFee = 0,
): SaleBreakdown {
  const commissionRate = commissionRateFor(completedSales);
  const commission = roundCents(Math.max(0, price) * commissionRate);
  const fee = roundCents(Math.max(0, certificationFee));
  return {
    price: roundCents(price),
    commissionRate,
    commission,
    certificationFee: fee,
    sellerNet: roundCents(Math.max(0, price - commission - fee)),
  };
}

/** Commission d'UNE partie d'un échange (base : valeur de l'objet cédé). */
export interface ExchangeCommission {
  commissionRate: number;
  commission: number;
}

export function exchangeCommission(
  declaredValueCeded: number,
  completedSales: number,
): ExchangeCommission {
  const commissionRate = commissionRateFor(completedSales);
  return {
    commissionRate,
    commission: roundCents(Math.max(0, declaredValueCeded) * commissionRate),
  };
}

/** Décision de certification pour un objet mis en transaction. */
export interface CertificationRequirement {
  required: boolean;
  /** 'threshold' si imposée par le seuil, 'mutual_agreement' si convenue, sinon null. */
  reason: Exclude<CertificationReasonId, 'voluntary'> | null;
  /** Valeur retenue pour la comparaison au seuil (EUR). */
  referenceValue: number;
}

export function certificationRequirement(input: {
  /** Prix demandé ou valeur déclarée (EUR). */
  value: number;
  /** Estimation centrale VELUM (EUR), si connue. */
  estimatedValue?: number | null;
  /** Les deux parties ont demandé une expertise. */
  mutualAgreement?: boolean;
}): CertificationRequirement {
  const estimate =
    typeof input.estimatedValue === 'number' && Number.isFinite(input.estimatedValue)
      ? input.estimatedValue
      : 0;
  const referenceValue = Math.max(Number.isFinite(input.value) ? input.value : 0, estimate);
  if (referenceValue > EXPERT_APPRAISAL_THRESHOLD_EUR) {
    return { required: true, reason: 'threshold', referenceValue };
  }
  if (input.mutualAgreement === true) {
    return { required: true, reason: 'mutual_agreement', referenceValue };
  }
  return { required: false, reason: null, referenceValue };
}

/** Payeur par défaut des frais d'expertise selon le motif. */
export function defaultCertificationFeePayer(reason: CertificationReasonId): CertificationFeePayerId {
  return reason === 'mutual_agreement' ? 'split' : 'seller';
}

/**
 * Barème INDICATIF des frais d'expertise (le tarif définitif est fixé par
 * l'expert partenaire à l'assignation) : pourcentage borné.
 */
export const CERTIFICATION_FEE_SCHEDULE = { rate: 0.02, minEur: 30, maxEur: 400 } as const;

export function estimateCertificationFee(value: number): number {
  const { rate, minEur, maxEur } = CERTIFICATION_FEE_SCHEDULE;
  return roundCents(Math.min(maxEur, Math.max(minEur, Math.max(0, value) * rate)));
}

/** Répartition des frais d'expertise entre vendeur et acheteur. */
export function splitCertificationFee(
  fee: number,
  payer: CertificationFeePayerId,
): { seller: number; buyer: number } {
  if (payer === 'seller') return { seller: roundCents(fee), buyer: 0 };
  if (payer === 'buyer') return { seller: 0, buyer: roundCents(fee) };
  const half = roundCents(fee / 2);
  return { seller: half, buyer: roundCents(fee - half) };
}

/** Jeton de remplacement des coordonnées masquées. */
export const REDACTION_TOKEN = '[coordonnées masquées]';

// ── Briques des motifs de coordonnées ────────────────────────────────────────
// Réplique SQL : public.redact_contact_info() (migration
// 20261023100000_market_anonymity.sql), mêmes briques, même ordre, vecteurs
// partagés (bloc M1 de supabase/tests/features/marketplace_checks.sql, relu
// par marketplace.test.ts). Pour que les deux moteurs (JavaScript et
// PostgreSQL ARE) donnent la MÊME sortie au caractère près :
//  - ni `\b`, ni `\w`, ni `\d`, ni `\p{…}` : leur sens diffère d'un moteur à
//    l'autre (ASCII ici, locale là-bas) → classes explicites ci-dessous ;
//  - seuls `\s` / `\S` sont réécrits côté SQL (classe explicite équivalente) ;
//  - toute correspondance est la plus LONGUE possible au point de départ le
//    plus à gauche (sémantique PostgreSQL) : quantificateurs gloutons,
//    alternatives sans préfixe commun ambigu, bornes par assertions.

/** Lettres latines, accentuées comprises : A–Z, À–ÿ (sans × ni ÷), Latin étendu A (Œ, œ, Ÿ, ł…). */
const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿĀ-ſ';
/** Caractère de « mot » : lettre (accentuée ou non), chiffre ou soulignement. */
const WORD = `${LETTER}0-9_`;

/** Libellé de domaine : commence par une lettre ou un chiffre (« -abc.com » garde son tiret). */
const DOMAIN_LABEL = `[${WORD}][${WORD}-]*`;
/**
 * Extensions reconnues sans schéma ni « www » — liste FERMÉE : « 1.250,00 »,
 * « réf. 12 » ou une faute de frappe (« état.De plus ») ne sont pas des domaines.
 */
const DOMAIN_TLD = '(?:com|fr|net|org|eu|be|ch|lu|io|me|info|biz|co|art|shop|store|online)';

/**
 * Point d'une adresse e-mail, en clair ou maquillé : « . », « jean . dupont »,
 * « (dot) », « [point] », « point », « dot ».
 */
const EMAIL_DOT = String.raw`(?:\.+|\s+\.\s+|\s*[(\[](?:dot|point)[)\]]\s*|\s+(?:point|dot)\s+)`;
/**
 * Arobase, en clair ou maquillée : « @ », « jean @ gmail », « (at) », « [at] »,
 * « (arobase) », « arobase », « arrobas ». Deux formes ambiguës sont bornées :
 *  - « @ » précédé d'un blanc et collé au mot suivant n'ouvre un e-mail que
 *    devant un domaine reconnu (« jean @gmail.com ») ; sinon c'est un
 *    pseudonyme (« Suivez @pierre.collect ») ;
 *  - « at » (anglais) ne compte que devant « mot + point + mot »
 *    (« jean at gmail dot com »), jamais dans « struck at Paris. ».
 */
const EMAIL_AT = String.raw`(?:@\s*|\s+@\s+|\s+@(?=(?:${DOMAIN_LABEL}\.)+${DOMAIN_TLD}(?![${WORD}]))|\s*[(\[](?:at|ar{1,2}obase?)[)\]]\s*|\s+ar{1,2}obase?\s+|\s+at\s+(?=[${WORD}+-]+${EMAIL_DOT}[${WORD}]))`;
/** Partie locale ou domaine d'un e-mail : mots (lettres accentuées comprises) reliés par des points. */
const EMAIL_CHUNK = `[${WORD}+-]+(?:${EMAIL_DOT}[${WORD}+-]+)*`;

/**
 * Séparateur entre chiffres d'un numéro : blanc, point, virgule, barre
 * oblique, soulignement, tiret ou tiret typographique (U+2010 à U+2015).
 */
const DIGIT_SEP = String.raw`[\s.,/_\u2010-\u2015-]`;

/** Types de voie d'une adresse postale (« av » avec ou sans point). */
const STREET_TYPE =
  '(?:rue|avenue|av\\.?|boulevard|bd|chemin|allée|allee|impasse|place|quai|route|cours|chaussée|chaussee|passage|square|faubourg|sentier)';
/** Mot d'un nom de voie : lettres, tirets, apostrophes (« Saint-Michel », « l’Église »). */
const STREET_WORD = `[${LETTER}'’-]+`;

/**
 * Motifs de coordonnées interdites dans les textes libres (anonymat
 * pair-à-pair, contournement de la commission). Ordre significatif : chaque
 * motif s'applique au résultat du précédent.
 */
const CONTACT_PATTERNS: readonly RegExp[] = [
  // 1. URL explicites (http, https) : tout jusqu'au prochain blanc. AVANT les
  //    e-mails, pour qu'un « https://nom@site.fr/x » parte d'un seul tenant.
  new RegExp(String.raw`https?://\S+`, 'gi'),
  // 2. E-mails ENTIERS, partie locale comprise (jean.dupont@gmail.com,
  //    jérôme@exemple.fr, « jean point dupont arobase gmail point com »,
  //    « paul (at) mail (dot) fr ») — AVANT les domaines nus, sinon seul
  //    « gmail.com » partirait et « jean.dupont@ » resterait lisible.
  new RegExp(`${EMAIL_CHUNK}${EMAIL_AT}${EMAIL_CHUNK}`, 'gi'),
  // 3. Adresses « www. » : tout jusqu'au prochain blanc.
  new RegExp(String.raw`(?<![${WORD}])www\.\S+`, 'gi'),
  // 4. Domaines nus, sous-domaines et suffixes à deux lettres compris
  //    (monshop.com, site.co.uk, wa.me/33…, t.me/pseudo), chemin compris.
  new RegExp(
    String.raw`(?:${DOMAIN_LABEL}\.)+${DOMAIN_TLD}(?:\.[a-z]{2})?(?![${WORD}])(?:/\S*)?`,
    'gi',
  ),
  // 5. IBAN, insensible à la casse (FR76 3000 6000 0112 3456 7890 189,
  //    « iban fr76 … ») : pays + clé, puis 3 à 7 groupes de 4 et un reste.
  //    Garde : au moins 8 chiffres dans la suite (un IBAN est essentiellement
  //    numérique), pour épargner « AB12 collectionneur ».
  new RegExp(
    String.raw`(?<![${WORD}])[A-Z]{2}[0-9]{2}(?=(?:[\sA-Z]*[0-9]){8})(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?(?![${WORD}])`,
    'gi',
  ),
  // 6. Téléphones — jamais une suite quelconque de chiffres : plages d'années
  //    (1868-1870, 1868/1870), prix (1.250,00 €, 12 500 €), cotes (YT 1234),
  //    tirages (125/500), références et millésimes restent lisibles.
  //  6a. International : « + » ou « 00 », indicatif, puis 8 à 15 chiffres en
  //      tout, séparés ou non, parenthèses comprises (+33 (0)6 12 34 56 78,
  //      0033 6 12 34 56 78, +1 (555) 123-4567).
  new RegExp(
    String.raw`(?:\+|(?<![0-9])00)[\s.]?[1-9](?:${DIGIT_SEP}?\(?[0-9]\)?){7,14}(?![0-9])`,
    'g',
  ),
  //  6b. National : 0 + chiffre non nul + 8 chiffres, séparés ou non, préfixe
  //      entre parenthèses compris — (06) 12 34 56 78, (0)6…, 06.12.34.56.78,
  //      06/12/34/56/78, 0 6 1 2 3 4 5 6 7 8. Une date jj/mm/aaaa suivie
  //      d'une heure (05/11/2026 14:00) n'en est pas un.
  new RegExp(
    String.raw`(?<![0-9])(?![0-9]{2}[./-][0-9]{2}[./-][0-9]{4})\(?0\)?${DIGIT_SEP}?[1-9]\)?(?:${DIGIT_SEP}?[0-9]){8}(?![0-9])`,
    'g',
  ),
  //  6c. Longue suite de 9 à 15 chiffres d'un seul tenant (612345678,
  //      33612345678 « façon WhatsApp », RIB, SIRET).
  new RegExp(String.raw`(?<![0-9])[0-9]{9,15}(?![0-9])`, 'g'),
  //  6d. Numéro national sans son 0, groupé par paires (6 12 34 56 78).
  new RegExp(
    String.raw`(?<![0-9])[1-9](?:${DIGIT_SEP}[0-9]{2}){4}(?!${DIGIT_SEP}?[0-9])`,
    'g',
  ),
  // 7. Pseudonymes de réseaux sociaux (@pseudo, @Collect.Pierre) — après les
  //    e-mails ; le point final d'une phrase n'en fait pas partie.
  new RegExp(String.raw`(?<![${WORD}.])@[${WORD}][${WORD}.]*[${WORD}]`, 'gi'),
  // 8. Adresses postales : numéro (bis, ter) + type de voie + nom de 1 à 6
  //    mots. Le code postal qui suit éventuellement reste (« [coordonnées
  //    masquées] 75011 ») : seul, il ne localise personne.
  new RegExp(
    String.raw`(?<![${WORD}])[0-9]{1,4}(?:\s?(?:bis|ter))?,?\s+${STREET_TYPE}\s+${STREET_WORD}(?:\s${STREET_WORD}){0,5}`,
    'gi',
  ),
];

/**
 * Nombre maximal de passes. Un masquage peut créer une frontière de mot qui
 * en révèle un autre au passage suivant (« 3000003000www.x » : les chiffres
 * masqués par le motif 6c libèrent « www. » du motif 3) : on répète donc la
 * série de motifs jusqu'à stabilité, ce qui rend la sortie idempotente par
 * construction. Deux passes suffisent en pratique ; la borne garantit l'arrêt.
 */
const MAX_REDACTION_PASSES = 5;

/**
 * Masque les coordonnées d'un texte libre. Pur et idempotent (la sortie est
 * un point fixe de la série de motifs ; le jeton seul ne correspond à aucun
 * motif).
 */
export function redactContactInfo(text: string): { text: string; redacted: boolean } {
  let out = text;
  for (let pass = 0; pass < MAX_REDACTION_PASSES; pass++) {
    const before = out;
    for (const pattern of CONTACT_PATTERNS) {
      out = out.replace(pattern, REDACTION_TOKEN);
    }
    if (out === before) break;
  }
  return { text: out, redacted: out !== text };
}
