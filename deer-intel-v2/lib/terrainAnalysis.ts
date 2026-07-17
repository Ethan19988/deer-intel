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

/** Best wind to hunt ground that faces `aspect`: wind from the opposite side
 * carries scent up and over, away from bedded/approaching deer. */
function reciprocalWind(aspect: number): string {
  return compass(aspect + 180);
}

type Cell = {
  i: number;
  j: number;
  lat: number;
  lng: number;
  e: number;
  slope: number;
  aspect: number;
  curvEW: number;
  curvNS: number;
  lap: number;
};

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
      const dzdx = (z[i][j + 1] - z[i][j - 1]) / (2 * spacingM);
      const dzdy = (z[i + 1][j] - z[i - 1][j]) / (2 * spacingM);
      const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      const aspect = (((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI) % 360 + 360) % 360;
      const curvEW = z[i][j + 1] + z[i][j - 1] - 2 * e;
      const curvNS = z[i + 1][j] + z[i - 1][j] - 2 * e;
      const cell: Cell = {
        i, j, lat: cellLat(i), lng: cellLng(j), e, slope, aspect,
        curvEW, curvNS, lap: curvEW + curvNS,
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

  const saddles = cells
    .filter(
      (c) =>
        c.curvEW * c.curvNS < 0 &&
        Math.min(Math.abs(c.curvEW), Math.abs(c.curvNS)) > 0.6 &&
        c.e >= median,
    )
    .map((c) => ({ c, score: Math.min(Math.abs(c.curvEW), Math.abs(c.curvNS)) }))
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
    .filter((c) => c.curvEW < -0.4 && c.curvNS < -0.4 && c.slope >= 8 && c.e < summit.e - 2)
    .map((c) => ({ c, score: -(c.curvEW + c.curvNS) + c.slope * 0.2 }))
    .sort((a, b) => b.score - a.score);

  const draws = cells
    .filter((c) => c.lap > 1.0 && c.e <= median)
    .map((c) => ({ c, score: c.lap + (median - c.e) * 0.05 }))
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
        c.slope <= 12 && c.e <= elevCut && Math.abs(c.lap) < 2.5 &&
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
      windNote: `Beds hold a ${reciprocalWind(c.aspect)} wind. Approach from the high side above them.`,
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
      windNote: "Deer walk it into the wind; sit the downwind end, above or below the trail.",
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
      windNote: "Morning thermals fall downhill — hunt the lower end at first light.",
      line: fallLine(c),
    });
  }

  // Refuge (up to 4): the steepest blocks.
  for (const c of [...cells].sort((a, b) => b.slope - a.slope)) {
    if (kindCount("refuge") >= 4) break;
    if (c.slope < 18 || !farEnough(c)) continue;
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

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
