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
import type { VelumClient } from '@velum/api-client';
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

/**
 * SQLSTATE d'un refus DÉFINITIF du serveur (miroir de `isDefinitiveRefusal`
 * de la file) : règle métier, donnée invalide, contrainte, droit insuffisant,
 * ligne absente (objet supprimé entre-temps).
 */
const DEFINITIVE_SQLSTATE = /^(P0001|42501|PGRST116|2[23][0-9A-Z]{3})$/;

/**
 * true si l'échec est une PANNE DE TRANSPORT (hors-ligne, serveur injoignable
 * ou momentanément indisponible) : seule raison légitime de mettre une
 * écriture en file. Un refus du serveur (règle métier P0001, contrainte,
 * donnée invalide, objet introuvable, session, offre requise) serait refusé à
 * l'identique au rejeu : il remonte à l'appelant, jamais mis en file.
 */
export function isOfflineFailure(error: unknown): boolean {
  if (!isVelumError(error)) return true; // exception brute du transport (fetch)
  if (error.code !== 'SOURCE_UNAVAILABLE') return false;
  const sqlstate = error.details?.['sqlstate'];
  return typeof sqlstate !== 'string' || !DEFINITIVE_SQLSTATE.test(sqlstate);
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
 * Qualifie l'échec d'une écriture AVANT toute mise en file. Les dépôts
 * PostgREST ne distinguent pas toujours un refus du serveur d'une coupure
 * (tout devient SOURCE_UNAVAILABLE) : on relit alors l'objet. Si la relecture
 * aboutit, le serveur était joignable et a donc refusé l'écriture (ou l'objet
 * a disparu) ; seule une relecture elle-même impossible confirme la panne.
 */
export async function classifyWriteFailure(
  items: Pick<VelumClient['items'], 'get'>,
  itemId: string,
  error: unknown,
): Promise<WriteFailure> {
  if (!isOfflineFailure(error)) return 'refused';
  try {
    return (await items.get(itemId)) === null ? 'missing' : 'refused';
  } catch {
    return 'offline';
  }
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
