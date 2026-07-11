"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { isUntouchedLegacySeedProperty } from "@/lib/deerIntelStore";
import type { DeerIntelState } from "@/types/deerIntelStore";

// One JSONB row per user holds the whole DeerIntelState. See supabase/schema.sql
// for the table definition and row-level security policies.
const TABLE_NAME = "deer_intel_state";

// Local bookkeeping so we can reconcile without silently clobbering data and so
// the push effect can tell a real edit from an echo of a pull we just applied.
const SYNC_META_KEY = "deer-intel:sync-meta";

export type SyncMeta = {
  // ISO timestamp of the last time we wrote local state (edit or pull-apply).
  updatedAt: string;
  // Serialized snapshot of the last state we know is in sync with the cloud.
  // The push effect compares against this to decide whether a push is needed.
  lastSyncedSnapshot: string | null;
};

export type RemoteState = {
  state: DeerIntelState;
  updatedAt: string;
};

export type ReconcileDecision =
  | { action: "push"; reason: string }
  | { action: "pull"; state: DeerIntelState; reason: string }
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
    state.deerProfiles.length > 0
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

    return {
      updatedAt: parsed.updatedAt,
      lastSyncedSnapshot:
        typeof parsed.lastSyncedSnapshot === "string"
          ? parsed.lastSyncedSnapshot
          : null,
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

export function clearSyncMeta(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SYNC_META_KEY);
  } catch {
    // Ignore.
  }
}

export function serializeState(state: DeerIntelState): string {
  return JSON.stringify(state);
}

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
    state: data.state as DeerIntelState,
    updatedAt: String(data.updated_at ?? ""),
  };
}

/**
 * Upsert this user's cloud state and return the server timestamp it was saved
 * with, so the caller can record it in sync metadata.
 */
export async function pushRemoteState(
  userId: string,
  state: DeerIntelState,
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  const savedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      { user_id: userId, state, updated_at: savedAt },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();

  if (error) throw new Error(error.message);

  return String(data?.updated_at ?? savedAt);
}

/**
 * Decide what to do on first sync after login, comparing the local state with
 * whatever is already in the cloud. The rules avoid silent data loss:
 *
 *  - No cloud row yet            -> push local up (seed the cloud).
 *  - Cloud has data, local blank -> pull cloud down.
 *  - Local has data, cloud blank -> push local up.
 *  - Both have data              -> newest-wins by updatedAt.
 *  - Neither has data            -> pull (harmless, keeps a single source).
 */
export function decideReconcile(
  local: DeerIntelState,
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
