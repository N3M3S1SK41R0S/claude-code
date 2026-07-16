/**
 * Minimal promise-based IndexedDB wrapper — no dependency, SSR-safe.
 *
 * Stores:
 *  - questions : StoredQuestion keyed by content hash
 *  - asked     : hashes already served this bank cycle (avoid repeats)
 *  - flags     : player-reported questions, quarantined locally
 *  - scores    : match records
 *  - audio     : cached TTS blobs keyed by text hash
 *  - meta      : settings and misc key/values
 */

const DB_NAME = "grand-mogul";
const DB_VERSION = 1;

export type StoreName = "questions" | "asked" | "flags" | "scores" | "audio" | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("questions")) {
          const store = db.createObjectStore("questions", { keyPath: "hash" });
          store.createIndex("theme", "theme", { unique: false });
        }
        if (!db.objectStoreNames.contains("asked")) db.createObjectStore("asked", { keyPath: "hash" });
        if (!db.objectStoreNames.contains("flags")) db.createObjectStore("flags", { keyPath: "hash" });
        if (!db.objectStoreNames.contains("scores")) db.createObjectStore("scores", { keyPath: "id" });
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "key" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return tx(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  },
  getAll<T>(store: StoreName): Promise<T[]> {
    return tx(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  },
  getAllKeys(store: StoreName): Promise<IDBValidKey[]> {
    return tx(store, "readonly", (s) => s.getAllKeys());
  },
  put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
    return tx(store, "readwrite", (s) => s.put(value));
  },
  delete(store: StoreName, key: IDBValidKey): Promise<undefined> {
    return tx(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
  },
  clear(store: StoreName): Promise<undefined> {
    return tx(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
  },
  count(store: StoreName): Promise<number> {
    return tx(store, "readonly", (s) => s.count());
  },
};
