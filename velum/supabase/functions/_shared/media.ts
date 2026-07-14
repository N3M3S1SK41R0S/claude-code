/**
 * Hydratation des photos depuis Supabase Storage.
 *
 * Le client envoyait les images en base64 DANS le corps JSON : une photo de
 * 2000 px pèse ~500 Ko, que le base64 gonfle de 33 % (~680 Ko) — et une capture
 * multi-clichés (étiquette + capsule, ou avers + revers + tranche) triplait ça.
 * Sur la 4G d'une cave, c'est lent et fragile ; et la photo n'était CONSERVÉE
 * nulle part, alors que le bucket `item-media` existe depuis la migration 0001.
 *
 * Le client téléverse désormais dans Storage et n'envoie plus qu'un `storagePath`.
 * Cette fonction retélécharge l'octet brut côté serveur et le convertit en base64
 * pour le modèle — qui, lui, n'accepte que du base64.
 *
 * Rétro-compatible : un `base64` déjà présent est utilisé tel quel (mode démo,
 * client ancien, ou repli quand le téléversement a échoué).
 */
import type { CaptureInput, CaptureMedia } from '@velum/core';
import { VelumError } from '@velum/core';
import type { AuthContext } from './auth.ts';

const BUCKET = 'item-media';

/** Conversion binaire → base64 sans exploser la pile sur les gros fichiers. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32 Ko : String.fromCharCode(...) plante au-delà
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Devine le type MIME depuis l'extension (le bucket ne le renvoie pas toujours). */
function mediaTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

/**
 * Remplace chaque `storagePath` par son contenu base64.
 *
 * La RLS du bucket interdit déjà de lire le préfixe d'autrui ; on vérifie quand
 * même que le chemin commence par l'uid de l'appelant — défense en profondeur,
 * une policy mal éditée un jour ne doit pas suffire à ouvrir la porte.
 */
export async function hydrateMedia(auth: AuthContext, input: CaptureInput): Promise<CaptureInput> {
  if (input.kind !== 'photo' || !input.media?.length) return input;

  const media: CaptureMedia[] = await Promise.all(
    input.media.map(async (item) => {
      if (item.base64) return item; // déjà fourni : rien à télécharger
      const path = item.storagePath?.trim();
      if (!path) return item;

      if (!path.startsWith(`${auth.user.id}/`)) {
        throw new VelumError('UNAUTHORIZED', "Ce média n'appartient pas à l'appelant");
      }

      const { data, error } = await auth.supabase.storage.from(BUCKET).download(path);
      if (error || !data) {
        throw new VelumError('INVALID_INPUT', `Photo introuvable dans le stockage : ${path}`, {
          cause: error?.message,
        });
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      return { ...item, base64: `data:${mediaTypeFor(path)};base64,${toBase64(bytes)}` };
    }),
  );

  return { ...input, media };
}
