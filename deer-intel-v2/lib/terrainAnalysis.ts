// Live terrain analysis: turn an elevation grid over a property into a
// TerrainMovementSet (likely bedding, travel, saddles, refuge) using the same
// slope/aspect/curvature math validated on Moore Hill, interpreted with the
// Penn State Deer-Forest rules. Framework-neutral (no "use client") so the
// /api/terrain route can run it server-side. Coarse vs. the 1 m LiDAR pipeline,
// but it runs automatically for ANY property with a saved location.

import type {
  LatLng,
  TerrainMovementFeature,
  TerrainMovementSet,
} from "@/lib/terrainMovement";

/** A square elevation grid; z[i][j], i = row (north+), j = col (east+). */
export type ElevationGrid = {
  center: LatLng;
  rows: number;
  cols: number;
  spacingM: number;
  z: number[][];
};

const DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compass(deg: number): string {
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** The wind deer bed on for ground that faces `aspect` (downhill): wind from
 * the uphill side, at their back, while they watch downhill. This is the DEER's
 * wind — coming in from above on it blows scent straight onto the beds. */
function deerBedWind(aspect: number): string {
  return compass(aspect + 180);
}

/** Wind note for a bed: the wind deer pick it on, and how NOT to approach. */
export function bedWindNote(wind: string): string {
  return `Deer bed here on a ${wind} wind (wind at their back, eyes downhill). Don't come in from above — hunt the exit trail on a crosswind.`;
}

export const BENCH_WIND_NOTE =
  "Deer often walk benches into the wind — set up on the downwind side of the bench trail on a crosswind.";

export const DRAW_WIND_NOTE =
  "At first light sit the upper part or side of the draw so falling thermals carry scent down and away from deer coming up it; in the evening, mid-afternoon rising thermals favor the lower end.";

type Cell = {
  i: number;
  j: number;
  lat: number;
  lng: number;
  e: number;
  slope: number;
  aspect: number;
  /** Second derivatives in 1/m (independent of grid spacing). */
  fxx: number;
  fyy: number;
  fxy: number;
  lap: number;
};

// Curvature cutoffs in 1/m. They were tuned as raw second differences (metres)
// on the default 70 m live grid, so they're that number / 70². Dividing by the
// spacing² keeps a 30 m or 120 m read (hunt-area-sized grids) on the same
// physical scale instead of flagging far more/fewer cells as the spacing moves.
const REF_SPACING_M = 70;
const PER_REF = 1 / (REF_SPACING_M * REF_SPACING_M);
/** Both principal curvatures of a saddle must be at least this strong. */
export const SADDLE_MIN_CURV = 0.6 * PER_REF;
const SPUR_CURV = 0.4 * PER_REF;
const DRAW_LAP = 1.0 * PER_REF;
const BENCH_MAX_LAP = 2.5 * PER_REF;

/**
 * Saddle strength from the Hessian: the smaller of the two principal-curvature
 * magnitudes when they have opposite signs (det = fxx·fyy − fxy² < 0), else 0.
 * Rotation-invariant, so a saddle whose axes run NE–SW counts the same as one
 * aligned with the grid (the old curvEW·curvNS < 0 test missed those).
 */
export function saddleStrength(fxx: number, fyy: number, fxy: number): number {
  if (fxx * fyy - fxy * fxy >= 0) return 0;
  const mean = (fxx + fyy) / 2;
  const radius = Math.hypot((fxx - fyy) / 2, fxy);
  return Math.max(0, radius - Math.abs(mean));
}

const M_TO_FT = 3.28084;
const SOUTH_MIN = 120;
const SOUTH_MAX = 240;

export function analyzeTerrain(
  grid: ElevationGrid,
  areaName: string,
  source: string,
): TerrainMovementSet | null {
  const { center, rows, cols, spacingM, z } = grid;
  const dLat = spacingM / 111_000;
  const dLng = spacingM / (111_000 * Math.cos((center[0] * Math.PI) / 180));

  const cellLat = (i: number) => center[0] + (i - (rows - 1) / 2) * dLat;
  const cellLng = (j: number) => center[1] + (j - (cols - 1) / 2) * dLng;

  const cells: Cell[] = [];
  let summit: Cell | null = null;
  for (let i = 1; i < rows - 1; i += 1) {
    for (let j = 1; j < cols - 1; j += 1) {
      const e = z[i]?.[j];
      if (!Number.isFinite(e)) continue;
      // Every derivative below reads the full 3x3 neighbourhood; one missing
      // sample would turn slope into NaN ("Steep sanctuary ~NaN°"), so skip.
      if (!neighbourhoodFinite(z, i, j)) continue;
      const s2 = spacingM * spacingM;
      const dzdx = (z[i][j + 1] - z[i][j - 1]) / (2 * spacingM);
      const dzdy = (z[i + 1][j] - z[i - 1][j]) / (2 * spacingM);
      const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      const aspect = (((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI) % 360 + 360) % 360;
      const fxx = (z[i][j + 1] + z[i][j - 1] - 2 * e) / s2;
      const fyy = (z[i + 1][j] + z[i - 1][j] - 2 * e) / s2;
      const fxy =
        (z[i + 1][j + 1] - z[i + 1][j - 1] - z[i - 1][j + 1] + z[i - 1][j - 1]) / (4 * s2);
      const cell: Cell = {
        i, j, lat: cellLat(i), lng: cellLng(j), e, slope, aspect,
        fxx, fyy, fxy, lap: fxx + fyy,
      };
      cells.push(cell);
      if (!summit || e > summit.e) summit = cell;
    }
  }
  if (cells.length === 0 || !summit) return null;

  const sorted = [...cells].map((c) => c.e).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const upperThird = sorted[Math.floor(sorted.length * 0.66)];
  const isSouth = (a: number) => a >= SOUTH_MIN && a <= SOUTH_MAX;

  // Absolute curvature floor (not a top-N%), so flat ground yields no saddles.
  const saddles = cells
    .filter((c) => c.e >= median)
    .map((c) => ({ c, score: saddleStrength(c.fxx, c.fyy, c.fxy) }))
    .filter((s) => s.score >= SADDLE_MIN_CURV)
    .sort((a, b) => b.score - a.score);

  const beds = cells
    .filter(
      (c) =>
        isSouth(c.aspect) && c.slope >= 12 &&
        c.e >= median - 8 && c.e <= upperThird + 5,
    )
    .map((c) => ({ c, score: c.slope + (c.lap < 0 ? 8 : 0) }))
    .sort((a, b) => b.score - a.score);

  const spurs = cells
    .filter((c) => c.fxx < -SPUR_CURV && c.fyy < -SPUR_CURV && c.slope >= 8 && c.e < summit.e - 2)
    .map((c) => ({ c, score: -c.lap / PER_REF + c.slope * 0.2 }))
    .sort((a, b) => b.score - a.score);

  const draws = cells
    .filter((c) => c.lap > DRAW_LAP && c.e <= median)
    .map((c) => ({ c, score: c.lap / PER_REF + (median - c.e) * 0.05 }))
    .sort((a, b) => b.score - a.score);

  // Bench travel: gentle ground sitting in an otherwise-steep neighbourhood, in
  // the lower/mid elevation band — the sidehill shelves deer travel along
  // parallel to the ridge (Penn State: bed high, travel low). Index the cells
  // so we can read the surrounding slope.
  const cellAt = new Map<string, Cell>();
  for (const c of cells) cellAt.set(`${c.i},${c.j}`, c);
  const nbhdSlope = (c: Cell): number => {
    let sum = 0;
    let n = 0;
    for (let di = -2; di <= 2; di += 1)
      for (let dj = -2; dj <= 2; dj += 1) {
        const o = cellAt.get(`${c.i + di},${c.j + dj}`);
        if (o) { sum += o.slope; n += 1; }
      }
    return n ? sum / n : c.slope;
  };
  const elevCut = sorted[Math.floor(sorted.length * 0.72)];
  const benches = cells
    .filter(
      (c) =>
        c.slope <= 12 && c.e <= elevCut && Math.abs(c.lap) < BENCH_MAX_LAP &&
        nbhdSlope(c) >= 15,
    )
    .map((c) => ({ c, score: nbhdSlope(c) - c.slope }))
    .sort((a, b) => b.score - a.score);

  const features: TerrainMovementFeature[] = [];
  const used: Cell[] = [];
  const farEnough = (c: Cell) =>
    used.every((u) => Math.hypot(u.i - c.i, u.j - c.j) >= 1.4);

  const box = (c: Cell): LatLng[] => [
    [round(c.lat + dLat * 0.9), round(c.lng - dLng * 0.9)],
    [round(c.lat + dLat * 0.9), round(c.lng + dLng * 0.9)],
    [round(c.lat - dLat * 0.9), round(c.lng + dLng * 0.9)],
    [round(c.lat - dLat * 0.9), round(c.lng - dLng * 0.9)],
  ];

  // A line down the fall line at a draw (following the aspect / downhill bearing).
  const fallLine = (c: Cell): LatLng[] => {
    const rad = (c.aspect * Math.PI) / 180;
    const nUp = 1.6;
    return [
      [round(c.lat - Math.cos(rad) * dLat * nUp), round(c.lng - Math.sin(rad) * dLng * nUp)],
      [round(c.lat), round(c.lng)],
      [round(c.lat + Math.cos(rad) * dLat * nUp), round(c.lng + Math.sin(rad) * dLng * nUp)],
    ];
  };

  // A bench trail runs ALONG the contour — perpendicular to the fall line.
  const contourLine = (c: Cell): LatLng[] => {
    const rad = ((c.aspect + 90) * Math.PI) / 180;
    const nn = 2.0;
    return [
      [round(c.lat - Math.cos(rad) * dLat * nn), round(c.lng - Math.sin(rad) * dLng * nn)],
      [round(c.lat), round(c.lng)],
      [round(c.lat + Math.cos(rad) * dLat * nn), round(c.lng + Math.sin(rad) * dLng * nn)],
    ];
  };

  const kindCount = (k: string) => features.filter((f) => f.kind === k).length;

  // Bedding: south-facing benches first, then spur noses. Caps are generous so
  // the whole network shows, not just a few spots (Penn State: deer use many
  // beds across a hillside, not one).
  const bedCandidates = [...beds.map((b) => b.c), ...spurs.map((s) => s.c)];
  for (const c of bedCandidates) {
    if (kindCount("bedding") >= 16) break;
    if (!farEnough(c)) continue;
    used.push(c);
    const south = isSouth(c.aspect);
    features.push({
      id: `t-bed-${c.i}-${c.j}`,
      kind: "bedding",
      title: south ? `South-face beds (${Math.round(c.e * M_TO_FT)} ft)` : "Spur-point beds",
      detail: south
        ? `A ${compass(c.aspect)}-facing bench near ${Math.round(c.e * M_TO_FT)} ft, ~${Math.round(c.slope)}° — the warm, sunny side deer favor for thermal gain, with an open slope below for early warning.`
        : `A spur nose off the high ground (~${Math.round(c.e * M_TO_FT)} ft) — bucks bed here to watch two draws and read swirling thermals.`,
      windNote: bedWindNote(deerBedWind(c.aspect)),
      polygon: box(c),
    });
  }

  // Saddle crossings (every gap deer would use to cross the ridge).
  for (const { c } of saddles) {
    if (kindCount("pinch") >= 14) break;
    if (!farEnough(c)) continue;
    used.push(c);
    features.push({
      id: `t-pinch-${c.i}-${c.j}`,
      kind: "pinch",
      title: `Saddle crossing (${Math.round(c.e * M_TO_FT)} ft)`,
      detail: `A low gap on the ridge near ${Math.round(c.e * M_TO_FT)} ft — deer cross ridges at their saddles, funneling travel between bedding areas. Prime stand terrain.`,
      windNote: "Sit the downhill side on a crosswind.",
      point: [round(c.lat), round(c.lng)],
    });
  }

  // Travel network: bench contour trails first, then draws. This is the web
  // deer actually walk, so draw the whole thing rather than a token few.
  for (const { c } of benches) {
    if (kindCount("travel") >= 14) break;
    if (!farEnough(c)) continue;
    used.push(c);
    features.push({
      id: `t-bench-${c.i}-${c.j}`,
      kind: "travel",
      title: `Bench trail (${Math.round(c.e * M_TO_FT)} ft)`,
      detail: `A near-level shelf on a steep hillside — deer sidehill along benches like this at a constant elevation to save energy, traveling the lower slopes parallel to the ridge rather than climbing over the top.`,
      windNote: BENCH_WIND_NOTE,
      line: contourLine(c),
    });
  }
  for (const { c } of draws) {
    if (kindCount("travel") >= 28) break;
    if (!farEnough(c)) continue;
    used.push(c);
    features.push({
      id: `t-draw-${c.i}-${c.j}`,
      kind: "travel",
      title: "Draw travel corridor",
      detail: `A drainage dropping toward the low ground — a natural bed-to-feed travel line and a quiet, low-scent way in.`,
      windNote: DRAW_WIND_NOTE,
      line: fallLine(c),
    });
  }

  // Refuge (up to 4): the steepest blocks.
  // Cells are all finite now, but sort NaN-safe anyway (NaN sinks to the end).
  const bySlope = [...cells].sort((a, b) => finiteOr(b.slope) - finiteOr(a.slope));
  for (const c of bySlope) {
    if (kindCount("refuge") >= 4) break;
    if (!Number.isFinite(c.slope) || c.slope < 18 || !farEnough(c)) continue;
    used.push(c);
    features.push({
      id: `t-refuge-${c.i}-${c.j}`,
      kind: "refuge",
      title: "Steep sanctuary",
      detail: `Steep, hard-to-reach ground (~${Math.round(c.slope)}°) — the cover deer ride out pressure in. Hunt its upper edge and the saddles leading out, don't push it.`,
      polygon: box(c),
    });
  }

  if (features.length === 0) return null;

  return { areaName, center: summit ? [round(summit.lat), round(summit.lng)] : center, source, features };
}

function neighbourhoodFinite(z: number[][], i: number, j: number): boolean {
  for (let di = -1; di <= 1; di += 1) {
    for (let dj = -1; dj <= 1; dj += 1) {
      if (!Number.isFinite(z[i + di]?.[j + dj])) return false;
    }
  }
  return true;
}

function finiteOr(value: number, fallback = -Infinity): number {
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
