/**
 * QueryClient partagé + persistance offline du cache (§6.1.5, §14 :
 * « collection consultable hors-ligne »). Le cache des données propres à
 * l'utilisateur (items, valorisations, profil, alertes, notifications) est
 * écrit dans le StorageAdapter offline, ce qui permet un démarrage à froid
 * SANS réseau. Purge à la déconnexion (`clearPersistedCache`) pour ne rien
 * laisser fuiter vers un autre compte sur un appareil partagé.
 *
 * Le wrapper `toastError` convertit les VelumError en toasts i18n — jamais
 * d'écran bloquant sur perte réseau (l'UI retombe sur l'état vide/cache).
 */
import { QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import i18n from './i18n';
import { errorMessage } from './errors';
import { offlineStorage } from './offlineStorage';
import { showToast } from '../stores/toastStore';

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24 h
export const PERSISTED_QUERY_KEY = 'velum.query-cache.v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      // Doit couvrir PERSIST_MAX_AGE : sinon le cache serait ramassé avant
      // d'être réhydraté au démarrage suivant.
      gcTime: PERSIST_MAX_AGE,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Persisteur adossé au StorageAdapter offline (MMKV natif / AsyncStorage web). */
export const queryPersister = createAsyncStoragePersister({
  storage: offlineStorage,
  key: PERSISTED_QUERY_KEY,
  throttleTime: 1000,
});

/** Familles de requêtes dont le cache est persisté (données propres au user). */
const PERSISTED_PREFIXES = ['items', 'valuations', 'alerts', 'profile', 'notifications'];

export const persistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  dehydrateOptions: {
    // Ne persiste QUE les requêtes réussies de données utilisateur.
    shouldDehydrateQuery: (query: Query) => {
      if (query.state.status !== 'success') return false;
      const root = query.queryKey[0];
      return typeof root === 'string' && PERSISTED_PREFIXES.includes(root);
    },
  },
} as const;

/** Purge le cache mémoire ET la copie persistée (à appeler à la déconnexion). */
export async function clearPersistedCache(): Promise<void> {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch {
    // best effort : au pire le buster/maxAge invalidera au prochain démarrage
  }
}

/** Affiche l'erreur en toast (message i18n selon le code VelumError). */
export function toastError(error: unknown): void {
  showToast(errorMessage(error, i18n.t.bind(i18n)), 'danger');
}
