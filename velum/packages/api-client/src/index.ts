/**
 * @velum/api-client — client Supabase typé, Edge Functions et file de
 * mutations hors-ligne pour l'app VELUM.
 */
export { createVelumClient, type VelumClient, type VelumClientOptions } from './client';
export { createAuthApi, type AuthApi, type AuthChangeCallback } from './auth';
export { createEdgeApi, invokeEdgeFunction, type EdgeApi } from './edge';
export {
  createAlertsRepo,
  createItemsRepo,
  createProfileApi,
  createProvenanceRepo,
  createTastingNotesRepo,
  createValuationsRepo,
  type AlertsRepo,
  type ItemsRepo,
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
  newItemToRow,
  newProvenanceToRow,
  newTastingNoteToRow,
  profilePatchToRow,
  rowToAlert,
  rowToItem,
  rowToProfile,
  rowToProvenance,
  rowToTastingNote,
  rowToValuation,
  type AlertRow,
  type ItemRow,
  type NewAlert,
  type NewItem,
  type NewProvenanceEntry,
  type NewTastingNote,
  type ProfilePatch,
  type ProfileRow,
  type ProvenanceRow,
  type TastingNoteRow,
  type ValuationRow,
} from './mappers';
