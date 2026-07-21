"use client";

import {
  deleteCloudImage,
  downloadCloudImage,
  uploadCloudImage,
} from "@/lib/cloudImages";

// Uploaded photos can be several megabytes each, which would quickly blow past
// the localStorage quota used for the rest of the app state. Image blobs live in
// IndexedDB instead, keyed by a stable id, while PhotoRecord only keeps the id.
//
// IndexedDB is per-device and can be evicted by the browser, so every put is
// also backed up to per-user Supabase Storage (lib/cloudImages) when signed in,
// and a local miss falls back to the cloud copy. Both are best-effort: with
// cloud sync off, this behaves exactly like plain local IndexedDB.

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
    () => {
      // Back up to the cloud without blocking the local save.
      void uploadCloudImage(id, blob);
      return true;
    },
    () => false,
  );
}

// Read only the local (IndexedDB) copy — no cloud fallback. Used by the backup
// sweep (to know what actually lives here) and by getPhotoImage.
function readLocalImage(id: string): Promise<Blob | null> {
  return runTransaction<Blob>("readonly", (store) => store.get(id)).then(
    (value) => (value instanceof Blob ? value : null),
  );
}

export async function getPhotoImage(id: string): Promise<Blob | null> {
  const local = await readLocalImage(id);

  if (local) return local;

  // Local miss — evicted here, or saved on another device. Pull the cloud
  // backup and re-cache it so thumbnails and the AI re-read work on this device
  // too. Returns null (unchanged behavior) when there is no cloud copy.
  const cloud = await downloadCloudImage(id);

  if (cloud) {
    void runTransaction("readwrite", (store) => store.put(cloud, id));
    return cloud;
  }

  return null;
}

export function deletePhotoImage(id: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(id)).then(() => {
    void deleteCloudImage(id);
  });
}

/** Every image id stored locally on this device. */
function getAllLocalImageIds(): Promise<string[]> {
  return runTransaction<IDBValidKey[]>("readonly", (store) =>
    store.getAllKeys(),
  ).then((keys) => (Array.isArray(keys) ? keys.map(String) : []));
}

/**
 * Upload every image already saved on THIS device to the cloud backup — the
 * catch-up for photos saved before backup existed. Run it on the device that
 * holds the pictures (usually the phone). Best-effort and idempotent: images
 * already backed up just re-upsert.
 */
export async function backupLocalImages(
  onProgress?: (done: number, total: number) => void,
): Promise<{ total: number; uploaded: number; failed: number }> {
  const ids = await getAllLocalImageIds();
  let uploaded = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += 1) {
    const blob = await readLocalImage(ids[index]);

    if (blob) {
      const ok = await uploadCloudImage(ids[index], blob);

      if (ok) uploaded += 1;
      else failed += 1;
    }

    onProgress?.(index + 1, ids.length);
  }

  return { total: ids.length, uploaded, failed };
}
