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
  createValuationsRepo,
  type AlertsRepo,
  type ItemsRepo,
  type ProfileApi,
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
  profilePatchToRow,
  rowToAlert,
  rowToItem,
  rowToProfile,
  rowToValuation,
  type AlertRow,
  type ItemRow,
  type NewAlert,
  type NewItem,
  type ProfilePatch,
  type ProfileRow,
  type ValuationRow,
} from './mappers';
