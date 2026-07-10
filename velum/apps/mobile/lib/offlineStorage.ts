/**
 * StorageAdapter offline-first de l'app : MMKV si le module natif est
 * disponible (build natif), sinon AsyncStorage (Expo Go et web).
 * JAMAIS localStorage direct — AsyncStorage l'encapsule proprement sur web.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { StorageAdapter } from '@velum/api-client';

/** Adaptateur AsyncStorage — repli universel (Expo Go, web, natif sans MMKV). */
function createAsyncStorageAdapter(): StorageAdapter {
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    async setItem(key, value) {
      await AsyncStorage.setItem(key, value);
    },
    async removeItem(key) {
      await AsyncStorage.removeItem(key);
    },
  };
}

/** Interface minimale d'une instance MMKV (évite la dépendance de type dure). */
interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Résolution paresseuse du backend : MMKV natif si présent, sinon AsyncStorage. */
let backendPromise: Promise<StorageAdapter> | null = null;

async function resolveBackend(): Promise<StorageAdapter> {
  if (Platform.OS === 'web') return createAsyncStorageAdapter();
  try {
    // Import dynamique : échoue proprement en Expo Go (module natif absent).
    const mod = (await import('react-native-mmkv')) as unknown as {
      MMKV: new (config?: { id?: string }) => MmkvLike;
    };
    const store = new mod.MMKV({ id: 'velum' });
    // Sonde d'écriture : certains environnements n'échouent qu'à l'usage.
    store.set('velum.storage.probe', '1');
    store.delete('velum.storage.probe');
    return {
      async getItem(key) {
        return store.getString(key) ?? null;
      },
      async setItem(key, value) {
        store.set(key, value);
      },
      async removeItem(key) {
        store.delete(key);
      },
    };
  } catch {
    return createAsyncStorageAdapter();
  }
}

function getBackend(): Promise<StorageAdapter> {
  if (backendPromise === null) backendPromise = resolveBackend();
  return backendPromise;
}

/**
 * Adaptateur exposé à l'app : chaque appel délègue au backend résolu
 * paresseusement — l'interface reste 100 % asynchrone donc transparente.
 */
export function createOfflineStorage(): StorageAdapter {
  return {
    getItem: async (key) => (await getBackend()).getItem(key),
    setItem: async (key, value) => (await getBackend()).setItem(key, value),
    removeItem: async (key) => (await getBackend()).removeItem(key),
  };
}

/** Instance partagée (session Supabase, file de mutations, réglages persistés). */
export const offlineStorage: StorageAdapter = createOfflineStorage();
