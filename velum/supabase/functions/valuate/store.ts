/**
 * Persistance d'une valorisation — écriture SERVEUR seule.
 *
 * Les estimations entrent dans le seuil de certification des plateformes
 * d'échange et de vente (max(prix, estimation VELUM) > 500 €) : le client n'a
 * plus aucun droit d'écriture sur `valuations` (migration
 * 20261023131000_valuations_server_writes). La propriété de l'objet est
 * vérifiée avec le client UTILISATEUR (RLS : l'appelant ne voit que ses
 * objets), puis l'estimation est écrite avec le client service-role.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ValuationResult } from '@velum/core';

/** Résultat du contrôle de propriété ('unavailable' = lecture en échec). */
export type ItemOwnership = 'owned' | 'not_owned' | 'unavailable';

/** L'objet appartient-il à l'appelant ? (client utilisateur : RLS items_all_own) */
export async function checkItemOwnership(
  userClient: SupabaseClient,
  itemId: string,
): Promise<ItemOwnership> {
  const { data, error } = await userClient
    .from('items')
    .select('id')
    .eq('id', itemId)
    .maybeSingle();
  if (error) return 'unavailable';
  return data ? 'owned' : 'not_owned';
}

/** Ligne `valuations` d'un résultat du moteur §7. */
export function valuationRow(itemId: string, result: ValuationResult): Record<string, unknown> {
  return {
    item_id: itemId,
    central: result.central,
    ci80_low: result.ci80[0],
    ci80_high: result.ci80[1],
    ci95_low: result.ci95[0],
    ci95_high: result.ci95[1],
    reliability: result.reliability,
    sources: result.observations,
  };
}

/**
 * Écrit l'estimation avec le client service-role — à n'appeler qu'APRÈS
 * checkItemOwnership(...) === 'owned'. Retourne false si l'écriture échoue.
 */
export async function storeValuation(
  adminClient: SupabaseClient,
  itemId: string,
  result: ValuationResult,
): Promise<boolean> {
  const { error } = await adminClient.from('valuations').insert(valuationRow(itemId, result));
  return !error;
}
