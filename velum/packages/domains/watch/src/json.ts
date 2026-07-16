/**
 * Utilitaires de parsing robuste des réponses LLM : les modèles renvoient
 * parfois du JSON entouré de fences markdown ou de texte parasite.
 * Stratégie : retirer les fences, extraire le premier bloc {...} équilibré,
 * puis JSON.parse sous try/catch — jamais d'exception qui remonte.
 */

/** Retire les fences markdown (```json … ```) d'un texte. */
export function stripMarkdownFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\r?\n?/g, '').replace(/```/g, '');
}

/**
 * Extrait le premier bloc `{...}` équilibré (accolades comptées hors chaînes,
 * échappements respectés). Retourne null si aucun bloc complet n'est trouvé.
 */
export function extractFirstJsonBlock(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse tolérant : fences retirées + premier bloc équilibré + try/catch. */
export function parseLooseJson(raw: string): unknown {
  const block = extractFirstJsonBlock(stripMarkdownFences(raw));
  if (block === null) return null;
  try {
    return JSON.parse(block) as unknown;
  } catch {
    return null;
  }
}

/** Garde de type : objet simple (non null, non tableau). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Borne une confiance dans [0, 1] — jamais de fausse certitude hors bornes. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
