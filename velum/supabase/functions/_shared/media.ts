/**
 * Hydratation bornée des photos depuis le bucket privé `item-media`.
 *
 * Les fournisseurs vision attendent du base64, mais une Edge Function ne doit
 * jamais télécharger plusieurs blobs non bornés en parallèle. Les contrôles
 * s'appliquent aussi aux anciens clients qui envoient encore une data URL.
 */
import type { CaptureInput, CaptureMedia } from '@velum/core';
import { VelumError } from '@velum/core';
import type { AuthContext } from './auth.ts';

const BUCKET = 'item-media';
const MIB = 1024 * 1024;

export interface MediaHydrationLimits {
  maxMediaCount: number;
  maxBytesPerMedia: number;
  maxTotalBytes: number;
}

export const DEFAULT_MEDIA_HYDRATION_LIMITS: Readonly<MediaHydrationLimits> = Object.freeze({
  maxMediaCount: 4,
  maxBytesPerMedia: 6 * MIB,
  maxTotalBytes: 12 * MIB,
});

const ACCEPTED_MEDIA_TYPES = new Map<string, string>([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/heic', 'image/heic'],
  ['image/heif', 'image/heif'],
]);

function invalidMedia(message: string, details?: Record<string, unknown>): VelumError {
  return new VelumError('INVALID_INPUT', message, details);
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} doit être un entier strictement positif`);
  }
}

function assertLimits(limits: MediaHydrationLimits): void {
  assertPositiveInteger(limits.maxMediaCount, 'maxMediaCount');
  assertPositiveInteger(limits.maxBytesPerMedia, 'maxBytesPerMedia');
  assertPositiveInteger(limits.maxTotalBytes, 'maxTotalBytes');
  if (limits.maxTotalBytes < limits.maxBytesPerMedia) {
    throw new RangeError('maxTotalBytes doit être supérieur ou égal à maxBytesPerMedia');
  }
}

/** Estime exactement le nombre d'octets décodés sans allouer le binaire. */
export function base64ByteLength(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;

  let payload = trimmed;
  if (trimmed.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(trimmed);
    if (!match) {
      throw invalidMedia('Data URL image invalide');
    }
    const rawMediaType = (match[1] ?? '').trim().toLowerCase();
    if (!ACCEPTED_MEDIA_TYPES.has(rawMediaType)) {
      throw invalidMedia(`Type de média non pris en charge : ${rawMediaType || 'inconnu'}`);
    }
    payload = match[2] ?? '';
  }

  const compact = payload.replace(/[\t\n\r ]/g, '');
  if (compact.length === 0) return 0;

  const validAlphabet = /^[A-Za-z0-9+/]*={0,2}$/.test(compact);
  const hasPadding = compact.includes('=');
  const validLength = compact.length % 4 !== 1 && (!hasPadding || compact.length % 4 === 0);
  if (!validAlphabet || !validLength) {
    throw invalidMedia('Contenu base64 image invalide');
  }

  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.floor((compact.length * 3) / 4) - padding;
}

/** Conversion binaire → base64 par morceaux, sans dépassement de pile. */
function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function normalizedBlobMediaType(path: string, blobType: string): string {
  let declared = blobType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  // Supabase Storage peut restituer un type générique quand le type d'origine
  // n'a pas été conservé. Dans ce seul cas, l'extension privée sert de repli.
  if (declared === 'application/octet-stream') declared = '';

  if (declared.length > 0) {
    const accepted = ACCEPTED_MEDIA_TYPES.get(declared);
    if (!accepted) {
      throw invalidMedia(`Type de média stocké non pris en charge : ${declared}`, { path });
    }
    return accepted;
  }

  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function assertWithinLimits(
  bytes: number,
  totalBefore: number,
  index: number,
  limits: MediaHydrationLimits,
): number {
  if (bytes > limits.maxBytesPerMedia) {
    throw invalidMedia(`Photo ${index + 1} trop volumineuse`, {
      bytes,
      maxBytes: limits.maxBytesPerMedia,
    });
  }
  const total = totalBefore + bytes;
  if (total > limits.maxTotalBytes) {
    throw invalidMedia('Volume cumulé des photos trop élevé', {
      bytes: total,
      maxBytes: limits.maxTotalBytes,
    });
  }
  return total;
}

/**
 * Remplace chaque `storagePath` par son contenu base64.
 *
 * Les téléchargements sont strictement séquentiels. Cela borne le pic mémoire à
 * un blob en cours de conversion, en plus du résultat final lui-même borné.
 */
export async function hydrateMedia(
  auth: AuthContext,
  input: CaptureInput,
  limits: MediaHydrationLimits = DEFAULT_MEDIA_HYDRATION_LIMITS,
): Promise<CaptureInput> {
  if (input.kind !== 'photo' || !input.media?.length) return input;
  assertLimits(limits);

  if (input.media.length > limits.maxMediaCount) {
    throw invalidMedia(`Trop de photos : ${limits.maxMediaCount} maximum`, {
      count: input.media.length,
      maxCount: limits.maxMediaCount,
    });
  }

  let totalBytes = 0;
  for (let index = 0; index < input.media.length; index += 1) {
    const base64 = input.media[index]?.base64;
    if (base64) {
      totalBytes = assertWithinLimits(
        base64ByteLength(base64),
        totalBytes,
        index,
        limits,
      );
    }
  }

  const hydrated: CaptureMedia[] = [];
  for (let index = 0; index < input.media.length; index += 1) {
    const item = input.media[index];
    if (!item) continue;
    if (item.base64) {
      hydrated.push(item);
      continue;
    }

    const path = item.storagePath.trim();
    if (!path) {
      hydrated.push(item);
      continue;
    }
    if (!path.startsWith(`${auth.user.id}/`)) {
      throw new VelumError('UNAUTHORIZED', "Ce média n'appartient pas à l'appelant");
    }

    const { data, error } = await auth.supabase.storage.from(BUCKET).download(path);
    if (error || !data) {
      throw invalidMedia(`Photo introuvable dans le stockage : ${path}`, {
        cause: error?.message,
      });
    }

    totalBytes = assertWithinLimits(data.size, totalBytes, index, limits);
    const mediaType = normalizedBlobMediaType(path, data.type);
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength !== data.size) {
      throw invalidMedia(`Taille de photo incohérente : ${path}`, {
        declaredBytes: data.size,
        actualBytes: bytes.byteLength,
      });
    }

    hydrated.push({
      ...item,
      base64: `data:${mediaType};base64,${toBase64(bytes)}`,
    });
  }

  return { ...input, media: hydrated };
}
