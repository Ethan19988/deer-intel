import { describe, expect, it } from "vitest";
import { detectAccountSwitch } from "@/lib/cloudSync";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { Stand } from "@/types/stand";

function emptyState(): DeerIntelState {
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

const withData: DeerIntelState = {
  ...emptyState(),
  stands: [{ id: "s1" } as Stand],
};

describe("detectAccountSwitch", () => {
  it("ignores a first-ever sign-in (no known owner)", () => {
    expect(detectAccountSwitch(withData, null, null, "b")).toBeNull();
  });

  it("ignores the same account signing back in", () => {
    expect(
      detectAccountSwitch(withData, { userId: "a" }, null, "a"),
    ).toBeNull();
    expect(
      detectAccountSwitch(withData, null, { updatedAt: "", userId: "a" }, "a"),
    ).toBeNull();
  });

  it("ignores a device with nothing worth keeping", () => {
    expect(
      detectAccountSwitch(emptyState(), { userId: "a" }, null, "b"),
    ).toBeNull();
  });

  it("flags a different account after sign-out", () => {
    expect(detectAccountSwitch(withData, { userId: "a" }, null, "b")).toEqual({
      previousUserId: "a",
      unsyncedEdits: false,
    });
  });

  it("carries unsynced edits from the device owner", () => {
    expect(
      detectAccountSwitch(
        withData,
        { userId: "a", unsyncedEdits: true },
        null,
        "b",
      ),
    ).toEqual({ previousUserId: "a", unsyncedEdits: true });
  });

  it("uses sync meta when the session ended without sign-out", () => {
    expect(
      detectAccountSwitch(
        withData,
        null,
        { updatedAt: "x", pendingLocalEdits: true, userId: "a" },
        "b",
      ),
    ).toEqual({ previousUserId: "a", unsyncedEdits: true });
  });
});
