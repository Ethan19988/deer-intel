"use client";

import { useSyncExternalStore } from "react";
import type { LandTags } from "@/lib/landTags";
import type { DeerIntelState } from "@/types/deerIntelStore";

// Before a backup file replaces this device's records, the current records
// (and land tags) are kept here for 24 hours so the restore can be undone.
// Records only — photo and document bytes live in their own IndexedDB stores
// and a restore only adds/overwrites those by id, never removes them.
//
// Stored in IndexedDB (a full state can be larger than the localStorage room
// left on a busy phone), with localStorage as a fallback where IndexedDB is
// unavailable.

export const RESTORE_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

const DB_NAME = "deer-intel-restore-undo";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_ID = "latest";
const FALLBACK_KEY = "deer-intel:restore-undo";

export type RestoreUndoSnapshot = {
  state: DeerIntelState;
  landTags?: LandTags;
  // ISO time the restore replaced this state.
  at: string;
  // Name of the backup file that replaced it.
  fileName: string;
};

/** True while the snapshot is still within the undo window. */
export function isRestoreUndoFresh(
  snapshot: Pick<RestoreUndoSnapshot, "at"> | null,
  now = Date.now(),
): boolean {
  if (!snapshot) return false;
  const at = Date.parse(snapshot.at);
  return Number.isFinite(at) && now - at >= 0 && now - at < RESTORE_UNDO_WINDOW_MS;
}

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);

  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
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

function run<Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<{ ok: boolean; value: Result | null }> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve) => {
        if (!database) {
          resolve({ ok: false, value: null });
          return;
        }
        try {
          const transaction = database.transaction(STORE_NAME, mode);
          const request = work(transaction.objectStore(STORE_NAME));
          let value: Result | null = null;
          request.onsuccess = () => {
            value = request.result ?? null;
          };
          // Resolve on commit so a write is durable before the caller moves on.
          transaction.oncomplete = () => resolve({ ok: true, value });
          transaction.onerror = () => resolve({ ok: false, value: null });
          transaction.onabort = () => resolve({ ok: false, value: null });
        } catch {
          resolve({ ok: false, value: null });
        }
      }),
  );
}

function readFallback(): RestoreUndoSnapshot | null {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as RestoreUndoSnapshot) : null;
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is RestoreUndoSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RestoreUndoSnapshot).at === "string" &&
    typeof (value as RestoreUndoSnapshot).state === "object" &&
    (value as RestoreUndoSnapshot).state !== null
  );
}

// --- Subscription (Settings shows "Undo restore" while one is available) ----

const listeners = new Set<() => void>();
let current: RestoreUndoSnapshot | null = null;
let loaded = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    void readRestoreUndo().then((snapshot) => {
      current = snapshot;
      notify();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keep `snapshot` as the one undo point (replacing any older one). Resolves
 * true once it is safely stored.
 */
export async function saveRestoreUndo(snapshot: RestoreUndoSnapshot): Promise<boolean> {
  // JSON round-trip: IndexedDB's structured clone would keep any odd values,
  // and the snapshot should match what a backup file would hold.
  const plain = JSON.parse(JSON.stringify(snapshot)) as RestoreUndoSnapshot;
  const { ok } = await run("readwrite", (store) => store.put(plain, SNAPSHOT_ID));
  let saved = ok;

  if (ok) {
    clearFallback();
  } else if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(plain));
      saved = true;
    } catch {
      saved = false;
    }
  }

  if (saved) {
    current = plain;
    loaded = true;
    notify();
  }
  return saved;
}

/** The undo point, or null when there's none or it's older than 24 hours. */
export async function readRestoreUndo(): Promise<RestoreUndoSnapshot | null> {
  if (typeof window === "undefined") return null;
  const { value } = await run<unknown>("readonly", (store) => store.get(SNAPSHOT_ID));
  const snapshot = isSnapshot(value) ? value : readFallback();

  if (!isSnapshot(snapshot)) return null;
  if (!isRestoreUndoFresh(snapshot)) {
    void clearRestoreUndo();
    return null;
  }
  return snapshot;
}

function clearFallback() {
  try {
    window.localStorage.removeItem(FALLBACK_KEY);
  } catch {
    // Ignore.
  }
}

export async function clearRestoreUndo(): Promise<void> {
  if (typeof window === "undefined") return;
  await run("readwrite", (store) => store.delete(SNAPSHOT_ID));
  clearFallback();
  current = null;
  notify();
}

function getSnapshot(): RestoreUndoSnapshot | null {
  return isRestoreUndoFresh(current) ? current : null;
}

/** The undo point while it's available (re-checked on each render). */
export function useRestoreUndo(): RestoreUndoSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
