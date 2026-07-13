/**
 * Analyse d'une chaîne de dimensions marché de l'art ("65 x 54 cm") vers des
 * centimètres structurés. Convention : hauteur × largeur. Tolère les
 * séparateurs 'x', '×', '*', la virgule décimale et l'unité "cm" optionnelle.
 */
export interface ParsedDimensions {
  height: number;
  width: number;
}

/** "65 x 54 cm" → { height: 65, width: 54 } ; chaîne illisible → null. */
export function parseDimensions(raw: string): ParsedDimensions | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?/i.exec(raw);
  if (match === null) return null;
  const height = Number.parseFloat((match[1] ?? '').replace(',', '.'));
  const width = Number.parseFloat((match[2] ?? '').replace(',', '.'));
  if (!Number.isFinite(height) || !Number.isFinite(width) || height <= 0 || width <= 0) {
    return null;
  }
  return { height, width };
}
