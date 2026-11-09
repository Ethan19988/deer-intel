import { describe, expect, it } from "vitest";
import {
  matchRecommendedStand,
  nearbyTerrain,
  nearestCameras,
  selectAiTerrainPicks,
} from "@/lib/aiScoutSpatial";
import type { ScoutPick } from "@/lib/terrainMovementData";
import type { TerrainKind } from "@/lib/terrainMovement";
import type { Camera } from "@/types/camera";

const STAND = { lat: 41.4, lng: -78.3 };
// 0.0001° lat ≈ 11.1 m ≈ 12.2 yd

function camera(id: string, lat?: number, lng?: number): Camera {
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

function pick(id: string, kind: TerrainKind, lat: number, lng: number, confirmed = false): ScoutPick {
  return {
    id,
    kind,
    title: `${kind} ${id}`,
    reason: "",
    point: [lat, lng],
    rank: 0,
    ...(confirmed
      ? {
          confirmation: {
            score: 1,
            cameraName: "Cam",
            distanceM: 50,
            bucks: 1,
            does: 0,
            fawns: 0,
            deer: 1,
            cameraCount: 1,
          },
        }
      : {}),
  };
}

describe("nearestCameras", () => {
  it("returns at most two located cameras within 800 yd, nearest first", () => {
    const result = nearestCameras(STAND, [
      camera("far", 41.408, -78.3), // ~970 yd
      camera("b", 41.403, -78.3), // ~365 yd
      camera("a", 41.401, -78.3), // ~120 yd
      camera("c", 41.405, -78.3), // ~610 yd
      camera("none"),
    ]);
    expect(result.map((c) => c.name)).toEqual(["Cam a", "Cam b"]);
    expect(result[0].yards).toBeGreaterThan(110);
    expect(result[0].yards).toBeLessThan(130);
  });
});

describe("nearbyTerrain", () => {
  it("returns at most three picks within 400 yd", () => {
    const result = nearbyTerrain(STAND, [
      pick("1", "pinch", 41.4005, -78.3),
      pick("2", "bedding", 41.401, -78.3),
      pick("3", "travel", 41.402, -78.3),
      pick("4", "refuge", 41.4025, -78.3),
      pick("5", "pinch", 41.41, -78.3), // ~1200 yd
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.title)).toEqual(["pinch 1", "bedding 2", "travel 3"]);
  });
});

describe("selectAiTerrainPicks", () => {
  it("keeps order, caps each kind at 4 and the total at 14", () => {
    const picks = [
      pick("c1", "bedding", 0, 0, true),
      ...Array.from({ length: 10 }, (_, k) => pick(`p${k}`, "pinch", 0, 0)),
      ...Array.from({ length: 10 }, (_, k) => pick(`b${k}`, "bedding", 0, 0)),
      ...Array.from({ length: 10 }, (_, k) => pick(`t${k}`, "travel", 0, 0)),
      ...Array.from({ length: 10 }, (_, k) => pick(`r${k}`, "refuge", 0, 0)),
    ];
    const chosen = selectAiTerrainPicks(picks);
    expect(chosen).toHaveLength(14);
    expect(chosen[0].id).toBe("c1");
    const count = (kind: TerrainKind) => chosen.filter((p) => p.kind === kind).length;
    expect(count("pinch")).toBe(4);
    expect(count("bedding")).toBe(4);
    expect(count("travel")).toBe(4);
    expect(count("refuge")).toBe(2);
  });
});

describe("matchRecommendedStand", () => {
  const stands = ["Ridge Ladder", "Creek Bottom"];

  it("matches a saved stand case- and punctuation-insensitively", () => {
    expect(matchRecommendedStand("ridge ladder", stands)).toEqual({
      kind: "stand",
      label: "Ridge Ladder",
      standName: "Ridge Ladder",
    });
    expect(matchRecommendedStand('"Creek Bottom" stand', stands).kind).toBe("stand");
  });

  it("labels a terrain pick, and flags anything else", () => {
    expect(matchRecommendedStand("Saddle crossing", stands, ["Saddle crossing"]).label).toBe(
      "Terrain pick: Saddle crossing",
    );
    const none = matchRecommendedStand("Oak Flat", stands);
    expect(none.kind).toBe("none");
    expect(none.label).toMatch(/^No stand matched/);
    expect(matchRecommendedStand("", stands).label).toBe("No stand matched");
  });
});
