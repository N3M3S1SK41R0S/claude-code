/**
 * Parcours de la fiche objet, sans React (client, horloge et identifiants
 * injectés → testables sous Vitest, y compris contre le client DÉMO) :
 *  - enregistrement d'un patch avec repli sur la file hors-ligne ;
 *  - correction en texte de l'identification ;
 *  - génération (chargement / régénération) de la fiche complète ;
 *  - estimation de marché à la demande ;
 *  - séquencement (correction avant estimation / fiche) et cache React Query
 *    de la fiche (objet supprimé, listes relues après une estimation).
 * Le hook `useItemSheetActions` (components/item) ne fait que les brancher
 * sur React Query.
 */
import type { QueryClient } from '@tanstack/react-query';
import { isDefinitiveRefusal, type ReplayReport, type VelumClient } from '@velum/api-client';
import { VelumError, isVelumError, type ValuationResult, type VelumItem } from '@velum/core';

import { itemToCandidate } from './analysisState';
import { correctItemIdentity, mergeAnalysisAttributes } from './itemSheet';
import { WISHLIST_QUERY_KEY } from './wishlist';

export interface ItemSheetFlowDeps {
  client: Pick<VelumClient, 'items' | 'edge' | 'queue'>;
  /** Horloge injectée (horodatage des corrections et des fiches). */
  now: () => Date;
  /** Identifiant d'une mutation mise en file hors-ligne. */
  mutationId: () => string;
}

/** Champs de l'objet modifiables depuis la fiche (identité, fiche complète, acquisition). */
export type ItemPatch = Pick<
  Partial<VelumItem>,
  'title' | 'attributes' | 'acquiredAt' | 'acquiredPrice' | 'condition' | 'notes' | 'storageLocation'
>;

export interface PersistOutcome {
  /** Objet tel qu'enregistré (ou tel qu'il le sera au rejeu de la file). */
  item: VelumItem;
  /** true : enregistrement hors-ligne, en attente de synchronisation. */
  queued: boolean;
}

/** SQLSTATE / code PGRST conservé par le dépôt (`details.sqlstate`), ou null. */
function sqlstateOf(error: unknown): string | null {
  if (!isVelumError(error)) return null;
  const sqlstate = error.details?.['sqlstate'];
  return typeof sqlstate === 'string' && sqlstate.length > 0 ? sqlstate : null;
}

/** Ligne visée absente (`update … .single()` sans ligne) : objet supprimé entre-temps. */
const ROW_NOT_FOUND = 'PGRST116';

/**
 * true si l'échec est une PANNE DE TRANSPORT (hors-ligne, serveur injoignable
 * ou momentanément indisponible) : seule raison légitime de mettre une
 * écriture en file. Un refus du serveur (règle métier P0001, contrainte,
 * donnée invalide, objet introuvable, session, offre requise) serait refusé à
 * l'identique au rejeu : il remonte à l'appelant, jamais mis en file. Un
 * SQLSTATE de refus laissé en SOURCE_UNAVAILABLE (client injecté) suit la
 * règle de la file (`isDefinitiveRefusal`).
 */
export function isOfflineFailure(error: unknown): boolean {
  if (!isVelumError(error)) return true; // exception brute du transport (fetch)
  if (error.code !== 'SOURCE_UNAVAILABLE') return false;
  const sqlstate = sqlstateOf(error);
  return sqlstate === null || !(sqlstate === ROW_NOT_FOUND || isDefinitiveRefusal({ code: sqlstate }));
}

/** Nature d'un échec d'écriture sur un objet. */
export type WriteFailure =
  /** Panne de transport confirmée : l'écriture peut partir dans la file. */
  | 'offline'
  /** Le serveur a répondu et refusé : la rejouer donnerait le même refus. */
  | 'refused'
  /** Le serveur répond mais l'objet n'existe plus (supprimé entre-temps). */
  | 'missing';

/**
 * Qualifie l'échec d'une écriture AVANT toute mise en file. Le dépôt
 * PostgREST des objets qualifie ses erreurs (`toItemsError`) : un refus y est
 * INVALID_INPUT / UNAUTHORIZED, une ligne absente porte PGRST116, et un
 * SOURCE_UNAVAILABLE qui porte un SQLSTATE est une erreur serveur
 * transitoire — aucune relecture nécessaire. Repli pour un client injecté qui
 * ne qualifie pas ses refus (échec sans SQLSTATE) : on relit l'objet ; si la
 * relecture aboutit, le serveur était joignable et a donc refusé l'écriture
 * (ou l'objet a disparu) ; seule une relecture impossible confirme la panne.
 */
export async function classifyWriteFailure(
  items: Pick<VelumClient['items'], 'get'>,
  itemId: string,
  error: unknown,
): Promise<WriteFailure> {
  const sqlstate = sqlstateOf(error);
  if (sqlstate === ROW_NOT_FOUND) return 'missing';
  if (!isOfflineFailure(error)) return 'refused';
  if (sqlstate !== null) return 'offline';
  try {
    return (await items.get(itemId)) === null ? 'missing' : 'refused';
  } catch {
    return 'offline';
  }
}

/** Refus définitifs à signaler après un rejeu de la file hors-ligne. */
export interface RejectedMutationsNotice {
  count: number;
  /** Motif rédigé par une règle serveur (P0001) du premier refus, s'il en porte un. */
  reason: string | null;
}

/**
 * Modifications hors-ligne refusées par le serveur au rejeu et retirées de la
 * file : jamais en silence. Nombre de refus (`rejected`, ou à défaut le
 * détail `rejections` ; absent d'une ancienne file = 0) et motif du PREMIER
 * refus quand c'est une règle métier (P0001, ex. « Objet engagé dans une
 * vente ») — les autres codes (contrainte, droit) ne sont jamais détaillés.
 * Null si rien n'a été refusé.
 */
export function rejectedMutationsNotice(
  report: Pick<ReplayReport, 'rejected' | 'rejections'>,
): RejectedMutationsNotice | null {
  const rejections = report.rejections ?? [];
  const count = Math.max(report.rejected ?? 0, rejections.length);
  if (count === 0) return null;
  const first = rejections[0];
  const reason = first !== undefined && first.code === 'P0001' ? first.message.trim() : '';
  return { count, reason: reason.length > 0 ? reason : null };
}

/** Valeurs AVANT modification des seuls champs du patch (fusion par champ au rejeu). */
function editedVersion(base: VelumItem, patch: ItemPatch): Record<string, unknown> {
  const version: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof ItemPatch)[]) {
    if (patch[key] !== undefined) version[key] = base[key];
  }
  return version;
}

/**
 * Enregistre un patch. Hors-ligne (panne de transport confirmée), le met en
 * file avec la version éditée — fusion par champ au rejeu — et renvoie
 * l'objet localement à jour. Un refus du serveur (ou un objet supprimé
 * entre-temps), comme un échec de la file elle-même, remonte à l'appelant :
 * rien n'est promis « synchronisé plus tard » qui ne passerait jamais.
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
  } catch (error) {
    const failure = await classifyWriteFailure(deps.client.items, base.id, error);
    if (failure === 'missing') {
      throw new VelumError('INVALID_INPUT', 'Objet introuvable : il a été supprimé entre-temps');
    }
    if (failure === 'refused') throw error;
    await deps.client.queue.enqueue({
      id: deps.mutationId(),
      table: 'items',
      type: 'update',
      payload: { id: base.id, ...patch, updatedAt },
      queuedAt: updatedAt,
      base: editedVersion(base, patch),
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

// ── Séquencement des actions de la fiche ─────────────────────────────────────

export interface CorrectionGate {
  /** Exécute une correction (une seule suivie à la fois : la dernière lancée). */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Résolue quand aucune correction n'est en cours (réussie ou non). */
  settled(): Promise<void>;
}

/**
 * Verrou de séquence : une estimation ou une fiche complète demandée PENDANT
 * l'enregistrement d'une correction attend sa fin. Sinon elle lirait
 * l'identité d'AVANT la correction tout en étant datée après elle — et
 * s'afficherait comme à jour (jamais de fausse certitude).
 */
export function createCorrectionGate(): CorrectionGate {
  let pending: Promise<unknown> | null = null;
  return {
    async run(task) {
      const current = task();
      pending = current;
      try {
        return await current;
      } finally {
        if (pending === current) pending = null;
      }
    },
    async settled() {
      await pending?.catch(() => undefined);
    },
  };
}

// ── Cache de la fiche (React Query) ──────────────────────────────────────────

/** État d'écran d'une requête (fiche objet, envies). */
export type QueryScreenState = 'loading' | 'offline' | 'error' | 'ready';

/**
 * État à afficher pour une requête React Query. Une requête EN PAUSE
 * hors-ligne sans données (`fetchStatus: 'paused'` : `isLoading` est alors
 * faux et rien n'est en erreur) donne 'offline' — jamais « liste vide » ni
 * « introuvable ». Avec des données (même périmées) : 'ready'. Une requête
 * désactivée (identifiant absent) : 'ready' sans données, l'écran décide.
 */
export function queryScreenState(query: {
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
  data: unknown;
}): QueryScreenState {
  if (query.data !== undefined) return 'ready';
  if (query.fetchStatus === 'paused') return 'offline';
  if (query.fetchStatus === 'fetching') return 'loading';
  return query.status === 'error' ? 'error' : 'ready';
}

/** Clé React Query de la fiche d'un objet (partagée par l'écran et ses sections). */
export function itemQueryKey(itemId: string): readonly unknown[] {
  return ['items', itemId];
}

/**
 * Marqueur local « objet supprimé » : jamais persisté et hors du préfixe
 * ['items'] (ni relu, ni invalidé avec la collection).
 */
export function deletedItemQueryKey(itemId: string): readonly unknown[] {
  return ['deletedItems', itemId];
}

/**
 * Dernière version connue de l'objet (une autre action a pu la modifier) ;
 * lève INVALID_INPUT s'il a été supprimé entre-temps : une action encore en
 * vol (fiche complète, correction) ne le réécrit pas.
 */
export function latestCachedItem(queryClient: QueryClient, item: VelumItem): VelumItem {
  if (queryClient.getQueryData<boolean>(deletedItemQueryKey(item.id)) === true) {
    throw new VelumError('INVALID_INPUT', 'Objet supprimé : rien à enregistrer');
  }
  return queryClient.getQueryData<VelumItem | null>(itemQueryKey(item.id)) ?? item;
}

/**
 * Après une suppression confirmée par le serveur : marqueur « supprimé » et
 * liste d'envies relue (le lien vers l'objet d'origine y est remis à NULL).
 */
export function markItemDeleted(queryClient: QueryClient, itemId: string): void {
  queryClient.setQueryData(deletedItemQueryKey(itemId), true);
  void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
}

/**
 * Après une estimation : toutes les valorisations (fiche, historique) ET les
 * listes qui lisent la dernière cote avec les objets (collection, carnet,
 * recherche globale : loadCarnetData sous ['items', …]). La fiche elle-même
 * n'a pas changé : inutile de la relire.
 */
export function refreshAfterValuation(queryClient: QueryClient, itemId: string): void {
  void queryClient.invalidateQueries({ queryKey: ['valuations'] });
  void queryClient.invalidateQueries({
    queryKey: ['items'],
    predicate: (query) => query.queryKey[1] !== itemId,
  });
}
