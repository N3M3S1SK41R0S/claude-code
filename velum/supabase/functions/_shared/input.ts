import type {
  Candidate,
  CaptureInput,
  CaptureMedia,
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

// Les montres (5e module) étaient absentes de ces deux listes : un candidat
// 'watch' était refusé par analyze-watch / valuate, et un cliché de cadran
// ('dial') par recognize. Les listes suivent désormais le contrat core.
function isVelumDomain(value: unknown): value is VelumDomain {
  return (
    value === 'wine' ||
    value === 'coin' ||
    value === 'art' ||
    value === 'stamp' ||
    value === 'watch'
  );
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
    value === 'dial' ||
    value === 'caseback' ||
    value === 'movement' ||
    value === 'clasp' ||
    value === 'detail'
  );
}

// ── Bornes d'une capture (vérifiées AVANT garde-fou et quota) ────────────────
//
// Une requête `recognize` coûte UN scan, quel que soit son contenu : sans
// borne, 40 photos ou un texte de plusieurs centaines de Ko coûteraient 40 fois
// un scan au fournisseur et épuiseraient le plafond de dépense global.

/** Photos par capture : le maximum de rôles d'un domaine (montre : cadran, fond, fermoir…). */
export const MAX_CAPTURE_MEDIA = 4;

/** Longueur maximale d'une description en texte libre. */
export const MAX_CAPTURE_TEXT_LENGTH = 2000;

/**
 * Poids maximal d'une image (octets décodés). Le fournisseur par défaut
 * (Anthropic) refuse toute image de plus de 5 Mo en base64, soit ~3,75 Mo
 * décodés : au-delà, la requête échouerait APRÈS consommation du scan.
 */
export const MAX_IMAGE_BYTES = 3_750_000;

/** Poids décodé d'une image en base64 (data URL ou base64 nu, remplissage exclu). */
export function base64DecodedBytes(value: string): number {
  const comma = value.startsWith('data:') ? value.indexOf(',') : -1;
  const payload = (comma === -1 ? value : value.slice(comma + 1)).replace(/\s/g, '');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/** Message d'une image trop lourde (Mo arrondis au dixième, à la française). */
export function imageTooLargeMessage(bytes: number): string {
  const mb = (n: number) => (Math.round(n / 100_000) / 10).toLocaleString('fr-FR');
  return `Photo trop lourde (${mb(bytes)} Mo, ${mb(MAX_IMAGE_BYTES)} Mo au plus) : reprenez-la ou réduisez-la`;
}

/** Mode de reconnaissance : un objet (défaut) ou une planche multi-objets. */
export type RecognitionMode = 'single' | 'sheet';

/** Valide le champ optionnel `mode` de `recognize` (absent → 'single'). */
export function validateRecognitionMode(value: unknown): ValidationResult<RecognitionMode> {
  if (value === undefined || value === null) return valid('single');
  if (value === 'single' || value === 'sheet') return valid(value);
  return invalid("Champ 'mode' invalide : 'single' ou 'sheet' attendu");
}

/**
 * Le mode planche analyse UNE photo de page de classeur / de plateau : ni
 * texte, ni fichier, ni série de clichés (le quota est compté par photo).
 */
export function validateSheetInput(input: CaptureInput): ValidationResult<CaptureInput> {
  if (input.kind !== 'photo') {
    return invalid("Le mode planche exige une photo (input.kind 'photo')");
  }
  const media = input.media ?? [];
  if (media.length !== 1) {
    return invalid('Le mode planche attend exactement une photo de la planche');
  }
  const only = media[0];
  if (!only || (only.storagePath.trim() === '' && !only.base64)) {
    return invalid('Le mode planche attend une photo téléversée ou jointe');
  }
  return valid(input);
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
  let validatedMedia: CaptureMedia[] | undefined;
  if (media !== undefined) {
    if (!Array.isArray(media)) {
      return invalid("Champ 'input.media' invalide : tableau attendu");
    }
    if (media.length > MAX_CAPTURE_MEDIA) {
      return invalid(
        `Champ 'input.media' invalide : au plus ${MAX_CAPTURE_MEDIA} photos par capture (une requête = un scan)`,
      );
    }
    validatedMedia = [];
    for (let index = 0; index < media.length; index++) {
      const item = media[index];
      if (!isRecord(item)) {
        return invalid(`Champ 'input.media[${index}]' invalide : objet attendu`);
      }
      const role = item['role'];
      if (!isMediaRole(role)) {
        return invalid(`Champ 'input.media[${index}].role' invalide`);
      }
      const storagePath = item['storagePath'];
      if (typeof storagePath !== 'string') {
        return invalid(`Champ 'input.media[${index}].storagePath' invalide : chaîne attendue`);
      }
      const base64 = item['base64'];
      if (base64 !== undefined && typeof base64 !== 'string') {
        return invalid(`Champ 'input.media[${index}].base64' invalide : chaîne attendue`);
      }
      if (base64 !== undefined) {
        const bytes = base64DecodedBytes(base64);
        if (bytes > MAX_IMAGE_BYTES) {
          return invalid(`Champ 'input.media[${index}].base64' invalide : ${imageTooLargeMessage(bytes)}`);
        }
      }
      validatedMedia.push({
        ...item,
        role,
        storagePath,
        ...(base64 !== undefined ? { base64 } : {}),
      });
    }
  }

  const text = value['text'];
  if (text !== undefined && typeof text !== 'string') {
    return invalid("Champ 'input.text' invalide : chaîne attendue");
  }
  if (typeof text === 'string' && text.length > MAX_CAPTURE_TEXT_LENGTH) {
    return invalid(
      `Champ 'input.text' invalide : ${MAX_CAPTURE_TEXT_LENGTH} caractères au plus (${text.length} reçus)`,
    );
  }

  const fileRows = value['fileRows'];
  let validatedFileRows: Record<string, unknown>[] | undefined;
  if (fileRows !== undefined) {
    if (!Array.isArray(fileRows)) {
      return invalid("Champ 'input.fileRows' invalide : tableau attendu");
    }
    validatedFileRows = [];
    for (let index = 0; index < fileRows.length; index++) {
      const row = fileRows[index];
      if (!isRecord(row)) {
        return invalid(`Champ 'input.fileRows[${index}]' invalide : objet attendu`);
      }
      validatedFileRows.push(row);
    }
  }

  const locale = value['locale'];
  if (locale !== undefined && typeof locale !== 'string') {
    return invalid("Champ 'input.locale' invalide : chaîne attendue");
  }

  // On reconstruit les champs connus avec leurs types prouvés et on conserve les
  // champs JSON inconnus pour préserver la compatibilité additive du contrat.
  const input: CaptureInput = {
    ...value,
    kind: value['kind'],
    ...(validatedMedia !== undefined ? { media: validatedMedia } : {}),
    ...(typeof text === 'string' ? { text } : {}),
    ...(validatedFileRows !== undefined ? { fileRows: validatedFileRows } : {}),
    ...(typeof locale === 'string' ? { locale } : {}),
  };
  return valid(input);
}

/** Valide un candidat avant de l'injecter dans un prompt d'analyse. */
export function validateCandidate(
  value: unknown,
  expectedDomain?: VelumDomain,
): ValidationResult<Candidate> {
  if (!isRecord(value)) {
    return invalid("Champ 'candidate' invalide : objet attendu");
  }

  const id = value['id'];
  if (typeof id !== 'string' || id.trim().length === 0) {
    return invalid("Champ 'candidate.id' invalide : chaîne non vide attendue");
  }
  const domain = value['domain'];
  if (!isVelumDomain(domain)) {
    return invalid("Champ 'candidate.domain' invalide");
  }
  if (expectedDomain !== undefined && domain !== expectedDomain) {
    return invalid(
      `Le candidat appartient au domaine '${domain}', cette fonction traite '${expectedDomain}'`,
    );
  }
  const label = value['label'];
  if (typeof label !== 'string' || label.trim().length === 0) {
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

  const thumbnailUrl = value['thumbnailUrl'];
  if (thumbnailUrl !== undefined && typeof thumbnailUrl !== 'string') {
    return invalid("Champ 'candidate.thumbnailUrl' invalide : chaîne attendue");
  }
  const attributes = value['attributes'];
  if (!isRecord(attributes)) {
    return invalid("Champ 'candidate.attributes' invalide : objet attendu");
  }

  // Même principe que CaptureInput : champs connus réécrits après preuve,
  // champs futurs conservés sans double cast.
  const candidate: Candidate = {
    ...value,
    id,
    domain,
    label,
    confidence,
    attributes,
    ...(typeof thumbnailUrl === 'string' ? { thumbnailUrl } : {}),
  };
  return valid(candidate);
}
