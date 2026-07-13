/**
 * Extraction robuste du JSON produit par un LLM : les modèles enveloppent
 * parfois leur réponse dans des fences markdown ou du texte libre. On retire
 * les fences puis on extrait le PREMIER bloc {...} équilibré (en respectant
 * les chaînes et les échappements) avant de tenter le parse.
 */

/** Retire les fences markdown puis renvoie le premier bloc {...} équilibré, ou null. */
export function extractBalancedJson(raw: string): string | null {
  const text = raw.replace(/```[a-zA-Z]*\r?\n?/g, '').replace(/```/g, '');
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // bloc jamais refermé → réponse illisible
}

/** Parse tolérant : fences retirées, bloc équilibré extrait, try/catch. null si illisible. */
export function parseModelJson(raw: string): unknown {
  const block = extractBalancedJson(raw);
  if (block === null) return null;
  try {
    return JSON.parse(block);
  } catch {
    return null;
  }
}
