import { describe, expect, it } from "vitest";
import {
  getCameraActivityProfile,
  getCameraIntelligenceSummary,
} from "@/lib/cameraIntelligence";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

function photo(
  id: string,
  photoDate: string,
  species: string,
  windDirection?: string,
): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "c1",
    cameraCheckId: "chk1",
    fileName: `${id}.jpg`,
    photoDate,
    species,
    notes: "",
    createdAt: photoDate,
    weatherSnapshot: windDirection
      ? {
          temperature: "40",
          windDirection,
          windSpeed: "8 mph",
          conditions: "Clear",
          moonPhase: "Waxing",
          source: "historical",
        }
      : undefined,
  };
}

describe("getCameraActivityProfile", () => {
  it("returns null below the minimum sample size", () => {
    expect(
      getCameraActivityProfile([
        photo("1", "2024-11-01T17:00:00", "Buck"),
        photo("2", "2024-11-02T17:30:00", "Doe"),
      ]),
    ).toBeNull();
  });

  it("summarizes peak window, wind bias, and buck/doe split", () => {
    const profile = getCameraActivityProfile([
      photo("1", "2024-11-01T17:00:00", "Buck", "NW"),
      photo("2", "2024-11-02T18:15:00", "Doe", "NW"),
      photo("3", "2024-11-03T16:30:00", "Buck", "S"),
    ]);

    expect(profile).not.toBeNull();
    expect(profile?.sampleSize).toBe(3);
    expect(profile?.peakWindow).toBe("Evening (3–8pm)");
    expect(profile?.topWind).toBe("NW");
    expect(profile?.bucks).toBe(2);
    expect(profile?.does).toBe(1);
  });
});

function check(id: string, counts: { bucks?: number; does?: number; fawns?: number }): CameraCheck {
  return {
    id,
    propertyId: "p1",
    cameraId: "c1",
    date: "2024-11-03",
    bucks: counts.bucks ?? 0,
    does: counts.does ?? 0,
    fawns: counts.fawns ?? 0,
  } as unknown as CameraCheck;
}

describe("getCameraIntelligenceSummary activity counts", () => {
  function counts(cameraChecks: CameraCheck[], photoRecords: PhotoRecord[]) {
    return getCameraIntelligenceSummary({
      cameras: [],
      cameraChecks,
      photoRecords,
      now: new Date(2024, 10, 5),
    }).activityCounts;
  }

  it("counts a check's imported photos instead of its logged tally", () => {
    // "2 bucks" logged on chk1, and those same two photos imported to it.
    const result = counts(
      [check("chk1", { bucks: 2 })],
      [photo("1", "2024-11-01T17:00:00", "Buck"), photo("2", "2024-11-02T17:30:00", "Buck")],
    );
    expect(result).toEqual({ bucks: 2, does: 0, fawns: 0 });
  });

  it("uses the tally for checks without photos and counts unlinked photos", () => {
    const unlinked = { ...photo("3", "2024-11-03T07:00:00", "Doe"), cameraCheckId: "" };
    const result = counts(
      [check("chk1", { bucks: 2 }), check("chk2", { does: 3, fawns: 1 })],
      [photo("1", "2024-11-01T17:00:00", "Buck"), unlinked],
    );
    // chk1 → its 1 photo; chk2 → its tally; plus the unlinked doe.
    expect(result).toEqual({ bucks: 1, does: 4, fawns: 1 });
  });
});
