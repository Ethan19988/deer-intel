"use client";

// Uploaded photos can be several megabytes each, which would quickly blow past
// the localStorage quota used for the rest of the app state. Image blobs live in
// IndexedDB instead, keyed by a stable id, while PhotoRecord only keeps the id.

const DB_NAME = "deer-intel-images";
const DB_VERSION = 1;
const STORE_NAME = "photos";

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

export function putPhotoImage(id: string, blob: Blob): Promise<boolean> {
  return runTransaction("readwrite", (store) => store.put(blob, id)).then(
    () => true,
    () => false,
  );
}

export function getPhotoImage(id: string): Promise<Blob | null> {
  return runTransaction<Blob>("readonly", (store) => store.get(id)).then(
    (value) => (value instanceof Blob ? value : null),
  );
}

export function deletePhotoImage(id: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(id)).then(
    () => undefined,
  );
}
