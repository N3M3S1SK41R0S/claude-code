/**
 * En-têtes CORS communs aux Edge Functions VELUM.
 * L'app Expo (et le web) appelle les fonctions depuis une origine différente :
 * on répond aux pré-vols OPTIONS et on joint ces en-têtes à chaque réponse.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Répond au pré-vol OPTIONS ; retourne null pour toute autre méthode. */
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}
