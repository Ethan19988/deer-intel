import { describe, expect, it } from "vitest";
import {
  buildSyncBase,
  findResurrectedRecords,
  mergeSyncedStates,
  resurrectedPhotoImageIds,
  saveWithMerge,
  type CloudApi,
  type SyncedState,
} from "@/lib/cloudSync";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

// Audit L8: "edit beats delete" brings a deleted photo record back, but the
// deleting device already removed its cloud image. The merge must report it.

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

function photo(id: string, notes = ""): PhotoRecord {
  return { id, propertyId: "p1", imageId: `img-${id}`, notes } as unknown as PhotoRecord;
}

function stand(id: string, name = id): Stand {
  return { id, propertyId: "p1", name } as unknown as Stand;
}

function withPhotos(...photoRecords: PhotoRecord[]): SyncedState {
  return { ...emptyState(), photoRecords };
}

function resurrect(base: SyncedState, local: SyncedState, remote: SyncedState) {
  const syncBase = buildSyncBase(base);
  const merged = mergeSyncedStates(local, remote, syncBase);
  return { merged, resurrected: findResurrectedRecords(syncBase, local, remote, merged) };
}

describe("findResurrectedRecords", () => {
  const synced = withPhotos(photo("a"), photo("b"));

  it("reports a record deleted remotely but edited locally", () => {
    const local = withPhotos(photo("a", "big 8"), photo("b"));
    const remote = withPhotos(photo("b"));
    const { merged, resurrected } = resurrect(synced, local, remote);
    expect(merged.photoRecords.map((p) => p.id)).toEqual(["a", "b"]);
    expect(resurrected).toEqual([{ collection: "photoRecords", id: "a" }]);
  });

  it("reports a record deleted locally but edited remotely", () => {
    const local = withPhotos(photo("b"));
    const remote = withPhotos(photo("a", "big 8"), photo("b"));
    const { merged, resurrected } = resurrect(synced, local, remote);
    expect(merged.photoRecords.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(resurrected).toEqual([{ collection: "photoRecords", id: "a" }]);
  });

  it("reports nothing when the delete wins (other side unedited)", () => {
    const { merged, resurrected } = resurrect(synced, withPhotos(photo("b")), synced);
    expect(merged.photoRecords.map((p) => p.id)).toEqual(["b"]);
    expect(resurrected).toEqual([]);
  });

  it("reports nothing when both sides deleted it", () => {
    const { merged, resurrected } = resurrect(synced, withPhotos(photo("b")), withPhotos(photo("b")));
    expect(merged.photoRecords.map((p) => p.id)).toEqual(["b"]);
    expect(resurrected).toEqual([]);
  });

  it("ignores records added on one side (not in the base) and ordinary edits", () => {
    const local = withPhotos(photo("a", "edit"), photo("b"), photo("new"));
    const remote = withPhotos(photo("a"), photo("b", "edit"), photo("other"));
    expect(resurrect(synced, local, remote).resurrected).toEqual([]);
  });

  it("reports nothing without a base (nothing counts as deleted)", () => {
    const local = withPhotos(photo("a"));
    const remote = withPhotos(photo("b"));
    const merged = mergeSyncedStates(local, remote, null);
    expect(findResurrectedRecords(null, local, remote, merged)).toEqual([]);
  });

  it("covers every synced collection, not only photos", () => {
    const base = { ...emptyState(), stands: [stand("s")] };
    const local = { ...emptyState(), stands: [stand("s", "renamed")] };
    expect(resurrect(base, local, emptyState()).resurrected).toEqual([
      { collection: "stands", id: "s" },
    ]);
  });
});

describe("resurrectedPhotoImageIds", () => {
  it("maps resurrected photo records to their image ids", () => {
    const merged = withPhotos(photo("a"), photo("b"), { ...photo("c"), imageId: undefined });
    expect(
      resurrectedPhotoImageIds(
        [
          { collection: "photoRecords", id: "a" },
          { collection: "photoRecords", id: "c" }, // no image: nothing to upload
          { collection: "stands", id: "b" }, // not a photo
          { collection: "photoRecords", id: "gone" }, // not in the merge
        ],
        merged,
      ),
    ).toEqual(["img-a"]);
  });

  it("is empty for no resurrections", () => {
    expect(resurrectedPhotoImageIds(undefined, withPhotos(photo("a")))).toEqual([]);
    expect(resurrectedPhotoImageIds([], withPhotos(photo("a")))).toEqual([]);
  });
});

describe("saveWithMerge reports resurrected records", () => {
  function cloudWith(state: SyncedState, updatedAt: string) {
    let row = { state, updatedAt };
    const api: CloudApi = {
      async push(_user, next, expected) {
        if (expected !== row.updatedAt) return { ok: false, conflict: true };
        row = { state: next, updatedAt: `${row.updatedAt}+` };
        return { ok: true, updatedAt: row.updatedAt };
      },
      async pull() {
        return row;
      },
    };
    return api;
  }

  it("lists a photo this device edited after another device deleted it", async () => {
    const synced = withPhotos(photo("a"), photo("b"));
    // The other device deleted "a" and saved (t2); this device edited "a" from t1.
    const api = cloudWith(withPhotos(photo("b")), "t2");
    const outcome = await saveWithMerge(
      "u",
      withPhotos(photo("a", "big 8"), photo("b")),
      "t1",
      buildSyncBase(synced),
      api,
    );
    expect(outcome.merged).toBe(true);
    expect(outcome.state.photoRecords.map((p) => p.id)).toEqual(["a", "b"]);
    expect(outcome.resurrected).toEqual([{ collection: "photoRecords", id: "a" }]);
    expect(resurrectedPhotoImageIds(outcome.resurrected, outcome.state)).toEqual(["img-a"]);
  });

  it("leaves `resurrected` unset on a straight push", async () => {
    const synced = withPhotos(photo("a"));
    const outcome = await saveWithMerge(
      "u",
      withPhotos(photo("a", "edit")),
      "t1",
      buildSyncBase(synced),
      cloudWith(synced, "t1"),
    );
    expect(outcome.merged).toBe(false);
    expect(outcome.resurrected).toBeUndefined();
  });
});
