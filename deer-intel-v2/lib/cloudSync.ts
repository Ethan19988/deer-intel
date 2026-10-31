"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { isUntouchedLegacySeedProperty } from "@/lib/deerIntelStore";
import { sanitizeLandTags, type LandTag, type LandTags } from "@/lib/landTags";
import type { DeerIntelState } from "@/types/deerIntelStore";

// One JSONB row per user holds the whole DeerIntelState (plus the device's land
// tags). See supabase/schema.sql for the table definition and row-level
// security policies.
const TABLE_NAME = "deer_intel_state";

/**
 * What one cloud row holds: the record state plus parcel land tags. landTags is
 * optional so rows written by older builds (no tags) still load.
 */
export type SyncedState = DeerIntelState & { landTags?: LandTags };

/** The record state with this device's land tags attached, ready to sync. */
export function withLandTags(state: DeerIntelState, landTags: LandTags): SyncedState {
  return { ...state, landTags };
}

/** Split a synced row back into the record state and its land tags. */
export function splitLandTags(synced: SyncedState): {
  state: DeerIntelState;
  landTags: LandTags | undefined;
} {
  const { landTags, ...state } = synced;
  return {
    state: state as DeerIntelState,
    landTags: landTags === undefined ? undefined : sanitizeLandTags(landTags),
  };
}

// Local bookkeeping so we can reconcile without silently clobbering data and so
// the push effect can tell a real edit from an echo of a pull we just applied.
const SYNC_META_KEY = "deer-intel:sync-meta";

export type SyncMeta = {
  // Server updated_at of the cloud row as last seen by this device (after a
  // push or pull). Pushes are conditional on it still matching, so a device
  // that fell behind merges instead of overwriting newer saves.
  updatedAt: string;
  // True while this device has edits the cloud hasn't received yet (still in
  // the push debounce, offline, or a failed push). Survives reloads so a
  // newer cloud copy never silently replaces them.
  pendingLocalEdits?: boolean;
  // Account the bookkeeping belongs to.
  userId?: string;
  // Per-record fingerprints of the state at the last sync (the merge base).
  // Ids in the base but missing locally are this device's deletions since the
  // last sync (tombstones), so a merge never resurrects them.
  base?: SyncBase;
};

export type RemoteState = {
  state: SyncedState;
  updatedAt: string;
};

export type ReconcileDecision =
  | { action: "push"; reason: string }
  | { action: "pull"; state: SyncedState; reason: string }
  | { action: "in-sync"; reason: string };

function isDefaultOnlyProperties(state: DeerIntelState): boolean {
  // A brand-new local store now starts with no properties at all. Older stores
  // still carry the two seeded sample properties. Treat either — an empty list,
  // or only untouched samples — as "no real data the user typed".
  return state.properties.every(isUntouchedLegacySeedProperty);
}

/**
 * True when the state contains anything the hunter actually created: any
 * asset/record, or properties that differ from the seeded defaults. Used to
 * guard the first reconcile so we never overwrite real cloud data with a fresh
 * local default state (or vice versa).
 */
export function hasMeaningfulData(state: DeerIntelState): boolean {
  if (
    state.cameras.length > 0 ||
    state.cameraChecks.length > 0 ||
    state.stands.length > 0 ||
    state.pins.length > 0 ||
    state.hunts.length > 0 ||
    state.photoRecords.length > 0 ||
    state.deerProfiles.length > 0 ||
    state.walkTracks.length > 0 ||
    state.documents.length > 0 ||
    Object.keys((state as SyncedState).landTags ?? {}).length > 0
  ) {
    return true;
  }

  return !isDefaultOnlyProperties(state);
}

export function readSyncMeta(): SyncMeta | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof parsed.updatedAt !== "string") return null;

    // Older builds also stored a full copy of the state here
    // (lastSyncedSnapshot), doubling localStorage use; it is dropped on the
    // next write.
    return {
      updatedAt: parsed.updatedAt,
      pendingLocalEdits: parsed.pendingLocalEdits === true,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
      base: sanitizeSyncBase(parsed.base),
    };
  } catch {
    return null;
  }
}

export function writeSyncMeta(meta: SyncMeta): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore write failures (e.g. private mode / quota); sync stays best-effort.
  }
}

// Which account the local data on this device belongs to. Unlike sync meta it
// survives sign-out, so a DIFFERENT account signing in next is detected instead
// of silently receiving (or overwriting) the previous person's data.
const DEVICE_OWNER_KEY = "deer-intel:device-owner";

export type DeviceOwner = {
  userId: string;
  // True when the owner signed out with edits their cloud never received.
  unsyncedEdits?: boolean;
};

export function readDeviceOwner(): DeviceOwner | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DEVICE_OWNER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DeviceOwner>;
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;

    return { userId: parsed.userId, unsyncedEdits: parsed.unsyncedEdits === true };
  } catch {
    return null;
  }
}

export function writeDeviceOwner(owner: DeviceOwner): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DEVICE_OWNER_KEY, JSON.stringify(owner));
  } catch {
    // Ignore; the owner check is a best-effort guard.
  }
}

export type AccountSwitch = {
  previousUserId: string;
  // The previous account's local edits never reached its cloud, so loading the
  // new account's data would lose them.
  unsyncedEdits: boolean;
};

/**
 * On sign-in: does this device hold real data that belongs to a DIFFERENT
 * account than the one signing in? Returns null for a first-ever sign-in (no
 * known owner), the same account, or a device with nothing worth keeping —
 * those reconcile normally. Owner comes from the persisted device owner, or the
 * sync meta when the previous session never signed out.
 */
export function detectAccountSwitch(
  local: DeerIntelState,
  owner: DeviceOwner | null,
  meta: SyncMeta | null,
  signingInUserId: string,
): AccountSwitch | null {
  const previousUserId = meta?.userId ?? owner?.userId;

  if (!previousUserId || previousUserId === signingInUserId) return null;
  if (!hasMeaningfulData(local)) return null;

  const unsyncedEdits =
    (meta?.userId === previousUserId && meta.pendingLocalEdits === true) ||
    (owner?.userId === previousUserId && owner.unsyncedEdits === true);

  return { previousUserId, unsyncedEdits };
}

/**
 * The sync meta only when it belongs to `userId`. Sign-out keeps the meta (and
 * with it the merge base) so the same account signing back in still knows
 * what this device deleted; any other account must start without it, or its
 * merge would treat the previous account's records as tombstones. Meta with no
 * userId (very old builds) is never reused.
 */
export function syncMetaForUser(meta: SyncMeta | null, userId: string): SyncMeta | null {
  return meta && meta.userId && meta.userId === userId ? meta : null;
}

export function clearSyncMeta(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SYNC_META_KEY);
  } catch {
    // Ignore.
  }
}

export function serializeState(state: SyncedState): string {
  return JSON.stringify(state);
}

// --- Merge ------------------------------------------------------------------
// Every record list in DeerIntelState is merged by record id. Land tags are
// merged the same way, keyed by owner (landTagKey).

export const SYNC_COLLECTIONS = [
  "properties",
  "cameras",
  "cameraChecks",
  "stands",
  "pins",
  "hunts",
  "photoRecords",
  "deerProfiles",
  "walkTracks",
  "documents",
] as const;

type SyncCollection = (typeof SYNC_COLLECTIONS)[number];
type BaseKey = SyncCollection | "landTags";

/** id -> fingerprint of each record at the last sync, per collection. */
export type SyncBase = Partial<Record<BaseKey, Record<string, string>>>;

const BASE_KEYS: readonly BaseKey[] = [...SYNC_COLLECTIONS, "landTags"];

function sanitizeSyncBase(value: unknown): SyncBase | undefined {
  if (!value || typeof value !== "object") return undefined;

  const base: SyncBase = {};
  for (const key of BASE_KEYS) {
    const entries = (value as Record<string, unknown>)[key];
    if (!entries || typeof entries !== "object") continue;
    const clean: Record<string, string> = {};
    for (const [id, hash] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof hash === "string") clean[id] = hash;
    }
    base[key] = clean;
  }
  return base;
}

/**
 * JSON with object keys sorted. The cloud stores the row as JSONB, which
 * reorders keys, so plain JSON.stringify can't tell "same record" apart.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stableStringify(item))).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

/** Short fingerprint of a record (FNV-1a, 32-bit, plus length). */
export function hashRecord(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`;
}

function recordId(record: unknown): string {
  const id = (record as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : `#${hashRecord(record)}`;
}

function landTagEntries(tags: LandTags | undefined): [string, LandTag][] {
  return Object.entries(tags ?? {});
}

// A base entry can hold several "|"-separated fingerprints: the cloud's raw
// JSON of a record and the locally normalized form of the same record both
// count as "unchanged since the last sync".
function matchesBase(hash: string, baseHash: string | undefined): boolean {
  return baseHash !== undefined && baseHash.split("|").includes(hash);
}

function addHash(target: Record<string, string>, id: string, hash: string) {
  const existing = target[id];
  if (existing === undefined) target[id] = hash;
  else if (!matchesBase(hash, existing)) target[id] = `${existing}|${hash}`;
}

/**
 * Fingerprint every record so the next merge can see what changed. Pass more
 * than one state when they are equivalent copies of the same sync point (the
 * cloud's raw row and the locally saved, normalized form of it).
 */
export function buildSyncBase(...states: SyncedState[]): SyncBase {
  const base: SyncBase = {};
  for (const key of SYNC_COLLECTIONS) {
    const hashes: Record<string, string> = {};
    for (const state of states) {
      for (const record of state[key] ?? []) addHash(hashes, recordId(record), hashRecord(record));
    }
    base[key] = hashes;
  }
  const tagHashes: Record<string, string> = {};
  for (const state of states) {
    for (const [key, tag] of landTagEntries(state.landTags)) addHash(tagHashes, key, hashRecord(tag));
  }
  base.landTags = tagHashes;
  return base;
}

/** True when the state differs from the base in any record (edit, add, delete). */
export function differsFromBase(state: SyncedState, base: SyncBase): boolean {
  const current = buildSyncBase(state);
  return BASE_KEYS.some((key) => {
    const now = current[key] ?? {};
    const then = base[key] ?? {};
    const ids = Object.keys(now);
    if (ids.length !== Object.keys(then).length) return true;
    return ids.some((id) => !matchesBase(now[id], then[id]));
  });
}

/**
 * Three-way merge of one list by id.
 *  - only on one side: kept, unless the other side deleted it since the base
 *    and this side didn't edit it (an edit beats a delete, so nothing typed is
 *    lost);
 *  - on both sides: if only one changed since the base, that one wins; if both
 *    changed (or there's no base), the newer per-record timestamp wins when
 *    there is one, otherwise local.
 * Local order is kept; remote-only records follow in remote order.
 */
export function mergeRecordsById<T>(
  local: readonly T[],
  remote: readonly T[],
  base: Record<string, string> | undefined,
  options: {
    getId?: (record: T) => string;
    // Fingerprint compared with the base (defaults to hashRecord).
    getHash?: (record: T) => string;
    // Per-record edit time; when both sides changed a record, newer wins.
    getTime?: (record: T) => number;
  } = {},
): T[] {
  const getId = options.getId ?? recordId;
  const getHash = options.getHash ?? hashRecord;
  const remoteById = new Map<string, T>();
  for (const record of remote) remoteById.set(getId(record), record);
  const localIds = new Set<string>();
  const merged: T[] = [];

  function newer(a: T, b: T): T | null {
    if (!options.getTime) return null;
    const timeA = options.getTime(a);
    const timeB = options.getTime(b);
    if (!Number.isFinite(timeA) || !Number.isFinite(timeB) || timeA === timeB) return null;
    return timeA > timeB ? a : b;
  }

  for (const record of local) {
    const id = getId(record);
    if (localIds.has(id)) continue;
    localIds.add(id);
    const baseHash = base?.[id];
    const other = remoteById.get(id);

    if (other === undefined) {
      // Deleted on the other side since the last sync, and not edited here.
      if (matchesBase(getHash(record), baseHash)) continue;
      merged.push(record);
      continue;
    }

    const localHash = getHash(record);
    const remoteHash = getHash(other);
    if (localHash === remoteHash || baseHash === undefined) {
      merged.push(localHash === remoteHash ? record : (newer(record, other) ?? record));
      continue;
    }
    const localChanged = !matchesBase(localHash, baseHash);
    const remoteChanged = !matchesBase(remoteHash, baseHash);
    if (remoteChanged && !localChanged) merged.push(other);
    else if (localChanged && !remoteChanged) merged.push(record);
    else merged.push(newer(record, other) ?? record);
  }

  for (const [id, record] of remoteById) {
    if (localIds.has(id)) continue;
    const baseHash = base?.[id];
    // Deleted here since the last sync (a tombstone), and not edited there.
    if (matchesBase(getHash(record), baseHash)) continue;
    merged.push(record);
  }

  return merged;
}

/**
 * Merge two copies of the synced state record-by-record. `base` is the state
 * both sides last agreed on (null when unknown — then nothing counts as
 * deleted and every record from either side is kept).
 */
export function mergeSyncedStates(
  local: SyncedState,
  remote: SyncedState,
  base: SyncBase | null | undefined,
): SyncedState {
  const merged: SyncedState = { ...local };

  for (const key of SYNC_COLLECTIONS) {
    // Each key pairs a list with itself, so the cast only erases the union.
    (merged as Record<SyncCollection, unknown[]>)[key] = mergeRecordsById<unknown>(
      local[key] ?? [],
      remote[key] ?? [],
      base?.[key],
    );
  }

  // Land tags are keyed by owner; fingerprints are of the tag itself (as in
  // buildSyncBase), and the newer savedAt wins when both sides changed one.
  // A row with no landTags field at all was written by an older build that
  // didn't sync tags: that isn't "every tag deleted remotely", so local tags
  // are kept as they are.
  if (remote.landTags !== undefined) {
    const wrap = (tags: LandTags | undefined) =>
      landTagEntries(tags).map(([key, tag]) => ({ key, tag }));
    merged.landTags = Object.fromEntries(
      mergeRecordsById(wrap(local.landTags), wrap(remote.landTags), base?.landTags, {
        getId: (entry) => entry.key,
        getHash: (entry) => hashRecord(entry.tag),
        getTime: (entry) => Date.parse(entry.tag?.savedAt ?? ""),
      }).map((entry): [string, LandTag] => [entry.key, entry.tag]),
    );
  }

  const ids = new Set(merged.properties.map((property) => property.id));
  merged.selectedPropertyId = ids.has(local.selectedPropertyId)
    ? local.selectedPropertyId
    : ids.has(remote.selectedPropertyId)
      ? remote.selectedPropertyId
      : (merged.properties[0]?.id ?? "");

  return merged;
}

// --- Cloud reads and writes -------------------------------------------------

/**
 * Fetch this user's cloud state, or null when they have no row yet.
 */
export async function pullRemoteState(
  userId: string,
): Promise<RemoteState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("state, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.state) return null;

  return {
    state: data.state as SyncedState,
    updatedAt: String(data.updated_at ?? ""),
  };
}

export type ConditionalPushResult =
  | { ok: true; updatedAt: string }
  | { ok: false; conflict: true };

// The database stamps updated_at with its own clock (trigger
// deer_intel_state_touch in supabase/fixes-2026-10.sql), so whatever the client
// sends is ignored once that runs. We still send one so a database without the
// trigger keeps advancing updated_at and the version check below keeps working.
function clientStamp(): string {
  return new Date().toISOString();
}

/**
 * Save the state only if the cloud row is still the version this device last
 * saw (`expectedUpdatedAt`; null = "there is no row yet", which inserts).
 * Returns a conflict instead of overwriting when another device saved first.
 */
export async function pushRemoteStateIfUnchanged(
  userId: string,
  state: SyncedState,
  expectedUpdatedAt: string | null,
): Promise<ConditionalPushResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  if (!expectedUpdatedAt) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({ user_id: userId, state, updated_at: clientStamp() })
      .select("updated_at")
      .single();

    // 23505: a row already exists (another device created it first).
    if (error?.code === "23505") return { ok: false, conflict: true };
    if (error) throw new Error(error.message);

    return { ok: true, updatedAt: String(data?.updated_at ?? "") };
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ state, updated_at: clientStamp() })
    .eq("user_id", userId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { ok: false, conflict: true };

  return { ok: true, updatedAt: String(data[0]?.updated_at ?? "") };
}

/**
 * Unconditionally replace this user's cloud state. Only for an explicit
 * "replace the cloud with this device" choice (account switch → move data);
 * normal saves go through saveWithMerge.
 */
export async function overwriteRemoteState(
  userId: string,
  state: SyncedState,
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      { user_id: userId, state, updated_at: clientStamp() },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();

  if (error) throw new Error(error.message);

  return String(data?.updated_at ?? "");
}

export type SaveOutcome = {
  // What is now in the cloud: the local state, or the merge of it with a
  // newer cloud copy.
  state: SyncedState;
  updatedAt: string;
  // True when another device's changes were folded in, so the caller must
  // apply `state` locally.
  merged: boolean;
};

export type CloudApi = {
  push: (
    userId: string,
    state: SyncedState,
    expectedUpdatedAt: string | null,
  ) => Promise<ConditionalPushResult>;
  pull: (userId: string) => Promise<RemoteState | null>;
};

const defaultCloudApi: CloudApi = {
  push: pushRemoteStateIfUnchanged,
  pull: pullRemoteState,
};

const MAX_SAVE_ATTEMPTS = 4;

/**
 * Save local changes without clobbering another device: push conditionally on
 * the last-seen version; on a conflict pull the newer cloud copy, merge it with
 * the local state by record id (honoring deletions since `base`), and push the
 * merge conditionally on that newer version. Retries a few times if devices
 * keep racing.
 */
export async function saveWithMerge(
  userId: string,
  local: SyncedState,
  expectedUpdatedAt: string | null,
  base: SyncBase | null | undefined,
  api: CloudApi = defaultCloudApi,
): Promise<SaveOutcome> {
  let candidate = local;
  let expected = expectedUpdatedAt || null;
  let merged = false;

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
    const result = await api.push(userId, candidate, expected);
    if (result.ok) return { state: candidate, updatedAt: result.updatedAt, merged };

    const remote = await api.pull(userId);
    if (!remote) {
      // The row vanished between the conflict and the pull: create it.
      candidate = local;
      expected = null;
      merged = false;
      continue;
    }

    candidate = mergeSyncedStates(local, remote.state, base);
    expected = remote.updatedAt || null;
    merged = true;
  }

  throw new Error("Another device kept saving at the same time. Try again.");
}

/**
 * Decide what to do on first sync after login, comparing the local state with
 * whatever is already in the cloud. The rules avoid silent data loss:
 *
 *  - No cloud row yet            -> push local up (seed the cloud).
 *  - Cloud has data, local blank -> pull cloud down.
 *  - Local has data, cloud blank -> push local up.
 *  - Neither has data            -> pull (harmless, keeps a single source).
 *  - Both have data, and this device knows the last-synced base: push (which
 *    merges) when anything changed locally since; pull when only the cloud
 *    moved on; otherwise in sync.
 *  - Both have data, no base     -> unsaved edits push (merging); otherwise
 *    newest-wins by updatedAt.
 *
 * "push" always goes through saveWithMerge, so it never overwrites a newer
 * cloud copy — it merges with it.
 */
export function decideReconcile(
  local: SyncedState,
  localMeta: SyncMeta | null,
  remote: RemoteState | null,
): ReconcileDecision {
  if (!remote) {
    return { action: "push", reason: "No cloud backup yet — uploading this device's data." };
  }

  const localHasData = hasMeaningfulData(local);
  const remoteHasData = hasMeaningfulData(remote.state);

  if (remoteHasData && !localHasData) {
    return {
      action: "pull",
      state: remote.state,
      reason: "Loaded your data from the cloud.",
    };
  }

  if (localHasData && !remoteHasData) {
    return { action: "push", reason: "Uploaded this device's data to the cloud." };
  }

  if (!localHasData && !remoteHasData) {
    return { action: "pull", state: remote.state, reason: "Synced with the cloud." };
  }

  if (localMeta?.base) {
    if (localMeta.pendingLocalEdits || differsFromBase(local, localMeta.base)) {
      return { action: "push", reason: "Merged this device's changes with the cloud." };
    }
    if (remote.updatedAt !== localMeta.updatedAt) {
      return {
        action: "pull",
        state: remote.state,
        reason: "Loaded newer data from the cloud.",
      };
    }
    return { action: "in-sync", reason: "Already up to date." };
  }

  // This device has edits the cloud never received: keep them (the push
  // merges with the cloud copy rather than replacing it).
  if (localMeta?.pendingLocalEdits) {
    return { action: "push", reason: "Uploaded this device's unsaved changes to the cloud." };
  }

  // Both sides have real data: keep whichever was edited most recently.
  const localTime = Date.parse(localMeta?.updatedAt ?? "") || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;

  if (remoteTime > localTime) {
    return {
      action: "pull",
      state: remote.state,
      reason: "Loaded newer data from the cloud.",
    };
  }

  if (localTime > remoteTime) {
    return { action: "push", reason: "Uploaded newer local changes to the cloud." };
  }

  return { action: "in-sync", reason: "Already up to date." };
}
