/**
 * Parcours de la fiche objet, sans React (client, horloge et identifiants
 * injectés → testables sous Vitest, y compris contre le client DÉMO) :
 *  - enregistrement d'un patch avec repli sur la file hors-ligne ;
 *  - correction en texte de l'identification ;
 *  - génération (chargement / régénération) de la fiche complète ;
 *  - estimation de marché à la demande.
 * Le hook `useItemSheetActions` (components/item) ne fait que les brancher
 * sur React Query.
 */
import type { VelumClient } from '@velum/api-client';
import { VelumError, type ValuationResult, type VelumItem } from '@velum/core';

import { itemToCandidate } from './analysisState';
import { correctItemIdentity, mergeAnalysisAttributes } from './itemSheet';

export interface ItemSheetFlowDeps {
  client: Pick<VelumClient, 'items' | 'edge' | 'queue'>;
  /** Horloge injectée (horodatage des corrections et des fiches). */
  now: () => Date;
  /** Identifiant d'une mutation mise en file hors-ligne. */
  mutationId: () => string;
}

export type ItemPatch = Pick<Partial<VelumItem>, 'title' | 'attributes'>;

export interface PersistOutcome {
  /** Objet tel qu'enregistré (ou tel qu'il le sera au rejeu de la file). */
  item: VelumItem;
  /** true : enregistrement hors-ligne, en attente de synchronisation. */
  queued: boolean;
}

/**
 * Enregistre un patch ; en cas d'échec (hors-ligne…), le met en file
 * (last-write-wins au rejeu) et renvoie l'objet localement à jour.
 * Seul un échec de la file elle-même remonte à l'appelant.
 */
export async function persistItemPatch(
  deps: ItemSheetFlowDeps,
  base: VelumItem,
  patch: ItemPatch,
): Promise<PersistOutcome> {
  const updatedAt = deps.now().toISOString();
  try {
    const item = await deps.client.items.update(base.id, { ...patch, updatedAt });
    return { item, queued: false };
  } catch {
    await deps.client.queue.enqueue({
      id: deps.mutationId(),
      table: 'items',
      type: 'update',
      payload: { id: base.id, ...patch, updatedAt },
      queuedAt: updatedAt,
    });
    return { item: { ...base, ...patch, updatedAt }, queued: true };
  }
}

export interface CorrectionFlowResult {
  /** false : aucune valeur réellement modifiée, rien n'a été enregistré. */
  changed: boolean;
  identityChanged: boolean;
  queued: boolean;
  item: VelumItem;
}

/** Corrige l'identification (désignation + champs du domaine) et l'enregistre. */
export async function saveIdentityCorrection(
  deps: ItemSheetFlowDeps,
  base: VelumItem,
  input: { title: string; values: Record<string, string> },
): Promise<CorrectionFlowResult> {
  const outcome = correctItemIdentity({ item: base, values: input.values, title: input.title, now: deps.now() });
  if (!outcome.changed) return { changed: false, identityChanged: false, queued: false, item: base };
  const saved = await persistItemPatch(deps, base, { title: outcome.title, attributes: outcome.attributes });
  return { changed: true, identityChanged: outcome.identityChanged, queued: saved.queued, item: saved.item };
}

/**
 * Génère la fiche complète (edge.analyze) puis la fusionne dans la version la
 * PLUS RÉCENTE de l'objet (`latest`, relu après la génération : une correction
 * a pu survenir pendant ces quelques secondes). `analyzedAt` = instant de la
 * demande, pour qu'une telle correction rende la fiche « périmée ».
 */
export async function generateFullSheet(
  deps: ItemSheetFlowDeps,
  latest: () => VelumItem,
): Promise<PersistOutcome> {
  const requestedAt = deps.now();
  const target = latest();
  const result = await deps.client.edge.analyze(target.domain, itemToCandidate(target));
  const base = latest();
  const attributes = mergeAnalysisAttributes(base.attributes, result, requestedAt);
  if (attributes === null) {
    throw new VelumError('ANALYSIS_FAILED', 'Fiche complète inexploitable (payload invalide)');
  }
  return persistItemPatch(deps, base, { attributes });
}

/** Estimation de marché à la demande, persistée côté serveur (itemId fourni). */
export function revalueItem(deps: ItemSheetFlowDeps, item: VelumItem): Promise<ValuationResult> {
  return deps.client.edge.valuate(item.domain, itemToCandidate(item), item.id);
}
