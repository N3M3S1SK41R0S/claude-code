import type {
  Candidate,
  CaptureInput,
  MediaRole,
  VelumDomain,
} from '@velum/core';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function valid<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function invalid<T>(message: string): ValidationResult<T> {
  return { ok: false, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCaptureKind(value: unknown): value is CaptureInput['kind'] {
  return value === 'photo' || value === 'text' || value === 'file';
}

function isVelumDomain(value: unknown): value is VelumDomain {
  return value === 'wine' || value === 'coin' || value === 'art' || value === 'stamp';
}

function isMediaRole(value: unknown): value is MediaRole {
  return (
    value === 'label' ||
    value === 'capsule' ||
    value === 'obverse' ||
    value === 'reverse' ||
    value === 'edge' ||
    value === 'front' ||
    value === 'back' ||
    value === 'signature' ||
    value === 'frame' ||
    value === 'detail'
  );
}

/** Refuse les corps JSON primitifs avant tout accès à leurs propriétés. */
export function validateJsonObject(value: unknown): ValidationResult<Record<string, unknown>> {
  return isRecord(value)
    ? valid(value)
    : invalid('Corps JSON invalide : objet attendu');
}

/**
 * Valide la forme de CaptureInput sans imposer de contenu métier : une photo
 * vide ou un texte vide restent des cas légitimes de saisie assistée.
 */
export function validateCaptureInput(value: unknown): ValidationResult<CaptureInput> {
  if (!isRecord(value)) {
    return invalid("Champ 'input' invalide : objet attendu");
  }

  if (!isCaptureKind(value['kind'])) {
    return invalid("Champ 'input.kind' invalide : photo, text ou file attendu");
  }

  const media = value['media'];
  if (media !== undefined) {
    if (!Array.isArray(media)) {
      return invalid("Champ 'input.media' invalide : tableau attendu");
    }
    for (let index = 0; index < media.length; index++) {
      const item = media[index];
      if (!isRecord(item)) {
        return invalid(`Champ 'input.media[${index}]' invalide : objet attendu`);
      }
      if (!isMediaRole(item['role'])) {
        return invalid(`Champ 'input.media[${index}].role' invalide`);
      }
      if (typeof item['storagePath'] !== 'string') {
        return invalid(`Champ 'input.media[${index}].storagePath' invalide : chaîne attendue`);
      }
      if (item['base64'] !== undefined && typeof item['base64'] !== 'string') {
        return invalid(`Champ 'input.media[${index}].base64' invalide : chaîne attendue`);
      }
    }
  }

  if (value['text'] !== undefined && typeof value['text'] !== 'string') {
    return invalid("Champ 'input.text' invalide : chaîne attendue");
  }

  const fileRows = value['fileRows'];
  if (fileRows !== undefined) {
    if (!Array.isArray(fileRows)) {
      return invalid("Champ 'input.fileRows' invalide : tableau attendu");
    }
    for (let index = 0; index < fileRows.length; index++) {
      if (!isRecord(fileRows[index])) {
        return invalid(`Champ 'input.fileRows[${index}]' invalide : objet attendu`);
      }
    }
  }

  if (value['locale'] !== undefined && typeof value['locale'] !== 'string') {
    return invalid("Champ 'input.locale' invalide : chaîne attendue");
  }

  // Tous les champs du contrat CaptureInput ont été vérifiés ; les champs JSON
  // inconnus restent présents pour préserver la compatibilité additive.
  return valid(value as CaptureInput);
}

/** Valide un candidat avant de l'injecter dans un prompt d'analyse. */
export function validateCandidate(
  value: unknown,
  expectedDomain?: VelumDomain,
): ValidationResult<Candidate> {
  if (!isRecord(value)) {
    return invalid("Champ 'candidate' invalide : objet attendu");
  }

  if (typeof value['id'] !== 'string' || value['id'].trim().length === 0) {
    return invalid("Champ 'candidate.id' invalide : chaîne non vide attendue");
  }
  if (!isVelumDomain(value['domain'])) {
    return invalid("Champ 'candidate.domain' invalide");
  }
  if (expectedDomain !== undefined && value['domain'] !== expectedDomain) {
    return invalid(
      `Le candidat appartient au domaine '${value['domain']}', cette fonction traite '${expectedDomain}'`,
    );
  }
  if (typeof value['label'] !== 'string' || value['label'].trim().length === 0) {
    return invalid("Champ 'candidate.label' invalide : chaîne non vide attendue");
  }

  const confidence = value['confidence'];
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return invalid("Champ 'candidate.confidence' invalide : nombre entre 0 et 1 attendu");
  }

  if (value['thumbnailUrl'] !== undefined && typeof value['thumbnailUrl'] !== 'string') {
    return invalid("Champ 'candidate.thumbnailUrl' invalide : chaîne attendue");
  }
  if (!isRecord(value['attributes'])) {
    return invalid("Champ 'candidate.attributes' invalide : objet attendu");
  }

  // Tous les champs du contrat Candidate ont été vérifiés ; les champs JSON
  // inconnus restent présents pour préserver la compatibilité additive.
  return valid(value as Candidate);
}
