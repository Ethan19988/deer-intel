import { describe, expect, it } from "vitest";
import { getCameraActivityProfile } from "@/lib/cameraIntelligence";
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
