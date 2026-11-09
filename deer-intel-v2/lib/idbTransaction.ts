"use client";

// One IndexedDB request inside its own transaction, resolved only once the
// transaction settles: `ok` is true on commit (transaction.oncomplete), false
// when the database is unavailable, the request errors, or the transaction
// aborts (e.g. storage quota exceeded). A write that resolves `ok: true` is
// durable. Never rejects.
//
// Shared by lib/imageStore and lib/fileStore (lib/restoreUndo keeps its own
// copy of the same pattern).
export function runIdbTransaction<Result>(
  database: IDBDatabase | null,
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<{ ok: boolean; value: Result | null }> {
  return new Promise((resolve) => {
    if (!database) {
      resolve({ ok: false, value: null });
      return;
    }

    try {
      const transaction = database.transaction(storeName, mode);
      const request = work(transaction.objectStore(storeName));
      let value: Result | null = null;

      request.onsuccess = () => {
        value = request.result ?? null;
      };
      transaction.oncomplete = () => resolve({ ok: true, value });
      transaction.onerror = () => resolve({ ok: false, value: null });
      transaction.onabort = () => resolve({ ok: false, value: null });
    } catch {
      resolve({ ok: false, value: null });
    }
  });
}

/**
 * Delete a whole IndexedDB database. Resolves true once it is gone (or there
 * is no IndexedDB), false on error or if another tab keeps it open past
 * `timeoutMs` (the delete then finishes when that tab closes).
 */
export function deleteIdbDatabase(name: string, timeoutMs = 5000): Promise<boolean> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);

    try {
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
      // onblocked: another connection is still open; keep waiting for
      // success (it fires once that connection closes) until the timeout.
    } catch {
      finish(false);
    }
  });
}
