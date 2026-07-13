/**
 * Edge Function `delete-account` — purge RGPD (droit à l'effacement).
 *
 * POST (sans corps) → auth → suppression de tous les objets Storage du
 * préfixe <uid>/ dans 'item-media', puis suppression du compte auth.users
 * (cascade : profiles → items → item_media/analyses/valuations/alerts/
 * listings, notifications, usage_counters) → 204.
 */
import { createAdminClient, getUser } from '../_shared/auth.ts';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { error } from '../_shared/respond.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return error('INVALID_INPUT', 'Méthode non autorisée', 405);
  }

  const auth = await getUser(req);
  if (!auth) {
    return error('UNAUTHORIZED', 'Authentification requise', 401);
  }
  const uid = auth.user.id;
  const admin = createAdminClient();

  // 1. Purge Storage : tous les objets sous le préfixe <uid>/ du bucket
  //    'item-media'. On liste via storage.objects (récursif, contrairement à
  //    storage.list() qui ne descend pas dans les sous-dossiers).
  const { data: objects, error: listError } = await admin
    .schema('storage')
    .from('objects')
    .select('name')
    .eq('bucket_id', 'item-media')
    .like('name', `${uid}/%`);

  if (listError) {
    console.error('[delete-account] listage storage impossible :', listError.message);
    return error('SOURCE_UNAVAILABLE', 'Purge des médias impossible, réessayez', 503);
  }

  const names = (objects ?? []).map((o) => o.name as string);
  if (names.length > 0) {
    const { error: removeError } = await admin.storage.from('item-media').remove(names);
    if (removeError) {
      console.error('[delete-account] suppression storage impossible :', removeError.message);
      return error('SOURCE_UNAVAILABLE', 'Purge des médias impossible, réessayez', 503);
    }
  }

  // 2. Suppression du compte : cascade SQL depuis auth.users → profiles →
  //    toutes les tables filles (on delete cascade, migration 0001).
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    console.error('[delete-account] suppression du compte impossible :', deleteError.message);
    return error('SOURCE_UNAVAILABLE', 'Suppression du compte impossible, réessayez', 503);
  }

  return new Response(null, { status: 204, headers: corsHeaders });
});
