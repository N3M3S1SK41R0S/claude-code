/**
 * @velum/api-client — client Supabase typé, Edge Functions et file de
 * mutations hors-ligne pour l'app VELUM.
 */
export { createVelumClient, type VelumClient, type VelumClientOptions } from './client';
export { createAuthApi, type AuthApi, type AuthChangeCallback } from './auth';
export { createEdgeApi, invokeEdgeFunction, type EdgeApi } from './edge';
export {
  createItemMediaRepo,
  newItemMediaToRow,
  rowToItemMedia,
  type ItemMediaRepo,
  type ItemMediaRow,
  type NewItemMedia,
} from './item-media';
export {
  createAlertsRepo,
  createItemsRepo,
  createMarketplaceRepo,
  createProfileApi,
  createProvenanceRepo,
  createTastingNotesRepo,
  createValuationsRepo,
  type AlertsRepo,
  type ItemsRepo,
  type MarketplaceRepo,
  type ProfileApi,
  type ProvenanceRepo,
  type TastingNotesRepo,
  type ValuationsRepo,
} from './repos';
export {
  MutationQueue,
  MUTATION_QUEUE_STORAGE_KEY,
  type QueuedMutation,
  type ReplayReport,
} from './queue';
export { createMemoryStorage, type StorageAdapter } from './storage';
export {
  alertToRow,
  itemPatchToRow,
  itemPayloadToRow,
  itemToRow,
  jsonToReputation,
  newItemToRow,
  newListingToRow,
  newProvenanceToRow,
  newTastingNoteToRow,
  profilePatchToRow,
  rowToAlert,
  rowToDispute,
  rowToItem,
  rowToListing,
  rowToOrder,
  rowToProfile,
  rowToProvenance,
  rowToTastingNote,
  rowToValuation,
  type AlertRow,
  type DisputeRow,
  type ItemRow,
  type ListingRow,
  type NewAlert,
  type NewItem,
  type NewListing,
  type NewProvenanceEntry,
  type NewTastingNote,
  type OrderRow,
  type ProfilePatch,
  type ProfileRow,
  type ProvenanceRow,
  type TastingNoteRow,
  type ValuationRow,
} from './mappers';
