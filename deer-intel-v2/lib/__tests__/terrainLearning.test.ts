import { describe, expect, it } from "vitest";
import {
  aggregateCameraActivity,
  CAMERA_ACTIVITY_RADIUS_M,
  confirmAt,
  huntingSeasonYear,
  seasonDecayWeight,
} from "@/lib/terrainLearning";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";

const NOW = new Date(2026, 10, 9, 12); // Nov 9, 2026

function camera(id: string, lat: number, lng: number): Camera {
  return {
    id,
    propertyId: "p1",
    name: `Cam ${id}`,
    cameraType: "Standard",
    manufacturer: "",
    model: "",
    status: "Active",
    latitude: lat,
    longitude: lng,
    locationNotes: "",
    notes: "",
  };
}

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

function check(cameraId: string, date: string, bucks: number, does: number): CameraCheck {
  return {
    id: `${cameraId}-${date}`,
    propertyId: "p1",
    cameraId,
    date,
    batteryPercent: "",
    sdCardPercent: "",
    weatherSnapshot: snapshot,
    bucks,
    does,
    fawns: 0,
    turkeys: 0,
    bears: 0,
    coyotes: 0,
    otherWildlife: "",
    notes: "",
  };
}

// ~0.0009° lat ≈ 100 m
const SPOT: [number, number] = [41.4, -78.3];

describe("season decay", () => {
  it("counts January with the fall before it", () => {
    expect(huntingSeasonYear(new Date(2027, 0, 10))).toBe(2026);
    expect(huntingSeasonYear(new Date(2026, 9, 10))).toBe(2026);
  });

  it("weights this season fully, last season half, older not at all", () => {
    expect(seasonDecayWeight(new Date(2026, 9, 1).getTime(), NOW)).toBe(1);
    expect(seasonDecayWeight(new Date(2025, 10, 1).getTime(), NOW)).toBe(0.5);
    expect(seasonDecayWeight(new Date(2024, 10, 1).getTime(), NOW)).toBe(0);
    expect(seasonDecayWeight(Number.NaN, NOW)).toBe(0);
  });
});

describe("camera activity nearby", () => {
  it("only counts cameras within ~200 m", () => {
    expect(CAMERA_ACTIVITY_RADIUS_M).toBe(200);
    const obs = aggregateCameraActivity(
      [camera("near", 41.4009, -78.3), camera("far", 41.4036, -78.3)], // ~100 m, ~400 m
      [check("near", "2026-10-20", 1, 2), check("far", "2026-10-20", 5, 5)],
      NOW,
    );
    const hit = confirmAt(SPOT, obs);
    expect(hit?.cameraName).toBe("Cam near");
    expect(hit?.cameraCount).toBe(1);
  });

  it("ignores old seasons and halves last season", () => {
    const old = aggregateCameraActivity(
      [camera("a", 41.4005, -78.3)],
      [check("a", "2023-11-01", 4, 4)],
      NOW,
    );
    expect(confirmAt(SPOT, old)).toBeNull();
    // All-time counts are still there for the heat layers.
    expect(old[0].bucks).toBe(4);

    const lastSeason = aggregateCameraActivity(
      [camera("a", 41.4, -78.3)],
      [check("a", "2025-11-01", 1, 2)],
      NOW,
    );
    const thisSeason = aggregateCameraActivity(
      [camera("a", 41.4, -78.3)],
      [check("a", "2026-11-01", 1, 2)],
      NOW,
    );
    expect(confirmAt(SPOT, lastSeason)?.score).toBe(2);
    expect(confirmAt(SPOT, thisSeason)?.score).toBe(4);
    // The displayed counts are this + last season's.
    expect(confirmAt(SPOT, lastSeason)?.deer).toBe(3);
  });
});
