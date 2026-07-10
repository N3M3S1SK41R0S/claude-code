/**
 * Normalisation des grades numismatiques : échelle française (B, TB, TTB,
 * SUP, SPL, FDC) et échelle Sheldon (PO1…MS70/PR70).
 */

export type GradeScale = 'fr' | 'sheldon';

export interface NormalizedGrade {
  scale: GradeScale;
  value: string;
}

/** Grades de l'échelle française, du plus usé au fleur de coin. */
const FR_GRADES: readonly string[] = ['B', 'TB', 'TTB', 'SUP', 'SPL', 'FDC'];

/** Alias en toutes lettres → grade français canonique. */
const FR_ALIASES: Record<string, string> = {
  BEAU: 'B',
  'TRES BEAU': 'TB',
  'TRÈS BEAU': 'TB',
  'TRES TRES BEAU': 'TTB',
  'TRÈS TRÈS BEAU': 'TTB',
  SUPERBE: 'SUP',
  SPLENDIDE: 'SPL',
  'FLEUR DE COIN': 'FDC',
};

/** Préfixes Sheldon reconnus (EF est normalisé en XF, son équivalent). */
const SHELDON_PREFIXES = ['PO', 'FR', 'AG', 'G', 'VG', 'F', 'VF', 'XF', 'EF', 'AU', 'MS', 'PR', 'PF'];

/**
 * Reconnaît un grade saisi librement ('TTB', 'sup+', 'Fleur de coin',
 * 'MS65', 'vf 30', 'EF45'…) et le normalise.
 * Retourne null si l'entrée n'est pas un grade reconnu — jamais de devinette.
 */
export function normalizeGrade(input: string): NormalizedGrade | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, ' ');
  if (raw === '') return null;

  // 1) Alias français en toutes lettres ("Fleur de coin" → FDC)
  const alias = FR_ALIASES[raw];
  if (alias !== undefined) return { scale: 'fr', value: alias };

  // 2) Échelle française, éventuellement suffixée d'un '+' (ex. "TTB+")
  const frMatch = /^([A-Z]{1,3})(\+?)$/.exec(raw);
  if (frMatch !== null) {
    const base = frMatch[1] ?? '';
    if (FR_GRADES.includes(base)) return { scale: 'fr', value: base + (frMatch[2] ?? '') };
  }

  // 3) Échelle Sheldon : préfixe + valeur numérique 1..70 (ex. "MS65", "VF 30")
  const pattern = new RegExp(`^(${SHELDON_PREFIXES.join('|')})\\s*(\\d{1,2})(\\+?)$`);
  const sheldonMatch = pattern.exec(raw);
  if (sheldonMatch !== null) {
    const prefixRaw = sheldonMatch[1] ?? '';
    const num = Number(sheldonMatch[2]);
    if (num >= 1 && num <= 70) {
      const prefix = prefixRaw === 'EF' ? 'XF' : prefixRaw; // EF (Extremely Fine) ≡ XF
      return { scale: 'sheldon', value: `${prefix}${num}${sheldonMatch[3] ?? ''}` };
    }
  }

  return null;
}

/**
 * Correspondance APPROXIMATIVE Sheldon → échelle française, à usage indicatif
 * (les deux échelles ne se recouvrent pas exactement) :
 *
 *   PO1–G7    → B   (Beau)
 *   VG8–F19   → TB  (Très Beau)
 *   VF20–VF39 → TTB (Très Très Beau)
 *   XF40–AU57 → SUP (Superbe)
 *   AU58–MS62 → SPL (Splendide)
 *   MS63–70   → FDC (Fleur de Coin)
 *
 * Accepte un grade Sheldon complet ('MS65') ou sa valeur numérique (65).
 * Retourne null hors de la plage 1..70.
 */
export function sheldonToFr(value: string | number): string | null {
  const n = typeof value === 'number' ? value : Number(/(\d{1,2})/.exec(value.trim())?.[1]);
  if (!Number.isFinite(n) || n < 1 || n > 70) return null;
  if (n < 8) return 'B';
  if (n < 20) return 'TB';
  if (n < 40) return 'TTB';
  if (n < 58) return 'SUP';
  if (n < 63) return 'SPL';
  return 'FDC';
}
