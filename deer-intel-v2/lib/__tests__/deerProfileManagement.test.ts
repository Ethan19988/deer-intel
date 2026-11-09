import { describe, expect, it } from "vitest";
import {
  deerProfileStatusLabel,
  deleteDeerProfile,
  isActiveDeerProfile,
  mergeDeerProfiles,
  partitionDeerProfileSummaries,
  setDeerProfileStatus,
  updateDeerProfileFromValues,
  type DeerProfileSummary,
} from "@/lib/deerProfiles";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";

const profile = (id: string, nickname: string, extra: Partial<DeerProfile> = {}): DeerProfile => ({
  id,
  propertyId: "p",
  nickname,
  estimatedAge: "",
  firstSeen: "",
  lastSeen: "",
  notes: "",
  ...extra,
});

const photo = (id: string, extra: Partial<PhotoRecord> = {}): PhotoRecord => ({
  id,
  propertyId: "p",
  cameraSiteId: "c1",
  cameraCheckId: "",
  fileName: `${id}.jpg`,
  photoDate: "2026-10-20T18:00",
  species: "Deer (Antlered)",
  notes: "",
  createdAt: "",
  ...extra,
});

const hunt = (id: string, deerProfileIds?: string[]): HuntLogEntry => ({
  id,
  propertyId: "p",
  standId: "s1",
  standName: "Oak",
  date: "2026-10-21",
  startTime: "15:30",
  endTime: "18:00",
  windDirection: "",
  windSpeed: "",
  temperature: "",
  weather: "",
  moonPhase: "",
  weatherSnapshot: {
    temperature: "",
    windDirection: "",
    windSpeed: "",
    conditions: "",
    moonPhase: "",
    source: "manual",
  },
  bucks: 1,
  does: 0,
  fawns: 0,
  shotOpportunity: false,
  harvest: false,
  notes: "",
  ...(deerProfileIds ? { deerProfileIds } : null),
});

function state(parts: Partial<DeerIntelState>): DeerIntelState {
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
    ...parts,
  };
}

describe("mergeDeerProfiles", () => {
  const base = state({
    deerProfiles: [
      profile("a", "Split Brow", { notes: "Kicker off left G2", firstSeen: "2026-09-01", estimatedAge: "3.5" }),
      profile("b", "Big 8", { notes: "Wide frame", lastSeen: "2026-10-01" }),
      profile("c", "Other"),
    ],
    photoRecords: [
      photo("1", { deerProfileId: "a", deerProfileIds: ["a"], buckName: "Split Brow", buckNames: ["Split Brow"] }),
      photo("2", { deerProfileId: "a", deerProfileIds: ["a", "b"], buckName: "Split Brow", buckNames: ["Split Brow", "Big 8"] }),
      photo("3", { deerProfileId: "c", deerProfileIds: ["c", "a"], buckName: "Other", buckNames: ["Other", "Split Brow"] }),
      photo("4", { buckName: "split brow", buckNames: ["split brow"] }),
      photo("5", { deerProfileId: "c", deerProfileIds: ["c"], buckNames: ["Other"] }),
    ],
    hunts: [hunt("h1", ["a"]), hunt("h2", ["a", "b"]), hunt("h3")],
  });
  const merged = mergeDeerProfiles(base, "a", "b");
  const byId = (id: string) => merged.photoRecords.find((item) => item.id === id)!;

  it("removes the source profile and widens the target", () => {
    expect(merged.deerProfiles.map((item) => item.id)).toEqual(["b", "c"]);
    const target = merged.deerProfiles[0];
    expect(target.firstSeen).toBe("2026-09-01");
    expect(target.lastSeen).toBe("2026-10-01");
    expect(target.estimatedAge).toBe("3.5");
    expect(target.notes).toBe("Wide frame\n\nFrom Split Brow: Kicker off left G2");
  });

  it("repoints every photo that referenced the source, in place and deduped", () => {
    expect(byId("1")).toMatchObject({ deerProfileId: "b", deerProfileIds: ["b"], buckName: "Big 8", buckNames: ["Big 8"] });
    expect(byId("2")).toMatchObject({ deerProfileId: "b", deerProfileIds: ["b"], buckNames: ["Big 8"] });
    expect(byId("3")).toMatchObject({ deerProfileId: "c", deerProfileIds: ["c", "b"], buckNames: ["Other", "Big 8"] });
    // A name-only tag follows him too, without gaining an id link.
    expect(byId("4")).toMatchObject({ deerProfileIds: undefined, buckNames: ["Big 8"] });
    // Untouched records keep their identity.
    expect(byId("5")).toBe(base.photoRecords[4]);
  });

  it("repoints tagged sits", () => {
    expect(merged.hunts[0].deerProfileIds).toEqual(["b"]);
    expect(merged.hunts[1].deerProfileIds).toEqual(["b"]);
    expect(merged.hunts[2]).toBe(base.hunts[2]);
  });

  it("is a no-op for a self-merge or a missing buck", () => {
    expect(mergeDeerProfiles(base, "a", "a")).toBe(base);
    expect(mergeDeerProfiles(base, "a", "zzz")).toBe(base);
  });
});

describe("deleteDeerProfile", () => {
  it("unlinks photos and sits instead of deleting them", () => {
    const base = state({
      deerProfiles: [profile("a", "Split Brow"), profile("b", "Big 8")],
      photoRecords: [
        photo("1", { deerProfileId: "a", deerProfileIds: ["a"], buckName: "Split Brow", buckNames: ["Split Brow"] }),
        photo("2", { deerProfileId: "a", deerProfileIds: ["a", "b"], buckNames: ["Split Brow", "Big 8"] }),
      ],
      hunts: [hunt("h1", ["a"]), hunt("h2", ["b", "a"])],
    });
    const next = deleteDeerProfile(base, "a");

    expect(next.deerProfiles.map((item) => item.id)).toEqual(["b"]);
    expect(next.photoRecords).toHaveLength(2);
    expect(next.photoRecords[0]).toMatchObject({
      deerProfileId: undefined,
      deerProfileIds: undefined,
      buckName: undefined,
      buckNames: undefined,
    });
    expect(next.photoRecords[1]).toMatchObject({ deerProfileId: "b", deerProfileIds: ["b"], buckNames: ["Big 8"] });
    expect(next.hunts[0].deerProfileIds).toBeUndefined();
    expect("deerProfileIds" in next.hunts[0]).toBe(false);
    expect(next.hunts[1].deerProfileIds).toEqual(["b"]);
  });
});

describe("status", () => {
  it("marks harvested with a date, and back to active clears both", () => {
    const base = state({ deerProfiles: [profile("a", "Big 8")] });
    const harvested = setDeerProfileStatus(base, "a", "harvested", "2026-11-02");

    expect(harvested.deerProfiles[0]).toMatchObject({ status: "harvested", statusDate: "2026-11-02" });
    expect(isActiveDeerProfile(harvested.deerProfiles[0])).toBe(false);
    expect(deerProfileStatusLabel(harvested.deerProfiles[0])).toBe("Harvested Nov 2, 2026");

    const back = setDeerProfileStatus(harvested, "a", "active");
    expect(back.deerProfiles[0]).toEqual(profile("a", "Big 8"));
    expect(isActiveDeerProfile(back.deerProfiles[0])).toBe(true);
  });

  it("splits summaries into active and harvested / retired", () => {
    const summary = (item: DeerProfile): DeerProfileSummary => ({
      profile: item,
      firstSeen: "",
      lastSeen: "",
      photoCount: 0,
      sightingCount: 0,
    });
    const { active, inactive } = partitionDeerProfileSummaries([
      summary(profile("a", "A")),
      summary(profile("b", "B", { status: "retired" })),
      summary(profile("c", "C", { status: "harvested" })),
    ]);

    expect(active.map((item) => item.profile.id)).toEqual(["a"]);
    expect(inactive.map((item) => item.profile.id)).toEqual(["b", "c"]);
  });
});

describe("updateDeerProfileFromValues", () => {
  it("edits the profile, keeps status, and renames him on his photos", () => {
    const base = state({
      deerProfiles: [profile("a", "Big 8", { status: "harvested", statusDate: "2026-11-02" })],
      photoRecords: [photo("1", { deerProfileId: "a", deerProfileIds: ["a"], buckName: "Big 8", buckNames: ["Big 8", "Doe Boy"] })],
    });
    const next = updateDeerProfileFromValues(base, "a", {
      nickname: " Tall 8 ",
      estimatedAge: "4.5",
      firstSeen: "",
      lastSeen: "",
      notes: "Busted brow",
    });

    expect(next.deerProfiles[0]).toMatchObject({
      nickname: "Tall 8",
      estimatedAge: "4.5",
      notes: "Busted brow",
      status: "harvested",
      statusDate: "2026-11-02",
    });
    expect(next.photoRecords[0]).toMatchObject({ deerProfileIds: ["a"], buckName: "Tall 8", buckNames: ["Tall 8", "Doe Boy"] });
  });

  it("refuses a blank name", () => {
    const base = state({ deerProfiles: [profile("a", "Big 8")] });
    expect(
      updateDeerProfileFromValues(base, "a", { nickname: " ", estimatedAge: "", firstSeen: "", lastSeen: "", notes: "" }),
    ).toBe(base);
  });
});
