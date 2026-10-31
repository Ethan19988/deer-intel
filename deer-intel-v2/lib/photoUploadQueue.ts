// Pure helpers for the pending photo-upload queue in lib/imageStore. Kept
// separate (no browser APIs) so they can be unit tested.

const BASE_RETRY_MS = 15_000;
const MAX_RETRY_MS = 15 * 60_000;

/** The stored queue, tolerating missing or corrupt values. */
export function parsePendingIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0)),
    ];
  } catch {
    return [];
  }
}

/** The queue with `id` added (unchanged array when already queued). */
export function addPendingId(ids: string[], id: string): string[] {
  return !id || ids.includes(id) ? ids : [...ids, id];
}

/** The queue without `id` (the same array when it wasn't queued). */
export function removePendingId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : ids;
}

/** Exponential backoff after `failedRuns` failed passes: 15 s doubling, capped at 15 min. */
export function retryDelayMs(failedRuns: number): number {
  const exponent = Math.max(0, Math.min(failedRuns - 1, 10));
  return Math.min(BASE_RETRY_MS * 2 ** exponent, MAX_RETRY_MS);
}
