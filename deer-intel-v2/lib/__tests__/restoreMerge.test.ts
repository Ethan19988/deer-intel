import { describe, expect, it } from "vitest";
import {
  buildSyncBase,
  saveWithMerge,
  syncMetaForMergeRestore,
  type CloudApi,
  type SyncedState,
} from "@/lib/cloudSync";
import { isRestoreUndoFresh, RESTORE_UNDO_WINDOW_MS } from "@/lib/restoreUndo";
import type { Stand } from "@/types/stand";

function withStands(...ids: string[]): SyncedState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks: [],
    stands: ids.map((id) => ({ id, propertyId: "p1", name: id }) as Stand),
    pins: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

function fakeCloud(initial: { state: SyncedState; updatedAt: string }) {
  let row = initial;
  const api: CloudApi = {
    async push(_userId, state, expected) {
      // Insert (expected null) conflicts with the existing row, like 23505.
      if (expected === null || row.updatedAt !== expected) {
        return { ok: false, conflict: true };
      }
      row = { state, updatedAt: `${row.updatedAt}+` };
      return { ok: true, updatedAt: row.updatedAt };
    },
    async pull() {
      return row;
    },
  };
  return {
    api,
    get row() {
      return row;
    },
  };
}

const ids = (state: SyncedState) => state.stands.map((stand) => stand.id).sort();

describe("restoring a backup while signed in", () => {
  // The cloud and this device last agreed on stands a, b, c.
  const synced = withStands("a", "b", "c");
  // The backup file only has a and an old stand z.
  const backup = withStands("a", "z");

  it("replace: records missing from the backup are deleted from the cloud", async () => {
    const cloud = fakeCloud({ state: synced, updatedAt: "t1" });
    await saveWithMerge("u", backup, "t1", buildSyncBase(synced), cloud.api);
    expect(ids(cloud.row.state)).toEqual(["a", "z"]);
  });

  it("merge: clearing the base keeps every cloud record and adds the backup's", async () => {
    const cloud = fakeCloud({ state: synced, updatedAt: "t1" });
    const meta = syncMetaForMergeRestore("u");

    expect(meta.base).toBeUndefined();
    expect(meta.pendingLocalEdits).toBe(true);

    const outcome = await saveWithMerge(
      "u",
      backup,
      meta.updatedAt || null,
      meta.base,
      cloud.api,
    );

    expect(outcome.merged).toBe(true);
    expect(ids(cloud.row.state)).toEqual(["a", "b", "c", "z"]);
  });
});

describe("isRestoreUndoFresh", () => {
  const at = "2026-11-08T12:00:00.000Z";
  const now = Date.parse(at);

  it("is available for 24 hours after the restore", () => {
    expect(isRestoreUndoFresh({ at }, now + 1000)).toBe(true);
    expect(isRestoreUndoFresh({ at }, now + RESTORE_UNDO_WINDOW_MS - 1)).toBe(true);
    expect(isRestoreUndoFresh({ at }, now + RESTORE_UNDO_WINDOW_MS)).toBe(false);
  });

  it("is unavailable with no snapshot or a bad time", () => {
    expect(isRestoreUndoFresh(null, now)).toBe(false);
    expect(isRestoreUndoFresh({ at: "nope" }, now)).toBe(false);
  });
});
