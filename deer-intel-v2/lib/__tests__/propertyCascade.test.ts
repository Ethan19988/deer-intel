import { describe, expect, it } from "vitest";
import {
  cascadeSummary,
  describePropertyCascade,
  removePropertyFromState,
} from "@/app/properties/propertyCascade";
import type { DeerIntelState } from "@/types/deerIntelStore";

const base = { notes: "" };

const state = {
  version: 2,
  properties: [
    { id: "p1", name: "Ridge", county: "", acres: "", notes: "" },
    { id: "p2", name: "Creek", county: "", acres: "", notes: "" },
  ],
  selectedPropertyId: "p1",
  cameras: [{ id: "c1", propertyId: "p1" }],
  cameraChecks: [],
  stands: [
    { id: "s1", propertyId: "p1" },
    { id: "s2", propertyId: "p2" },
  ],
  pins: [{ id: "pin1", propertyId: "p1" }],
  hunts: [],
  photoRecords: [
    { id: "ph1", propertyId: "p1", imageId: "img1" },
    { id: "ph2", propertyId: "p1" },
    { id: "ph3", propertyId: "p2", imageId: "img3" },
  ],
  deerProfiles: [],
  walkTracks: [{ id: "w1", propertyId: "p1" }],
  documents: [
    { id: "d1", propertyId: "p1", fileId: "f1", ...base },
    { id: "d2", propertyId: "p1", fileId: "", ...base },
  ],
} as unknown as DeerIntelState;

describe("property delete cascade", () => {
  it("counts everything filed under the property", () => {
    const cascade = describePropertyCascade(state, "p1");

    expect(cascade.counts).toEqual({
      cameras: 1,
      cameraChecks: 0,
      stands: 1,
      pins: 1,
      hunts: 0,
      photoRecords: 2,
      deerProfiles: 0,
      walkTracks: 1,
      documents: 2,
    });
    expect(cascade.imageIds).toEqual(["img1"]);
    expect(cascade.fileIds).toEqual(["f1"]);
  });

  it("removes walk tracks and documents too, and reselects a property", () => {
    const next = removePropertyFromState(state, "p1");

    expect(next.properties.map((p) => p.id)).toEqual(["p2"]);
    expect(next.selectedPropertyId).toBe("p2");
    expect(next.walkTracks).toEqual([]);
    expect(next.documents).toEqual([]);
    expect(next.stands.map((s) => s.id)).toEqual(["s2"]);
    expect(next.photoRecords.map((p) => p.id)).toEqual(["ph3"]);
  });

  it("summarizes counts in plain words", () => {
    expect(cascadeSummary(describePropertyCascade(state, "p1").counts)).toBe(
      "1 stand, 1 camera, 2 photos, 1 map pin, 1 walk track and 2 documents",
    );
    expect(cascadeSummary(describePropertyCascade(state, "p2").counts)).toBe(
      "1 stand and 1 photo",
    );
    expect(cascadeSummary(describePropertyCascade(state, "none").counts)).toBe("");
  });
});
