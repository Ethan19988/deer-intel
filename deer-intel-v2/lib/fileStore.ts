"use client";

import { deleteIdbDatabase, runIdbTransaction } from "@/lib/idbTransaction";

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
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const database = request.result;

          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          const database = request.result;
          // Let Clear All (deleteDatabase) proceed instead of being blocked.
          database.onversionchange = () => {
            database.close();
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          databasePromise = null;
          resolve(null);
        };
      } catch {
        databasePromise = null;
        resolve(null);
      }
    });
  }

  return databasePromise;
}

// Resolves on transaction commit; `ok` is false when IndexedDB is unavailable
// or the write was rejected/aborted (e.g. storage full).
function runTransaction<Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<{ ok: boolean; value: Result | null }> {
  return openDatabase().then((database) =>
    runIdbTransaction(database, STORE_NAME, mode, work),
  );
}

/**
 * Close this tab's connection and delete the whole DB_NAME database (Clear
 * All). Resolves true once deleted, false if the browser blocked or failed it.
 */
export async function deleteFileDatabase(): Promise<boolean> {
  if (!hasIndexedDb()) return true;
  const pending = databasePromise;
  databasePromise = null;
  const open = pending ? await pending : null;
  open?.close();
  return deleteIdbDatabase(DB_NAME);
}

/**
 * Store a file's bytes. Resolves true once committed; false when IndexedDB is
 * unavailable or the write was rejected (often storage full).
 */
export function putFile(id: string, blob: Blob): Promise<boolean> {
  return runTransaction("readwrite", (store) => store.put(blob, id)).then(
    ({ ok }) => ok,
  );
}

export function getFile(id: string): Promise<Blob | null> {
  return runTransaction<Blob>("readonly", (store) => store.get(id)).then(
    ({ value }) => (value instanceof Blob ? value : null),
  );
}

export function deleteFile(id: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(id)).then(
    () => undefined,
  );
}
