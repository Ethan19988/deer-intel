"use client";

// Attached documents (PDFs, images, and any other file the hunter uploads) can
// be several megabytes each, far past the localStorage quota that holds the
// rest of the app state. Their bytes live in IndexedDB instead, keyed by a
// stable id, while DocumentRecord only keeps that id.
//
// This is intentionally local-only and separate from lib/imageStore: trail-cam
// photos back up to Supabase Storage as images, but a lease PDF or license is
// personal paperwork that stays on the device by default.

const DB_NAME = "deer-intel-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

let databasePromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);

  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        resolve(null);
      };
    });
  }

  return databasePromise;
}

function runTransaction<Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result | null> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve) => {
        if (!database) {
          resolve(null);
          return;
        }

        try {
          const transaction = database.transaction(STORE_NAME, mode);
          const request = work(transaction.objectStore(STORE_NAME));

          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** Store a file's bytes. Returns false when the browser blocked the write. */
export function putFile(id: string, blob: Blob): Promise<boolean> {
  return runTransaction("readwrite", (store) => store.put(blob, id)).then(
    () => true,
    () => false,
  );
}

export function getFile(id: string): Promise<Blob | null> {
  return runTransaction<Blob>("readonly", (store) => store.get(id)).then(
    (value) => (value instanceof Blob ? value : null),
  );
}

export function deleteFile(id: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(id)).then(
    () => undefined,
  );
}
