import { describe, expect, it } from "vitest";
import {
  buildSightingRows,
  gridRegion,
  hashKey,
  regionLabel,
  toRegionalActivity,
} from "@/lib/sharedSightings";
import type { PhotoRecord } from "@/types/photo";

function photo(id: string, photoDate: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id,
    propertyId: "p",
    cameraSiteId: "c",
    cameraCheckId: "",
    fileName: "IMG_0042.JPG",
    photoDate,
    species: "Doe",
    notes: "Big 8 by the oak on Moore Hill",
    createdAt: "",
    imageId: "img-1",
    ...extra,
  };
}

describe("buildSightingRows", () => {
  it("keeps only anonymous fields: no photo, name, notes, file, or location", () => {
    const [row] = buildSightingRows(
      [
        photo("photo-1", "2026-10-15T17:40", {
          buckNames: ["Big 8"],
          weatherSnapshot: {
            temperature: "48",
            windDirection: "NW",
            windSpeed: "7 mph",
            conditions: "Clear",
            moonPhase: "Full",
            source: "photo",
          },
        }),
      ],
      "PA:Clinton",
      () => "pre-rut",
    );

    expect(row).toEqual({
      source_key: hashKey("photo-1"),
      region: "PA:Clinton",
      sighting_date: "2026-10-15",
      hour: 17,
      is_buck: true,
      temp_f: 48,
      wind_mph: 7,
      pressure_trend: null,
      rut_phase: "pre-rut",
    });
    const serialized = JSON.stringify(row);
    for (const secret of ["Big 8", "Moore Hill", "IMG_0042", "img-1", "photo-1"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("skips date-only photos and non-deer", () => {
    const rows = buildSightingRows(
      [photo("a", "2026-10-15"), photo("b", "2026-10-15T07:00", { species: "Black bear" })],
      "PA:Clinton",
      () => undefined,
    );

    expect(rows).toEqual([]);
  });
});

describe("regions", () => {
  it("snaps to a ~30-mile grid outside PA and labels regions", () => {
    expect(gridRegion(41.73, -77.22)).toBe("grid:41.5,-77.5");
    expect(regionLabel("PA:Clinton")).toBe("Clinton County");
    expect(regionLabel("grid:41.5,-77.5")).toBe("your area");
  });

  it("hashes ids one way and consistently", () => {
    expect(hashKey("photo-1")).toBe(hashKey("photo-1"));
    expect(hashKey("photo-1")).not.toBe(hashKey("photo-2"));
    expect(hashKey("photo-1")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("toRegionalActivity", () => {
  it("turns hourly totals into chart data with a peak", () => {
    const activity = toRegionalActivity(
      [
        { hour: 7, sightings: 10, bucks: 2, contributors: 4 },
        { hour: 17, sightings: 14, bucks: 5, contributors: 4 },
        { hour: 18, sightings: 12, bucks: 3, contributors: 4 },
      ],
      "PA:Clinton",
      45,
    );

    expect(activity?.total).toBe(36);
    expect(activity?.peakStartHour).toBe(17);
    expect(activity?.contributors).toBe(4);
    expect(activity?.regionLabel).toBe("Clinton County");
  });

  it("returns nothing when the region is below the privacy threshold", () => {
    expect(toRegionalActivity([], "PA:Clinton", 45)).toBeNull();
  });
});
