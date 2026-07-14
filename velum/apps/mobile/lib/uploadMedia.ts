/**
 * Téléversement des photos vers le bucket privé `item-media`.
 *
 * Avant : la photo partait en base64 DANS le corps JSON de `recognize`. Une
 * photo de 2000 px pèse ~500 Ko, que le base64 gonfle de 33 % (~680 Ko) — et une
 * capture multi-clichés triplait ça. Sur la 4G d'une cave, c'est lent et fragile.
 * Pire : la photo n'était conservée NULLE PART, alors que le bucket existe depuis
 * la première migration.
 *
 * Maintenant : on téléverse l'octet brut (pas de gonflement base64), on n'envoie
 * que le chemin, et la photo reste attachée à l'objet.
 *
 * Le chemin est TOUJOURS préfixé par l'uid : la RLS du bucket n'autorise chaque
 * utilisateur que sur son propre préfixe.
 */
import { getVelumClient } from './client';

const BUCKET = 'item-media';

/** data-URL → Blob, sans passer par un Buffer (fonctionne sur web ET natif). */
function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const [header, payload] = dataUrl.split(',');
  const contentType = header?.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const binary = atob(payload ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

function extensionFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Téléverse une photo et renvoie son `storagePath`.
 * Renvoie `null` en cas d'échec : l'appelant retombe alors sur l'envoi base64,
 * plutôt que de perdre la capture de l'utilisateur.
 */
export async function uploadCaptureMedia(dataUrl: string): Promise<string | null> {
  try {
    const client = getVelumClient();
    const { data: userData } = await client.supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;

    const { blob, contentType } = dataUrlToBlob(dataUrl);
    const path = `${uid}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

    const { error } = await client.supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType, upsert: false });

    if (error) return null;
    return path;
  } catch {
    return null; // réseau, permission, quota… : on repliera sur le base64
  }
}
