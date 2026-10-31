"use client";

import { useSyncExternalStore } from "react";
import {
  deleteCloudImage,
  downloadCloudImage,
  uploadCloudImage,
} from "@/lib/cloudImages";
import {
  addPendingId,
  parsePendingIds,
  removePendingId,
  retryDelayMs,
} from "@/lib/photoUploadQueue";
import { isCloudSyncConfigured } from "@/lib/supabaseClient";

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

// --- Pending cloud uploads ---------------------------------------------------
// Photo ids saved locally whose cloud backup hasn't succeeded yet (taken
// offline, signed out, or the upload failed). Persisted so they upload on a
// later sign-in, reconnect or app focus instead of staying device-only.

const PENDING_UPLOADS_KEY = "deer-intel:pending-photo-uploads";
const PENDING_CHANGE_EVENT = "deer-intel:pending-photo-uploads-change";
const EMPTY_PENDING: string[] = [];

let cachedPendingRaw: string | null = null;
let cachedPending: string[] = EMPTY_PENDING;

function readPendingUploads(): string[] {
  if (typeof window === "undefined") return EMPTY_PENDING;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PENDING_UPLOADS_KEY);
  } catch {
    return EMPTY_PENDING;
  }
  if (raw === cachedPendingRaw) return cachedPending;
  cachedPendingRaw = raw;
  cachedPending = parsePendingIds(raw);
  return cachedPending;
}

function writePendingUploads(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (ids.length === 0) window.localStorage.removeItem(PENDING_UPLOADS_KEY);
    else window.localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: the photo is still saved locally, and the
    // manual "Back Up My Photos" sweep still finds it.
  }
  window.dispatchEvent(new Event(PENDING_CHANGE_EVENT));
}

function markPendingUpload(id: string) {
  writePendingUploads(addPendingId(readPendingUploads(), id));
}

function clearPendingUpload(id: string) {
  const current = readPendingUploads();
  const next = removePendingId(current, id);
  if (next !== current) writePendingUploads(next);
}

// Upload one photo, keeping it queued until the cloud copy is confirmed.
async function uploadAndTrack(id: string, blob: Blob): Promise<boolean> {
  const ok = await uploadCloudImage(id, blob);
  if (ok) clearPendingUpload(id);
  return ok;
}

let queueRun: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failedRuns = 0;
// True while startPhotoUploadQueue is running (signed in); retries stop
// scheduling once it is torn down.
let queueActive = false;

/**
 * Try every queued upload once. Photos whose local copy is gone (deleted)
 * drop out of the queue. On failure, retries itself with backoff.
 */
export function flushPendingPhotoUploads(): Promise<void> {
  if (queueRun) return queueRun;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  queueRun = (async () => {
    let failed = 0;
    for (const id of [...readPendingUploads()]) {
      const blob = await readLocalImage(id);
      if (!blob) {
        clearPendingUpload(id);
        continue;
      }
      if (!(await uploadAndTrack(id, blob))) failed += 1;
    }

    if (failed > 0 && queueActive) {
      failedRuns += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flushPendingPhotoUploads();
      }, retryDelayMs(failedRuns));
    } else {
      failedRuns = 0;
    }
  })().finally(() => {
    queueRun = null;
  });

  return queueRun;
}

/**
 * Keep retrying queued uploads while signed in: now, when the connection comes
 * back, and when the app regains focus. Returns a cleanup function.
 */
export function startPhotoUploadQueue(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const retry = () => {
    // A fresh trigger (online/focus) gets a fresh backoff.
    failedRuns = 0;
    void flushPendingPhotoUploads();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") retry();
  };

  queueActive = true;
  retry();
  window.addEventListener("online", retry);
  window.addEventListener("focus", retry);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("online", retry);
    window.removeEventListener("focus", retry);
    document.removeEventListener("visibilitychange", onVisibility);
    queueActive = false;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
}

function subscribePendingUploads(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PENDING_UPLOADS_KEY) onChange();
  };
  window.addEventListener(PENDING_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PENDING_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** How many photos are still waiting to upload to the cloud backup. */
export function usePendingPhotoUploadCount(): number {
  return useSyncExternalStore(
    subscribePendingUploads,
    () => readPendingUploads().length,
    () => 0,
  );
}

export function putPhotoImage(id: string, blob: Blob): Promise<boolean> {
  return runTransaction("readwrite", (store) => store.put(blob, id)).then(
    () => {
      // Back up to the cloud without blocking the local save. Queued first so
      // an offline or signed-out save still uploads later.
      if (isCloudSyncConfigured()) {
        markPendingUpload(id);
        void uploadAndTrack(id, blob);
      }
      return true;
    },
    () => false,
  );
}

// Read only the local (IndexedDB) copy — no cloud fallback. Used by the backup
// sweep (to know what actually lives here) and by getPhotoImage.
export function readLocalImage(id: string): Promise<Blob | null> {
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
    clearPendingUpload(id);
    void deleteCloudImage(id);
  });
}

/** Every image id stored locally on this device. */
export function getAllLocalImageIds(): Promise<string[]> {
  return runTransaction<IDBValidKey[]>("readonly", (store) =>
    store.getAllKeys(),
  ).then((keys) => (Array.isArray(keys) ? keys.map(String) : []));
}

/**
 * Write an image blob straight to local IndexedDB. Unlike putPhotoImage this
 * does not kick off a cloud upload — it restores a photo from a full-backup file
 * on the device the user is importing to. When signed in, the caller backs the
 * restored ids up with backupLocalImages(onProgress, ids).
 */
export function restoreLocalImage(id: string, blob: Blob): Promise<boolean> {
  return runTransaction("readwrite", (store) => store.put(blob, id)).then(
    () => {
      // Queued so it reaches the cloud backup on the next sign-in even if the
      // caller's immediate backup can't run (signed out / offline).
      if (isCloudSyncConfigured()) markPendingUpload(id);
      return true;
    },
    () => false,
  );
}

/**
 * Upload every image already saved on THIS device to the cloud backup — the
 * catch-up for photos saved before backup existed. Run it on the device that
 * holds the pictures (usually the phone). Best-effort and idempotent: images
 * already backed up just re-upsert. Pass `onlyIds` to back up just those (e.g.
 * the images a full-backup restore just wrote).
 */
export async function backupLocalImages(
  onProgress?: (done: number, total: number) => void,
  onlyIds?: string[],
): Promise<{ total: number; uploaded: number; failed: number }> {
  const ids = onlyIds ?? (await getAllLocalImageIds());
  let uploaded = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += 1) {
    const blob = await readLocalImage(ids[index]);

    if (blob) {
      const ok = await uploadAndTrack(ids[index], blob);

      if (ok) uploaded += 1;
      else failed += 1;
    }

    onProgress?.(index + 1, ids.length);
  }

  return { total: ids.length, uploaded, failed };
}
