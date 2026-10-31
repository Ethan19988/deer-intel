import { describe, expect, it } from "vitest";
import {
  isOfflineDownloadRunning,
  offlineVectorTrimNote,
  planOfflinePack,
  type OfflineTileSource,
} from "@/lib/offlineMaps";

const imagery: OfflineTileSource = {
  url: "https://tiles.example.com/{z}/{x}/{y}.png",
  maxNativeZoom: 17,
};
const parcels: OfflineTileSource = {
  kind: "pmtiles",
  url: "https://pmtiles.example.com/pa-parcels.pmtiles",
  minNativeZoom: 12,
  maxNativeZoom: 15,
};

// About one zoom-11 screen around a central PA ridge.
const view11 = { south: 41.35, west: -77.35, north: 41.5, east: -77.05 };
// A whole region — far too big for zoom-15 parcels under the cap.
const region = { south: 40.0, west: -79.5, north: 42.0, east: -75.5 };

describe("planOfflinePack parcel depth", () => {
  it("saves parcel tiles to their data zoom from a zoomed-out view", () => {
    const plan = planOfflinePack([imagery, parcels], view11, 11, 13);
    expect(plan.maxZoom).toBe(13);
    expect(plan.vectorMaxZoom).toBe(15);
    expect(plan.vectorTrimmed).toBe(false);
    expect(plan.tileCount).toBeLessThanOrEqual(6000);
    const planned = plan.sources.find((s) => s.kind === "pmtiles");
    expect(planned?.throughZoom).toBe(15);
    expect(offlineVectorTrimNote(plan)).toBe("");
  });

  it("says so when the tile cap keeps parcels shallower", () => {
    const plan = planOfflinePack([imagery, parcels], region, 8, 11);
    expect(plan.tileCount).toBeLessThanOrEqual(6000);
    expect(plan.vectorTrimmed).toBe(true);
    expect(offlineVectorTrimNote(plan)).toMatch(/Property lines/);
  });

  it("leaves packs without a vector source unchanged", () => {
    const plan = planOfflinePack([imagery], view11, 11, 13);
    expect(plan.vectorMaxZoom).toBeUndefined();
    expect(plan.vectorTrimmed).toBeUndefined();
    expect(plan.sources[0]).toEqual(imagery);
  });

  it("has no download running by default", () => {
    expect(isOfflineDownloadRunning()).toBe(false);
  });
});
