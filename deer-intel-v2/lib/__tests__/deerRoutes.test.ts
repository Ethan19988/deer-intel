import { describe, expect, it } from "vitest";
import {
  NOTE_NO_BEDDING,
  NOTE_NO_LANDCOVER,
  NOTE_PREDICTION,
  buildDeerRoutePlan,
  type DeerRoutePlanInput,
} from "@/lib/deerRoutes";
import type { LatLng, MovementGrid } from "@/lib/movementGridTypes";
import type { TerrainMovementSet } from "@/lib/terrainMovement";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// Small synthetic grids: 30 m cells near 41.5°N (PA ridge country).
const ORIGIN = { lat: 41.5, lng: -77.5 };
const CELL_M = 30;
const CELL_LAT = CELL_M / 111_320;
const CELL_LNG = CELL_M / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180));

function makeGrid(
  rows: number,
  cols: number,
  elev: (r: number, c: number) => number,
  land?: (r: number, c: number) => number,
): MovementGrid {
  const elevation: number[] = [];
  const landcover: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      elevation.push(elev(r, c));
      if (land) landcover.push(land(r, c));
    }
  }
  return {
    origin: ORIGIN,
    cellM: CELL_M,
    cellLat: CELL_LAT,
    cellLng: CELL_LNG,
    rows,
    cols,
    elevation,
    landcover: land ? landcover : undefined,
    source: "test",
  };
}

/** Center of cell (r, c). */
function at(r: number, c: number): LatLng {
  return { lat: ORIGIN.lat + (r + 0.5) * CELL_LAT, lng: ORIGIN.lng + (c + 0.5) * CELL_LNG };
}

/** Fractional (row, col) of a point. */
function rc(point: LatLng): { r: number; c: number } {
  return {
    r: (point.lat - ORIGIN.lat) / CELL_LAT - 0.5,
    c: (point.lng - ORIGIN.lng) / CELL_LNG - 0.5,
  };
}

function pin(id: string, type: PinType, r: number, c: number): MapPin {
  return { id, propertyId: "p1", type, ...at(r, c), createdAt: "", name: id, notes: "" };
}

function stand(id: string, extra: Partial<Stand> = {}): Stand {
  return {
    id,
    propertyId: "p1",
    name: id,
    standType: "Hang-on",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...extra,
  } as Stand;
}

function input(grid: MovementGrid, extra: Partial<DeerRoutePlanInput> = {}): DeerRoutePlanInput {
  return { grid, pins: [], stands: [], standLocations: {}, ...extra };
}

/** Points every ~cell along a polyline, as fractional (row, col). */
function densify(path: LatLng[]): Array<{ r: number; c: number }> {
  const out: Array<{ r: number; c: number }> = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = rc(path[i]);
    const b = rc(path[i + 1]);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.r - a.r, b.c - a.c) * 2));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push({ r: a.r + (b.r - a.r) * t, c: a.c + (b.c - a.c) * t });
    }
  }
  out.push(rc(path[path.length - 1]));
  return out;
}

// An east–west ridge along row 10 (60 m of relief) with a saddle at column 10
// that dips to 25 m.
const crest = (c: number) => 60 - 35 * Math.exp(-(((c - 10) / 2.5) ** 2));
const ridgeElev = (r: number, c: number) => 300 + crest(c) * Math.exp(-(((r - 10) / 4) ** 2));
const SADDLE = { r: 10, c: 10 };

describe("buildDeerRoutePlan — terrain", () => {
  it("crosses a ridge through the saddle, not over the crest", () => {
    const grid = makeGrid(21, 21, ridgeElev);
    const plan = buildDeerRoutePlan(
      input(grid, { pins: [pin("bed", "Bedding", 3, 4), pin("oaks", "Food", 17, 4)] }),
    );

    expect(plan.routes).toHaveLength(1);
    const route = plan.routes[0];
    const points = densify(route.path);
    const crossing = points.reduce((best, p) =>
      Math.abs(p.r - 10) < Math.abs(best.r - 10) ? p : best,
    );
    // Crosses the crest line within a cell or two of the saddle…
    expect(Math.abs(crossing.c - SADDLE.c)).toBeLessThanOrEqual(1.5);
    // …and never goes near the 60 m crest straight between bed and food.
    expect(points.every((p) => Math.abs(p.c - 4) > 2 || Math.abs(p.r - 10) > 3)).toBe(true);
    expect(route.uses).toContain("saddle");
    expect(route.from.source).toBe("pin");
    expect(route.to).toMatchObject({ kind: "food", source: "pin" });
    expect(plan.notes).toContain(NOTE_NO_LANDCOVER);
    expect(plan.notes).toContain(NOTE_PREDICTION);
  });

  it("rides a bench along a steep sidehill instead of side-hilling or climbing", () => {
    // 30° hillside rising north, with a flat bench at rows 4–6.
    const rise = CELL_M * Math.tan((30 * Math.PI) / 180);
    const level = (r: number) => (r <= 4 ? r : r <= 6 ? 4 : r - 2) * rise;
    const grid = makeGrid(15, 25, (r) => 300 + level(r));
    const plan = buildDeerRoutePlan(
      input(grid, { pins: [pin("bed", "Bedding", 3, 1), pin("acorns", "Food", 3, 23)] }),
    );

    expect(plan.routes).toHaveLength(1);
    const route = plan.routes[0];
    expect(route.uses).toContain("bench");
    const middle = densify(route.path).filter((p) => p.c >= 6 && p.c <= 18);
    expect(middle.length).toBeGreaterThan(0);
    expect(middle.every((p) => p.r >= 4 - 0.01 && p.r <= 6 + 0.01)).toBe(true);
  });
});

describe("buildDeerRoutePlan — land cover", () => {
  // Flat forest with a crop field in the south-middle (rows 0–11, cols 7–12).
  const inField = (r: number, c: number) => r <= 11 && c >= 7 && c <= 12;
  const grid = makeGrid(
    20,
    20,
    () => 300,
    (r, c) => (inField(r, c) ? 82 : 41),
  );

  it("goes around an open field rather than across it", () => {
    const plan = buildDeerRoutePlan(
      input(grid, { pins: [pin("bed", "Bedding", 3, 2), pin("plot", "Food", 3, 17)] }),
    );
    const toPin = plan.routes.find((route) => route.to.source === "pin");
    expect(toPin).toBeDefined();
    const fieldPoints = densify(toPin!.path).filter((p) =>
      inField(Math.round(p.r), Math.round(p.c)),
    );
    expect(fieldPoints).toHaveLength(0);
    expect(plan.notes).not.toContain(NOTE_NO_LANDCOVER);
  });

  it("steps into the field only for the last cells to food on its edge", () => {
    const plan = buildDeerRoutePlan(
      input(grid, { pins: [pin("bed", "Bedding", 5, 2), pin("beans", "Food", 5, 9)] }),
    );
    const toPin = plan.routes.find((route) => route.to.source === "pin");
    expect(toPin).toBeDefined();
    const fieldCols = densify(toPin!.path)
      .filter((p) => inField(Math.round(p.r), Math.round(p.c)))
      .map((p) => Math.round(p.c));
    expect(fieldCols.length).toBeGreaterThan(0);
    expect(Math.min(...fieldCols)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...fieldCols)).toBeLessThanOrEqual(9);
  });

  it("finds field-edge food from land cover", () => {
    const plan = buildDeerRoutePlan(input(grid, { pins: [pin("bed", "Bedding", 15, 2)] }));
    expect(plan.routes.length).toBeGreaterThan(0);
    expect(plan.routes.every((route) => route.to.source === "landcover")).toBe(true);
    expect(plan.routes[0].to.label).toBe("Crop field edge");
  });
});

describe("buildDeerRoutePlan — funnels and wind", () => {
  it("marks a funnel where routes from two beds merge at the saddle", () => {
    const grid = makeGrid(21, 21, ridgeElev);
    const terrain: TerrainMovementSet = {
      areaName: "Test ridge",
      center: [at(10, 10).lat, at(10, 10).lng],
      source: "test",
      features: [
        {
          id: "east-bench",
          kind: "bedding",
          title: "East sidehill beds",
          detail: "",
          polygon: [
            [at(2, 16).lat, at(2, 16).lng],
            [at(2, 18).lat, at(2, 18).lng],
            [at(4, 18).lat, at(4, 18).lng],
            [at(4, 16).lat, at(4, 16).lng],
          ],
        },
      ],
    };
    const plan = buildDeerRoutePlan(
      input(grid, {
        terrain,
        pins: [pin("west-bed", "Bedding", 3, 3), pin("oaks", "Food", 18, 10)],
        stands: [stand("saddle-stand")],
        standLocations: { "saddle-stand": at(10, 12) },
        sitWind: { fromDeg: 90, label: "E", period: "PM" },
      }),
    );

    expect(plan.routes).toHaveLength(2);
    expect(plan.routes.map((route) => route.from.source).sort()).toEqual(["pin", "terrain"]);
    expect(plan.funnels.length).toBeGreaterThanOrEqual(1);
    const funnel = plan.funnels[0];
    expect(funnel.routeCount).toBe(2);
    expect(funnel.routeIds.sort()).toEqual(plan.routes.map((route) => route.id).sort());
    expect(funnel.feature).toBe("saddle");
    const spot = rc(funnel.point);
    expect(Math.hypot(spot.r - SADDLE.r, spot.c - SADDLE.c)).toBeLessThanOrEqual(1.01);
    expect(funnel.nearestStand).toMatchObject({ id: "saddle-stand" });
    expect(funnel.nearestStand!.yards).toBeLessThan(100);
    expect(funnel.wind).toBeDefined();
  });

  it("flips a stand's wind check with the wind direction", () => {
    // Flat woods; the route runs straight north up column 10. Stand 60 m east.
    const grid = makeGrid(21, 21, () => 300);
    const base = input(grid, {
      pins: [pin("bed", "Bedding", 1, 10), pin("food", "Food", 19, 10)],
      stands: [stand("east-tree")],
      standLocations: { "east-tree": at(10, 12) },
    });

    const westWind = buildDeerRoutePlan({ ...base, sitWind: { fromDeg: 270, label: "W", period: "AM" } });
    const eastWind = buildDeerRoutePlan({ ...base, sitWind: { fromDeg: 90, label: "E", period: "AM" } });

    const westFit = westWind.stands[0];
    expect(westFit.standId).toBe("east-tree");
    expect(westFit.yardsToRoute).toBeGreaterThan(55);
    expect(westFit.yardsToRoute).toBeLessThan(75);
    expect(westFit.routeIds).toEqual([westWind.routes[0].id]);
    expect(westFit.wind?.ok).toBe(true);
    expect(westFit.wind?.note).toMatch(/away from the trail/);

    const eastFit = eastWind.stands[0];
    expect(eastFit.wind?.ok).toBe(false);
    expect(eastFit.wind?.note).toMatch(/^E wind blows your scent across the trail \d+ yd west$/);
  });

  it("lets a stand's own avoid-wind notes fail the check", () => {
    const grid = makeGrid(21, 21, () => 300);
    const plan = buildDeerRoutePlan(
      input(grid, {
        pins: [pin("bed", "Bedding", 1, 10), pin("food", "Food", 19, 10)],
        stands: [stand("east-tree", { avoidWinds: "W" })],
        standLocations: { "east-tree": at(10, 12) },
        sitWind: { fromDeg: 270, label: "W", period: "AM" },
      }),
    );
    expect(plan.stands[0].wind?.ok).toBe(false);
    expect(plan.stands[0].wind?.note).toMatch(/stand notes say avoid W/);
  });

  it("credits camera visits near a route", () => {
    const grid = makeGrid(21, 21, () => 300);
    const pins = [pin("bed", "Bedding", 1, 10), pin("food", "Food", 19, 10)];
    const without = buildDeerRoutePlan(input(grid, { pins }));
    const withCam = buildDeerRoutePlan(
      input(grid, {
        pins,
        cameras: [{ name: "Creek cam", ...at(10, 11), visits: 8, visitsAM: 1, visitsPM: 7 }],
      }),
    );
    expect(withCam.routes[0].camera).toEqual({ name: "Creek cam", visits: 8, period: "PM" });
    expect(withCam.routes[0].strength).toBeGreaterThan(without.routes[0].strength);
  });
});

describe("buildDeerRoutePlan — empty cases", () => {
  it("returns an empty plan with a note when there is no bedding", () => {
    const grid = makeGrid(10, 10, () => 300);
    const plan = buildDeerRoutePlan(input(grid, { pins: [pin("food", "Food", 5, 5)] }));
    expect(plan.routes).toEqual([]);
    expect(plan.funnels).toEqual([]);
    expect(plan.stands).toEqual([]);
    expect(plan.notes[0]).toBe(NOTE_NO_BEDDING);
  });

  it("skips beds and food more than a mile apart", () => {
    const grid = makeGrid(10, 70, () => 300);
    const plan = buildDeerRoutePlan(
      input(grid, { pins: [pin("bed", "Bedding", 5, 1), pin("food", "Food", 5, 68)] }),
    );
    expect(plan.routes).toEqual([]);
    expect(plan.notes.some((note) => /within a mile/.test(note))).toBe(true);
  });
});
