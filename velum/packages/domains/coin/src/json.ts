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

/** Tableau lu dans une réponse, éventuellement récupéré d'une sortie coupée. */
export interface SalvagedArray {
  /** Éléments COMPLETS du tableau (un élément coupé en cours n'est jamais gardé). */
  items: unknown[];
  /** Objet racine quand la réponse entière est un JSON valide, sinon null. */
  root: Record<string, unknown> | null;
  /** false → réponse tronquée (budget de tokens atteint) : liste partielle. */
  complete: boolean;
  /**
   * La clé a été trouvée dans la réponse. Une réponse SANS la clé (prose,
   * refus) n'est pas « tronquée » : elle ne contient simplement rien.
   */
  found: boolean;
}

/**
 * Lit le tableau `key` d'une réponse modèle. Si le JSON est coupé (budget de
 * sortie atteint sur une grande planche), récupère les éléments `{...}` déjà
 * COMPLETS au lieu de tout perdre — et le signale (`complete: false`).
 * Un texte parasite entre accolades AVANT le JSON (« Voici {le résultat} : … »)
 * n'est pas pris pour une troncature : la racine est cherchée à l'accolade qui
 * précède la clé.
 */
export function parseArrayWithSalvage(raw: string, key: string): SalvagedArray {
  const parsed = parseLooseJson(raw);
  if (isRecord(parsed) && key in parsed) {
    const value = parsed[key];
    return { items: Array.isArray(value) ? value : [], root: parsed, complete: true, found: true };
  }

  const text = stripMarkdownFences(raw);
  const keyAt = text.indexOf(`"${key}"`);
  if (keyAt === -1) {
    // Aucune trace de la clé : JSON racine sans elle, ou prose sans JSON.
    return { items: [], root: isRecord(parsed) ? parsed : null, complete: isRecord(parsed), found: false };
  }

  // Préfixe parasite : la racine qui porte la clé commence à la dernière
  // accolade ouvrante qui la précède. Si ce bloc est un JSON complet, il fait foi.
  const rootAt = text.lastIndexOf('{', keyAt);
  if (rootAt !== -1) {
    const block = extractFirstJsonBlock(text.slice(rootAt));
    if (block !== null) {
      try {
        const root: unknown = JSON.parse(block);
        if (isRecord(root) && key in root) {
          const value = root[key];
          return { items: Array.isArray(value) ? value : [], root, complete: true, found: true };
        }
      } catch {
        // bloc invalide : on passe à la récupération des éléments complets
      }
    }
  }

  const arrayAt = text.indexOf('[', keyAt);
  if (arrayAt === -1) return { items: [], root: null, complete: false, found: true };

  const items: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = arrayAt + 1; i < text.length; i++) {
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
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          items.push(JSON.parse(text.slice(start, i + 1)) as unknown);
        } catch {
          // élément illisible : ignoré, on continue avec les suivants
        }
        start = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break; // fin du tableau atteinte malgré un JSON racine invalide
    }
  }
  return { items, root: null, complete: false, found: true };
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
