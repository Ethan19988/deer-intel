import { describe, expect, it } from "vitest";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import type { PhotoRecord } from "@/types/photo";

function photo(
  id: string,
  species: string,
  windDirection: string,
  buckName?: string,
): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "c1",
    species,
    buckName,
    photoDate: "2024-11-01T17:00:00Z",
    weatherSnapshot: {
      temperature: "40",
      windDirection,
      windSpeed: "8 mph",
      conditions: "Clear",
      moonPhase: "Full",
      source: "historical",
    },
  } as unknown as PhotoRecord;
}

describe("buildPropertyPatternReport — trail-cam sightings", () => {
  it("works with no photos (backward compatible)", () => {
    const report = buildPropertyPatternReport([], [], []);
    expect(report.sightings).toBe(0);
    expect(report.sightingInsights).toEqual([]);
  });

  it("learns a wind pattern from sightings and rates confidence by sample size", () => {
    // 12 bucks on NW (activity 2 each) vs 12 does on S (activity 1) — NW rate 2
    // beats the 1.5 average by 1.33x, and its 12-photo bucket is high confidence.
    const photos: PhotoRecord[] = [];
    for (let i = 0; i < 12; i += 1) {
      photos.push(photo(`nw${i}`, "Buck", "NW", `Buck ${i}`));
      photos.push(photo(`s${i}`, "Doe", "S"));
    }

    const report = buildPropertyPatternReport([], [], [], photos);

    expect(report.sightings).toBe(24);
    const wind = report.sightingInsights.find((i) => i.label === "Best wind");
    expect(wind?.value).toBe("NW wind");
    expect(wind?.confidence).toBe("high");
    expect(wind?.detail).toContain("sightings");
  });

  it("ignores non-deer photos", () => {
    const photos = [
      photo("t1", "Turkey", "NW"),
      photo("t2", "Bear", "NW"),
    ];
    const report = buildPropertyPatternReport([], [], [], photos);
    expect(report.sightings).toBe(0);
  });
});
