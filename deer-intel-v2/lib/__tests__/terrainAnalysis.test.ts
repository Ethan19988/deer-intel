import { describe, expect, it } from "vitest";
import {
  analyzeTerrain,
  BENCH_WIND_NOTE,
  bedWindNote,
  DRAW_WIND_NOTE,
  SADDLE_MIN_CURV,
  saddleStrength,
  type ElevationGrid,
} from "@/lib/terrainAnalysis";

const N = 20;

/** A grid whose elevation at (x east, y north) metres from center is f(x, y). */
function grid(spacingM: number, f: (x: number, y: number) => number): ElevationGrid {
  const z: number[][] = [];
  for (let i = 0; i < N; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < N; j += 1) {
      const x = (j - (N - 1) / 2) * spacingM;
      const y = (i - (N - 1) / 2) * spacingM;
      row.push(f(x, y));
    }
    z.push(row);
  }
  return { center: [41.4, -78.3], rows: N, cols: N, spacingM, z };
}

const pinches = (set: ReturnType<typeof analyzeTerrain>) =>
  (set?.features ?? []).filter((f) => f.kind === "pinch");

describe("saddleStrength (Hessian)", () => {
  it("finds a grid-aligned saddle", () => {
    expect(saddleStrength(2e-4, -3e-4, 0)).toBeCloseTo(2e-4, 8);
  });

  it("finds a diagonal (NE–SW) saddle the old fxx·fyy < 0 test missed", () => {
    // z = k·x·y: no curvature along either grid axis, all in the cross term.
    expect(2e-4 * 0 < 0).toBe(false);
    expect(saddleStrength(0, 0, 3e-4)).toBeCloseTo(3e-4, 8);
  });

  it("is zero for bowls, domes and flat ground", () => {
    expect(saddleStrength(2e-4, 3e-4, 0)).toBe(0);
    expect(saddleStrength(-2e-4, -3e-4, 1e-4)).toBe(0);
    expect(saddleStrength(0, 0, 0)).toBe(0);
  });
});

describe("analyzeTerrain", () => {
  it("never invents saddles on flat or gently tilted ground", () => {
    expect(pinches(analyzeTerrain(grid(70, () => 300), "Flat", "test"))).toHaveLength(0);
    // A plane plus sub-threshold wobble.
    const gentle = grid(70, (x, y) => 300 + 0.01 * x + 1e-6 * x * y);
    expect(pinches(analyzeTerrain(gentle, "Gentle", "test"))).toHaveLength(0);
  });

  it("finds a saddle whose ridge runs NE–SW", () => {
    // Ridge along NE–SW (u axis) rising away from a gap; valleys fall away
    // NW / SE (v axis). z = a·u² − b·v².
    const k = 3 * SADDLE_MIN_CURV;
    const set = analyzeTerrain(
      grid(70, (x, y) => {
        const u = (x + y) / Math.SQRT2;
        const v = (x - y) / Math.SQRT2;
        return 400 + (k / 2) * u * u - (k / 2) * v * v;
      }),
      "Diagonal",
      "test",
    );
    // z = k·x·y here: zero curvature along both grid axes, so the old
    // curvEW·curvNS < 0 test found nothing on this ground.
    expect(pinches(set).length).toBeGreaterThan(0);
  });

  it("reads the same physical saddle at 30 m and 120 m spacing", () => {
    const k = 3 * SADDLE_MIN_CURV;
    const surface = (x: number, y: number) => 400 + (k / 2) * x * x - (k / 2) * y * y;
    expect(pinches(analyzeTerrain(grid(30, surface), "Fine", "test")).length).toBeGreaterThan(0);
    expect(pinches(analyzeTerrain(grid(120, surface), "Coarse", "test")).length).toBeGreaterThan(0);
    // ...and a curvature below the floor is rejected at both.
    const weak = (x: number, y: number) =>
      400 + (SADDLE_MIN_CURV / 4) * x * x - (SADDLE_MIN_CURV / 4) * y * y;
    expect(pinches(analyzeTerrain(grid(30, weak), "Fine", "test"))).toHaveLength(0);
    expect(pinches(analyzeTerrain(grid(120, weak), "Coarse", "test"))).toHaveLength(0);
  });

  it("skips cells next to missing samples instead of emitting NaN", () => {
    // A steep south-facing slope with a hole in it.
    const g = grid(70, (_x, y) => 500 + 0.6 * y);
    g.z[8][8] = Number.NaN;
    g.z[9][12] = Number.NaN;
    const set = analyzeTerrain(g, "Holes", "test");
    const text = JSON.stringify(set);
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/null/);
  });

  it("writes bedding wind notes from the deer's side, never 'approach from above'", () => {
    // South-facing 30° slope: aspect S, so deer bed on a N wind at their back.
    const set = analyzeTerrain(grid(70, (_x, y) => 500 + 0.58 * y), "Slope", "test");
    const beds = (set?.features ?? []).filter((f) => f.kind === "bedding");
    expect(beds.length).toBeGreaterThan(0);
    for (const bed of beds) {
      expect(bed.windNote).not.toMatch(/approach from (the )?(high side|ridge)/i);
      expect(bed.windNote).toMatch(/Don't come in from above/);
    }
    expect(beds[0].windNote).toBe(bedWindNote("N"));
  });

  it("uses the corrected bench and draw advice", () => {
    expect(BENCH_WIND_NOTE).toMatch(/downwind side of the bench trail on a crosswind/);
    expect(BENCH_WIND_NOTE).not.toMatch(/downwind end/);
    expect(DRAW_WIND_NOTE).toMatch(/first light sit the upper part/);
    expect(DRAW_WIND_NOTE).not.toMatch(/lower end at first light/);
  });
});
