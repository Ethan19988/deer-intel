import type { SavedAiScoutReport } from "@/lib/aiScoutHistory";
import type { AiScoutRequestContext } from "@/types/aiScout";

// "Nothing has changed" reuse for AI Scout. Before calling the server, the AI
// page hashes the exact payload it would send (property data + conditions).
// If this property's saved report was made from the same payload recently,
// it's shown again instead of spending a call from the daily quota.

/** How long a saved report counts as current when nothing in the payload changed. */
export const AI_SCOUT_REUSE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// Allow a little clock skew (or a device clock nudged back) before treating
// a "future" save as suspicious.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Deterministic JSON: object keys sorted, strings trimmed, undefined dropped
 * (as JSON.stringify does), so equal payloads always serialize the same.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") return JSON.stringify(value.trim());
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stableStringify(item))).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .filter((key) => record[key] !== undefined && typeof record[key] !== "function")
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(",")}}`;
}

/** Two independent 32-bit string hashes (FNV-1a and a djb2 variant), as 16 hex chars. */
function hash64(text: string): string {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    fnv ^= code;
    fnv = Math.imul(fnv, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(fnv) + hex(djb);
}

/** Fingerprint of the payload AI Scout would be asked about. */
export function hashAiScoutContext(context: AiScoutRequestContext): string {
  return `v1:${hash64(stableStringify(context))}`;
}

/**
 * The saved report, when it was made from this exact payload and is still
 * fresh; otherwise null (so the caller asks the server).
 */
export function findReusableAiScoutReport(
  saved: SavedAiScoutReport | null,
  contextHash: string,
  nowMs: number,
  maxAgeMs: number = AI_SCOUT_REUSE_MAX_AGE_MS,
): SavedAiScoutReport | null {
  if (!saved || !saved.contextHash || saved.contextHash !== contextHash) return null;
  const age = nowMs - saved.savedAt;
  if (age < -CLOCK_SKEW_MS || age >= maxAgeMs) return null;
  return saved;
}

/** "9:42 AM" today, "Oct 30, 9:42 AM" otherwise (viewer's locale and zone). */
export function formatSavedTime(savedAt: number, nowMs: number): string {
  const saved = new Date(savedAt);
  const now = new Date(nowMs);
  const sameDay =
    saved.getFullYear() === now.getFullYear() &&
    saved.getMonth() === now.getMonth() &&
    saved.getDate() === now.getDate();
  const time = saved.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  return `${saved.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
