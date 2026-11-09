import { describe, expect, it } from "vitest";
import {
  arrowMarks,
  bearingDeg,
  cameraVisits,
  funnelHeadline,
  funnelRadius,
  nearestStandLine,
  orientedPath,
  pathMidpoint,
  rankedStandFits,
  routeStyle,
  routeTravel,
  routesAsCorridors,
  seasonStart,
  sitWindFor,
  smoothPath,
  standFitLine,
  topFunnels,
  windLine,
  WEAK_ROUTE_STRENGTH,
} from "@/components/map/deerRoutesView";
import { normalizeState } from "@/lib/deerIntelStore";
import type { DeerRoute, RouteFunnel, StandRouteFit } from "@/lib/movementGridTypes";

const bed = { lat: 41.5, lng: -77.5 };
const food = { lat: 41.51, lng: -77.5 };

function route(overrides: Partial<DeerRoute> = {}): DeerRoute {
  return {
    id: "r1",
    path: [bed, { lat: 41.505, lng: -77.499 }, food],
    from: { kind: "bedding", label: "Bench bed", point: bed, source: "terrain" },
    to: { kind: "food", label: "Oak flat", point: food, source: "pin" },
    lengthM: 1110,
    strength: 0.7,
    uses: ["bench"],
    ...overrides,
  };
}

function funnel(overrides: Partial<RouteFunnel> = {}): RouteFunnel {
  return {
    id: "f1",
    point: { lat: 41.505, lng: -77.5 },
    routeCount: 3,
    routeIds: ["r1", "r2", "r3"],
    feature: "saddle",
    score: 0.5,
    ...overrides,
  };
}

describe("travel direction", () => {
  it("heads to bed at dawn, to food at dusk, nowhere midday/night", () => {
    expect(routeTravel("dawn")).toBe("to-bed");
    expect(routeTravel("dusk")).toBe("to-food");
    expect(routeTravel("midday")).toBeNull();
    expect(routeTravel("night")).toBeNull();
  });

  it("reverses the bed→food path only for the AM walk back to bed", () => {
    const path = route().path;
    expect(orientedPath(path, "to-bed")[0]).toEqual(food);
    expect(orientedPath(path, "to-food")[0]).toEqual(bed);
    expect(path[0]).toEqual(bed); // not mutated
  });

  it("points arrows along the walk: north going out to food, south coming back", () => {
    const straight = [bed, food];
    const out = arrowMarks(orientedPath(straight, "to-food"));
    const back = arrowMarks(orientedPath(straight, "to-bed"));
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(4);
    expect(out[0].bearing).toBeCloseTo(0, 0);
    expect(back[0].bearing).toBeCloseTo(180, 0);
  });

  it("measures compass bearings", () => {
    expect(bearingDeg(bed, { lat: 41.5, lng: -77.49 })).toBeCloseTo(90, 0);
  });
});

describe("route styling", () => {
  it("dashes weak routes and draws strong ones solid and heavier", () => {
    const weak = routeStyle(WEAK_ROUTE_STRENGTH - 0.05, false);
    const strong = routeStyle(0.9, false);
    expect(weak.dashArray).toBeDefined();
    expect(strong.dashArray).toBeUndefined();
    expect(strong.weight).toBeGreaterThan(weak.weight);
    expect(strong.opacity).toBeGreaterThan(weak.opacity);
  });

  it("brightens camera-backed routes", () => {
    const plain = routeStyle(0.5, false);
    const cam = routeStyle(0.5, true);
    expect(cam.color).not.toBe(plain.color);
    expect(cam.opacity).toBeGreaterThanOrEqual(0.92);
  });

  it("smooths stair-steps but keeps both ends", () => {
    const path = route().path;
    const smooth = smoothPath(path);
    expect(smooth[0]).toEqual(path[0]);
    expect(smooth[smooth.length - 1]).toEqual(path[path.length - 1]);
    expect(smooth.length).toBeGreaterThan(path.length);
    expect(smoothPath([bed, food])).toEqual([bed, food]);
  });

  it("finds the distance midpoint", () => {
    const mid = pathMidpoint([bed, food]);
    expect(mid?.lat).toBeCloseTo(41.505, 5);
  });
});

describe("funnel card", () => {
  it("reads 'Funnel · saddle · 3 routes'", () => {
    expect(funnelHeadline(funnel())).toBe("Funnel · saddle · 3 routes");
    expect(funnelHeadline(funnel({ routeCount: 1, feature: "" }))).toBe("Funnel · 1 route");
  });

  it("grows the ring with route count, capped", () => {
    expect(funnelRadius(4)).toBeGreaterThan(funnelRadius(2));
    expect(funnelRadius(20)).toBe(funnelRadius(6));
  });

  it("marks the wind line ✓ / ✕", () => {
    expect(windLine({ ok: true, note: "" })).toBe("✓ Scent blows away");
    expect(windLine({ ok: false, note: "NW wind blows scent onto the trail" })).toBe(
      "✕ NW wind blows scent onto the trail",
    );
    expect(windLine(undefined)).toBeNull();
  });

  it("names the nearest stand", () => {
    expect(nearestStandLine(funnel({ nearestStand: { id: "s", name: "Oak Flat", yards: 82.4 } }))).toBe(
      "Nearest stand: Oak Flat · 82 yd",
    );
    expect(nearestStandLine(funnel())).toBe("No stand within 300 yd");
  });

  it("ranks the top three funnels by score", () => {
    const ranked = topFunnels([
      funnel({ id: "a", score: 0.2 }),
      funnel({ id: "b", score: 0.9 }),
      funnel({ id: "c", score: 0.5 }),
      funnel({ id: "d", score: 0.7 }),
    ]);
    expect(ranked.map((f) => f.id)).toEqual(["b", "d", "c"]);
  });
});

describe("stand fit", () => {
  const fit: StandRouteFit = {
    standId: "s1",
    standName: "Oak Flat",
    yardsToRoute: 40.2,
    routeIds: ["r1", "r2"],
    wind: { ok: true, note: "Scent blows away" },
  };

  it("reads 'Oak Flat · 40 yd from 2 routes · wind ✓'", () => {
    expect(standFitLine(fit)).toBe("Oak Flat · 40 yd from 2 routes · wind ✓");
    expect(standFitLine({ ...fit, routeIds: ["r1"], wind: { ok: false, note: "" } })).toBe(
      "Oak Flat · 40 yd from 1 route · wind ✕",
    );
  });

  it("lists stands closest to the routes first", () => {
    const ranked = rankedStandFits([{ ...fit, standId: "far", yardsToRoute: 200 }, fit]);
    expect(ranked[0].standId).toBe("s1");
  });
});

describe("wiring helpers", () => {
  it("turns the next sit's compass wind into degrees and a half-day", () => {
    expect(sitWindFor("NW", "evening")).toEqual({ fromDeg: 315, label: "NW", period: "PM" });
    expect(sitWindFor("s", "tomorrow")).toEqual({ fromDeg: 180, label: "S", period: "AM" });
    expect(sitWindFor(undefined, "morning")).toBeUndefined();
    expect(sitWindFor("calm", "morning")).toBeUndefined();
  });

  it("hands Deer Heat the routes' endpoints in corridor shape", () => {
    expect(routesAsCorridors([route()])).toEqual([
      {
        id: "r1",
        bedding: bed,
        resource: food,
        resourceKind: "food",
        distanceM: 1110,
        strength: 0.7,
      },
    ]);
  });

  it("starts the season Aug 1", () => {
    expect(seasonStart(new Date(2026, 10, 9))).toEqual(new Date(2026, 7, 1));
    expect(seasonStart(new Date(2027, 0, 10))).toEqual(new Date(2026, 7, 1));
  });

  it("splits this season's deer photos AM / PM per located camera", () => {
    const cams = [
      { id: "c1", name: "Ridge cam", latitude: 41.5, longitude: -77.5 },
      { id: "c2", name: "No GPS" },
    ];
    const photos = [
      { cameraSiteId: "c1", photoDate: "2026-10-20T06:40:00", species: "Deer", captureTimeSource: "exif" as const },
      { cameraSiteId: "c1", photoDate: "2026-10-21T17:55:00", species: "Buck", captureTimeSource: "exif" as const },
      { cameraSiteId: "c1", photoDate: "2026-10-22T18:10:00", species: "Doe", captureTimeSource: "exif" as const },
      { cameraSiteId: "c1", photoDate: "2026-10-23", species: "Deer" },
      { cameraSiteId: "c1", photoDate: "2026-10-23T18:00:00", species: "Turkey", captureTimeSource: "exif" as const },
      { cameraSiteId: "c1", photoDate: "2025-10-23T18:00:00", species: "Deer", captureTimeSource: "exif" as const },
    ];
    const result = cameraVisits(cams, photos, new Date(2026, 10, 9));
    expect(result).toEqual([
      { name: "Ridge cam", lat: 41.5, lng: -77.5, visitsAM: 1, visitsPM: 2, visits: 4 },
    ]);
  });
});

describe("pin foodKind", () => {
  function pinsOf(foodKind: unknown) {
    const state = normalizeState({
      version: 2,
      properties: [{ id: "p1", name: "Ridge" }],
      pins: [{ id: "pin1", propertyId: "p1", type: "Food", lat: 41, lng: -77, foodKind }],
    });
    return state!.pins;
  }

  it("passes through a short non-empty string", () => {
    expect(pinsOf("White oak acorns")[0].foodKind).toBe("White oak acorns");
  });

  it("drops empty, too-long or non-string values", () => {
    expect(pinsOf("")[0].foodKind).toBeUndefined();
    expect(pinsOf("x".repeat(41))[0].foodKind).toBeUndefined();
    expect(pinsOf(42)[0].foodKind).toBeUndefined();
    expect("foodKind" in pinsOf(undefined)[0]).toBe(false);
  });
});
