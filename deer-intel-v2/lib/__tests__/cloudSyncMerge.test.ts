import { describe, expect, it } from "vitest";
import {
  buildSyncBase,
  decideReconcile,
  differsFromBase,
  hashRecord,
  mergeRecordsById,
  mergeSyncedStates,
  saveWithMerge,
  splitLandTags,
  stableStringify,
  withLandTags,
  type CloudApi,
  type SyncedState,
} from "@/lib/cloudSync";
import type { LandTag } from "@/lib/landTags";
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

function stand(id: string, name = id): Stand {
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
  } as Stand;
}

function tag(ownerName: string, savedAt: string, kind: LandTag["kind"] = "permission"): LandTag {
  return { kind, ownerName, acres: 10, lat: 41, lng: -77, savedAt };
}

function withStands(...stands: Stand[]): SyncedState {
  return { ...emptyState(), stands };
}

const names = (state: SyncedState) => state.stands.map((s) => `${s.id}:${s.name}`);

describe("stableStringify / hashRecord", () => {
  it("ignores key order (JSONB reorders keys)", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }),
    );
    expect(hashRecord({ a: 1, b: 2 })).toBe(hashRecord({ b: 2, a: 1 }));
  });

  it("drops undefined fields like JSON does", () => {
    expect(hashRecord({ a: 1, b: undefined })).toBe(hashRecord({ a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(hashRecord({ a: 1 })).not.toBe(hashRecord({ a: 2 }));
  });
});

describe("mergeRecordsById", () => {
  it("keeps records that exist on only one side when there is no base", () => {
    const merged = mergeRecordsById([stand("a")], [stand("b")], undefined);
    expect(merged.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("does not resurrect a record deleted locally since the last sync", () => {
    const base = buildSyncBase(withStands(stand("a"), stand("b"))).stands;
    // Local deleted b; remote still has the unchanged b.
    const merged = mergeRecordsById([stand("a")], [stand("a"), stand("b")], base);
    expect(merged.map((s) => s.id)).toEqual(["a"]);
  });

  it("honors a delete made on the other device", () => {
    const base = buildSyncBase(withStands(stand("a"), stand("b"))).stands;
    const merged = mergeRecordsById([stand("a"), stand("b")], [stand("a")], base);
    expect(merged.map((s) => s.id)).toEqual(["a"]);
  });

  it("keeps a record edited on one side even if the other side deleted it", () => {
    const base = buildSyncBase(withStands(stand("a"), stand("b"))).stands;
    const merged = mergeRecordsById([stand("a"), stand("b", "edited")], [stand("a")], base);
    expect(merged.map((s) => s.name)).toEqual(["a", "edited"]);
  });

  it("takes the side that changed when only one did", () => {
    const base = buildSyncBase(withStands(stand("a"))).stands;
    expect(mergeRecordsById([stand("a")], [stand("a", "remote edit")], base)[0].name).toBe(
      "remote edit",
    );
    expect(mergeRecordsById([stand("a", "local edit")], [stand("a")], base)[0].name).toBe(
      "local edit",
    );
  });

  it("prefers local when both changed and there is no timestamp", () => {
    const base = buildSyncBase(withStands(stand("a"))).stands;
    const merged = mergeRecordsById([stand("a", "local")], [stand("a", "remote")], base);
    expect(merged[0].name).toBe("local");
  });

  it("uses the newer per-record timestamp when both changed", () => {
    type Row = { id: string; v: string; at: string };
    const getTime = (row: Row) => Date.parse(row.at);
    const base = { x: hashRecord({ id: "x", v: "0", at: "2026-01-01T00:00:00Z" }) };
    const merged = mergeRecordsById<Row>(
      [{ id: "x", v: "local", at: "2026-01-02T00:00:00Z" }],
      [{ id: "x", v: "remote", at: "2026-01-03T00:00:00Z" }],
      base,
      { getTime },
    );
    expect(merged[0].v).toBe("remote");
  });

  it("treats either fingerprint in a multi-hash base entry as unchanged", () => {
    const raw = { id: "a", name: "a", extra: "server-only" };
    const normalized = { id: "a", name: "a" };
    const base = buildSyncBase(
      { ...emptyState(), stands: [normalized as unknown as Stand] },
      { ...emptyState(), stands: [raw as unknown as Stand] },
    ).stands;
    // Remote still has the raw form (unchanged); local deleted it -> stays deleted.
    expect(mergeRecordsById([], [raw], base)).toEqual([]);
  });
});

describe("mergeSyncedStates", () => {
  it("merges every collection by id and keeps both devices' new records", () => {
    const baseState = withStands(stand("a"));
    const base = buildSyncBase(baseState);
    const phone = { ...withStands(stand("a"), stand("phone")), hunts: [] };
    const laptop = withStands(stand("a"), stand("laptop"));
    const merged = mergeSyncedStates(phone, laptop, base);
    expect(names(merged)).toEqual(["a:a", "phone:phone", "laptop:laptop"]);
  });

  it("merges land tags by owner key and keeps the newer savedAt on conflict", () => {
    const base = buildSyncBase(
      withLandTags(emptyState(), { SMITH: tag("Smith", "2026-01-01T00:00:00Z") }),
    );
    const local = withLandTags(emptyState(), {
      SMITH: tag("Smith", "2026-01-02T00:00:00Z", "neighbor"),
      JONES: tag("Jones", "2026-01-02T00:00:00Z"),
    });
    const remote = withLandTags(emptyState(), {
      SMITH: tag("Smith", "2026-01-05T00:00:00Z", "permission"),
      BROWN: tag("Brown", "2026-01-03T00:00:00Z"),
    });
    const merged = mergeSyncedStates(local, remote, base);
    expect(Object.keys(merged.landTags ?? {}).sort()).toEqual(["BROWN", "JONES", "SMITH"]);
    expect(merged.landTags?.SMITH.savedAt).toBe("2026-01-05T00:00:00Z");
  });

  it("does not resurrect a land tag cleared locally", () => {
    const tags = { SMITH: tag("Smith", "2026-01-01T00:00:00Z") };
    const base = buildSyncBase(withLandTags(emptyState(), tags));
    const merged = mergeSyncedStates(
      withLandTags(emptyState(), {}),
      withLandTags(emptyState(), tags),
      base,
    );
    expect(merged.landTags).toEqual({});
  });

  it("keeps local land tags when the remote row predates them", () => {
    const local = withLandTags(emptyState(), { SMITH: tag("Smith", "2026-01-01T00:00:00Z") });
    const merged = mergeSyncedStates(local, emptyState(), null);
    expect(Object.keys(merged.landTags ?? {})).toEqual(["SMITH"]);
  });

  it("keeps base-matching local land tags when an older build wrote the remote row", () => {
    const tags = { SMITH: tag("Smith", "2026-01-01T00:00:00Z") };
    // The base knows SMITH, local is unchanged, and the remote row has no
    // landTags field at all: that is not a remote delete.
    const base = buildSyncBase(withLandTags(emptyState(), tags));
    const local = withLandTags(emptyState(), tags);
    const remote = emptyState();
    expect("landTags" in remote).toBe(false);
    const merged = mergeSyncedStates(local, remote, base);
    expect(merged.landTags).toEqual(tags);
  });

  it("still honors a remote land tag delete when the remote row has landTags", () => {
    const tags = { SMITH: tag("Smith", "2026-01-01T00:00:00Z") };
    const base = buildSyncBase(withLandTags(emptyState(), tags));
    const merged = mergeSyncedStates(
      withLandTags(emptyState(), tags),
      withLandTags(emptyState(), {}),
      base,
    );
    expect(merged.landTags).toEqual({});
  });

  it("keeps a valid selected property", () => {
    const property = { id: "p2", name: "B", county: "", acres: "", notes: "" };
    const local = { ...emptyState(), selectedPropertyId: "gone" };
    const remote = { ...emptyState(), properties: [property], selectedPropertyId: "p2" };
    expect(mergeSyncedStates(local, remote, null).selectedPropertyId).toBe("p2");
  });
});

describe("differsFromBase", () => {
  it("detects edits, adds and deletes against the base", () => {
    const state = withStands(stand("a"));
    const base = buildSyncBase(state);
    expect(differsFromBase(state, base)).toBe(false);
    expect(differsFromBase(withStands(stand("a", "x")), base)).toBe(true);
    expect(differsFromBase(withStands(stand("a"), stand("b")), base)).toBe(true);
    expect(differsFromBase(withStands(), base)).toBe(true);
  });
});

describe("splitLandTags", () => {
  it("returns undefined tags for rows from older builds", () => {
    const { state, landTags } = splitLandTags(emptyState());
    expect(landTags).toBeUndefined();
    expect("landTags" in state).toBe(false);
  });

  it("drops malformed tags", () => {
    const { landTags } = splitLandTags({
      ...emptyState(),
      landTags: { BAD: { kind: "x" } as unknown as LandTag, OK: tag("Ok", "") },
    });
    expect(Object.keys(landTags ?? {})).toEqual(["OK"]);
  });
});

function fakeCloud(initial: { state: SyncedState; updatedAt: string } | null) {
  let row = initial;
  let clock = 100;
  const pushes: (string | null)[] = [];
  const api: CloudApi = {
    async push(_userId, state, expected) {
      pushes.push(expected);
      if (expected === null ? row !== null : row?.updatedAt !== expected) {
        return { ok: false, conflict: true };
      }
      clock += 1;
      row = { state, updatedAt: `t${clock}` };
      return { ok: true, updatedAt: row.updatedAt };
    },
    async pull() {
      return row;
    },
  };
  return {
    api,
    pushes,
    get row() {
      return row;
    },
    set(next: { state: SyncedState; updatedAt: string }) {
      row = next;
    },
  };
}

describe("saveWithMerge", () => {
  it("pushes straight through when the version matches", async () => {
    const cloud = fakeCloud({ state: withStands(stand("a")), updatedAt: "t1" });
    const local = withStands(stand("a"), stand("b"));
    const outcome = await saveWithMerge("u", local, "t1", buildSyncBase(withStands(stand("a"))), cloud.api);
    expect(outcome.merged).toBe(false);
    expect(names(cloud.row!.state)).toEqual(["a:a", "b:b"]);
  });

  it("merges instead of overwriting another device's newer save", async () => {
    const synced = withStands(stand("a"));
    const base = buildSyncBase(synced);
    // Laptop saved a new stand after the phone went offline.
    const cloud = fakeCloud({ state: withStands(stand("a"), stand("laptop")), updatedAt: "t2" });
    // Phone, offline, added its own stand; it last saw t1.
    const phone = withStands(stand("a"), stand("phone"));
    const outcome = await saveWithMerge("u", phone, "t1", base, cloud.api);
    expect(outcome.merged).toBe(true);
    expect(names(cloud.row!.state).sort()).toEqual(["a:a", "laptop:laptop", "phone:phone"]);
    expect(cloud.pushes).toEqual(["t1", "t2"]);
  });

  it("inserts when there is no row and merges if another device created it first", async () => {
    const empty = fakeCloud(null);
    const first = await saveWithMerge("u", withStands(stand("a")), null, null, empty.api);
    expect(first.merged).toBe(false);

    const raced = fakeCloud({ state: withStands(stand("other")), updatedAt: "t5" });
    const outcome = await saveWithMerge("u", withStands(stand("mine")), null, null, raced.api);
    expect(outcome.merged).toBe(true);
    expect(names(raced.row!.state).sort()).toEqual(["mine:mine", "other:other"]);
  });

  it("gives up after repeated conflicts instead of looping forever", async () => {
    const api: CloudApi = {
      push: async () => ({ ok: false, conflict: true }),
      pull: async () => ({ state: emptyState(), updatedAt: "always-new" }),
    };
    await expect(saveWithMerge("u", emptyState(), "t1", null, api)).rejects.toThrow();
  });
});

describe("decideReconcile with a merge base", () => {
  const remote = { state: withStands(stand("a"), stand("r")), updatedAt: "t9" };

  it("pushes (merging) when this device changed since the last sync", () => {
    const synced = withStands(stand("a"));
    const meta = { updatedAt: "t1", base: buildSyncBase(synced) };
    expect(decideReconcile(withStands(stand("a"), stand("l")), meta, remote).action).toBe("push");
  });

  it("pulls when only the cloud moved on", () => {
    const synced = withStands(stand("a"));
    const meta = { updatedAt: "t1", base: buildSyncBase(synced) };
    expect(decideReconcile(synced, meta, remote).action).toBe("pull");
  });

  it("is in sync when nothing changed anywhere", () => {
    const meta = { updatedAt: "t9", base: buildSyncBase(remote.state) };
    expect(decideReconcile(remote.state, meta, remote).action).toBe("in-sync");
  });
});
