import { describe, expect, it } from "vitest";
import {
  buildSyncBase,
  decideReconcile,
  isSchemaTooNew,
  mergeRecordsById,
  mergeSyncedStates,
  saveWithMerge,
  splitLandTags,
  SYNC_SCHEMA_VERSION,
  SyncSchemaTooNewError,
  syncMetaForMergeRestore,
  syncMetaForReplaceRestore,
  withLandTags,
  type CloudApi,
  type SyncedState,
} from "@/lib/cloudSync";
import { mergeAccountSettings, sanitizeAccountSettings } from "@/lib/accountSettings";
import type { Stand } from "@/types/stand";

function emptyState(): SyncedState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks: [],
    stands: [],
    pins: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

function stand(id: string, name = id, updatedAt?: string): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...(updatedAt ? { updatedAt } : {}),
  } as Stand;
}

function withStands(...stands: Stand[]): SyncedState {
  return { ...emptyState(), stands };
}

const names = (state: SyncedState) => state.stands.map((s) => `${s.id}:${s.name}`);

describe("first sign-in with data on both sides and no merge base (H2)", () => {
  const remote = { state: withStands(stand("a"), stand("cloud")), updatedAt: "2026-11-01T00:00:00Z" };

  it("never pulls wholesale over this device's data", () => {
    const local = withStands(stand("device"));
    expect(decideReconcile(local, null, remote).action).toBe("push");
  });

  it("pushes (merging) even when the cloud row looks newer than old meta", () => {
    const local = withStands(stand("device"));
    const meta = { updatedAt: "2020-01-01T00:00:00Z", userId: "u" };
    expect(decideReconcile(local, meta, remote).action).toBe("push");
  });

  it("the resulting save keeps every record from both sides", async () => {
    let row = remote;
    const api: CloudApi = {
      async push(_userId, state, expected) {
        if (expected !== row.updatedAt) return { ok: false, conflict: true };
        row = { state, updatedAt: "t2" };
        return { ok: true, updatedAt: "t2" };
      },
      async pull() {
        return row;
      },
    };
    await saveWithMerge("u", withStands(stand("device")), null, null, api);
    expect(names(row.state).sort()).toEqual(["a:a", "cloud:cloud", "device:device"]);
  });

  it("still pulls when this device has nothing of its own", () => {
    expect(decideReconcile(emptyState(), null, remote).action).toBe("pull");
  });
});

describe("no-base merges prefer the cloud copy (H3)", () => {
  it("takes the remote copy of a record both sides have when there are no timestamps", () => {
    const merged = mergeRecordsById([stand("a", "old backup")], [stand("a", "newer cloud")], undefined);
    expect(merged[0].name).toBe("newer cloud");
  });

  it("takes the remote copy when the base doesn't know the record", () => {
    const base = buildSyncBase(withStands(stand("x"))).stands;
    const merged = mergeRecordsById([stand("a", "local")], [stand("a", "remote")], base);
    expect(merged[0].name).toBe("remote");
  });

  it("still lets a newer local timestamp win without a base", () => {
    const merged = mergeSyncedStates(
      withStands(stand("a", "local", "2026-11-05T00:00:00Z")),
      withStands(stand("a", "remote", "2026-11-01T00:00:00Z")),
      null,
    );
    expect(names(merged)).toEqual(["a:local"]);
  });

  it("a merge restore keeps the cloud's newer edit of a record in the backup", async () => {
    let row = { state: withStands(stand("a", "edited in cloud")), updatedAt: "t1" };
    const api: CloudApi = {
      async push(_userId, state, expected) {
        if (expected !== row.updatedAt) return { ok: false, conflict: true };
        row = { state, updatedAt: "t2" };
        return { ok: true, updatedAt: "t2" };
      },
      async pull() {
        return row;
      },
    };
    const meta = syncMetaForMergeRestore("u");
    await saveWithMerge("u", withStands(stand("a", "backup"), stand("z")), meta.updatedAt || null, meta.base, api);
    expect(names(row.state)).toEqual(["a:edited in cloud", "z:z"]);
  });

  it("keeps local when both changed since the base and neither has a timestamp", () => {
    const base = buildSyncBase(withStands(stand("a"))).stands;
    const merged = mergeRecordsById([stand("a", "local")], [stand("a", "remote")], base);
    expect(merged[0].name).toBe("local");
  });
});

describe("per-record updatedAt (M1)", () => {
  const base = buildSyncBase(withStands(stand("a", "a", "2026-11-01T00:00:00Z")));

  it("the newer edit wins when both devices changed the same record", () => {
    const merged = mergeSyncedStates(
      withStands(stand("a", "phone", "2026-11-03T00:00:00Z")),
      withStands(stand("a", "laptop", "2026-11-04T00:00:00Z")),
      base,
    );
    expect(names(merged)).toEqual(["a:laptop"]);
  });

  it("the local edit wins when it is newer", () => {
    const merged = mergeSyncedStates(
      withStands(stand("a", "phone", "2026-11-05T00:00:00Z")),
      withStands(stand("a", "laptop", "2026-11-04T00:00:00Z")),
      base,
    );
    expect(names(merged)).toEqual(["a:phone"]);
  });
});

describe("forward compatibility (M3)", () => {
  it("keeps top-level keys a newer build added to the cloud row", () => {
    const remote = { ...withStands(stand("r")), futureThing: { a: 1 } } as SyncedState;
    const merged = mergeSyncedStates(withStands(stand("l")), remote, null) as SyncedState & {
      futureThing?: unknown;
    };
    expect(merged.futureThing).toEqual({ a: 1 });
    expect(names(merged).sort()).toEqual(["l:l", "r:r"]);
  });

  it("stamps the schema version on what it syncs", () => {
    expect(withLandTags(emptyState(), {}).schemaVersion).toBe(SYNC_SCHEMA_VERSION);
  });

  it("recognises a row from a newer build", () => {
    expect(isSchemaTooNew({ schemaVersion: SYNC_SCHEMA_VERSION + 1 })).toBe(true);
    expect(isSchemaTooNew({ schemaVersion: SYNC_SCHEMA_VERSION })).toBe(false);
    expect(isSchemaTooNew(emptyState())).toBe(false);
  });

  it("refuses to merge into a row a newer build wrote", async () => {
    const api: CloudApi = {
      push: async () => ({ ok: false, conflict: true }),
      pull: async () => ({
        state: { ...emptyState(), schemaVersion: SYNC_SCHEMA_VERSION + 1 },
        updatedAt: "t9",
      }),
    };
    await expect(saveWithMerge("u", withStands(stand("a")), "t1", null, api)).rejects.toBeInstanceOf(
      SyncSchemaTooNewError,
    );
  });

  it("splitLandTags strips the sync-only keys", () => {
    const { state, accountSettings } = splitLandTags(
      withLandTags(emptyState(), {}, { shareSightings: { value: "off", updatedAt: "x" } }),
    );
    expect("schemaVersion" in state).toBe(false);
    expect("accountSettings" in state).toBe(false);
    expect(accountSettings?.shareSightings.value).toBe("off");
  });
});

describe("account settings (H4 / M5)", () => {
  it("keeps the newer choice per setting and the union of keys", () => {
    const merged = mergeAccountSettings(
      {
        shareSightings: { value: "off", updatedAt: "2026-11-05T00:00:00Z" },
        partyPinSharing: { value: true, updatedAt: "2026-11-01T00:00:00Z" },
      },
      {
        shareSightings: { value: "on", updatedAt: "2026-11-04T00:00:00Z" },
        partyPinSharing: { value: false, updatedAt: "2026-11-02T00:00:00Z" },
        futureSetting: { value: "x", updatedAt: "2026-11-02T00:00:00Z" },
      },
    );
    expect(merged.shareSightings.value).toBe("off");
    expect(merged.partyPinSharing.value).toBe(false);
    expect(merged.futureSetting.value).toBe("x");
  });

  it("merges settings inside mergeSyncedStates", () => {
    const local = withLandTags(emptyState(), {}, {
      shareSightings: { value: "off", updatedAt: "2026-11-05T00:00:00Z" },
    });
    const remote = withLandTags(emptyState(), {}, {
      shareSightings: { value: "on", updatedAt: "2026-11-01T00:00:00Z" },
    });
    expect(mergeSyncedStates(local, remote, null).accountSettings?.shareSightings.value).toBe("off");
    expect(mergeSyncedStates(remote, local, null).accountSettings?.shareSightings.value).toBe("off");
  });

  it("keeps the cloud's settings when this device has none", () => {
    const remote = withLandTags(emptyState(), {}, {
      partyBuckSharing: { value: true, updatedAt: "2026-11-01T00:00:00Z" },
    });
    const merged = mergeSyncedStates(withLandTags(emptyState(), {}), remote, null);
    expect(merged.accountSettings?.partyBuckSharing.value).toBe(true);
  });

  it("drops malformed settings", () => {
    expect(
      Object.keys(
        sanitizeAccountSettings({
          ok: { value: true, updatedAt: "x" },
          bad: { value: { nested: 1 }, updatedAt: "x" },
          worse: null,
        }),
      ),
    ).toEqual(["ok"]);
  });
});

describe("Replace restore (L5)", () => {
  it("decides to push even when this device has no merge base", () => {
    const remote = { state: withStands(stand("a"), stand("b")), updatedAt: "t1" };
    const meta = syncMetaForReplaceRestore("u", null);
    expect(meta.replaceRemote).toBe(true);
    expect(meta.pendingLocalEdits).toBe(true);
    expect(decideReconcile(withStands(stand("a")), meta, remote).action).toBe("push");
    // Even a restore to an empty state replaces rather than pulling.
    expect(decideReconcile(emptyState(), meta, remote).action).toBe("push");
  });

  it("keeps this account's merge base and version", () => {
    const base = buildSyncBase(withStands(stand("a")));
    const meta = syncMetaForReplaceRestore("u", { updatedAt: "t1", userId: "u", base });
    expect(meta.updatedAt).toBe("t1");
    expect(meta.base).toEqual(base);
    expect(syncMetaForReplaceRestore("u", { updatedAt: "t1", userId: "other", base }).base).toBe(
      undefined,
    );
  });
});
