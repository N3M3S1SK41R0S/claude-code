import { VelumError } from '@velum/core';

export interface MarketNotification {
  id: string;
  title: string | null;
  body: string | null;
  createdAt: string;
}

interface DatabaseErrorLike {
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(
  value: unknown,
  field: string,
  index: number,
): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new VelumError(
    'SOURCE_UNAVAILABLE',
    `Notification ${index} invalide : champ ${field} attendu en chaîne ou null.`,
  );
}

/**
 * Convertit défensivement une réponse PostgREST en notifications affichables.
 * Une panne ou une ligne malformée reste visible : elle ne devient jamais une
 * fausse liste vide, qui tromperait l'utilisateur sur l'état de ses alertes.
 */
export function parseMarketNotifications(
  data: unknown,
  error: DatabaseErrorLike | null,
): MarketNotification[] {
  if (error !== null) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      `Lecture des notifications impossible : ${error.message}`,
    );
  }

  if (data === null) return [];
  if (!Array.isArray(data)) {
    throw new VelumError(
      'SOURCE_UNAVAILABLE',
      'Lecture des notifications impossible : tableau attendu.',
    );
  }

  return data.map((row, index) => {
    if (!isRecord(row)) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        `Notification ${index} invalide : objet attendu.`,
      );
    }

    const id = row['id'];
    const createdAt = row['created_at'];
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        `Notification ${index} invalide : identifiant absent.`,
      );
    }
    if (
      typeof createdAt !== 'string' ||
      createdAt.trim().length === 0 ||
      !Number.isFinite(Date.parse(createdAt))
    ) {
      throw new VelumError(
        'SOURCE_UNAVAILABLE',
        `Notification ${index} invalide : date illisible.`,
      );
    }

    return {
      id,
      title: nullableString(row['title'], 'title', index),
      body: nullableString(row['body'], 'body', index),
      createdAt,
    };
  });
}
