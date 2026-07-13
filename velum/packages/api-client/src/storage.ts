/**
 * Adaptateur de stockage clé/valeur injectable : AsyncStorage sur mobile,
 * localStorage (promisifié) sur le web, mémoire dans les tests.
 * Sert à la fois de stockage de session Supabase et de persistance
 * de la file de mutations hors-ligne.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Stockage en mémoire — repli quand aucun adaptateur n'est fourni (tests, SSR). */
export function createMemoryStorage(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
