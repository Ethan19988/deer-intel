import type { MovementGrid } from "@/lib/movementGridTypes";

// The walking-cost surface behind lib/deerRoutes: what it "costs" a deer to
// step from one grid cell to the next, plus the least-cost (Dijkstra) search
// over it. Pure and synchronous — grids are at most ~40×40, so one search is a
// few thousand heap operations.
//
// The weights encode the same Penn State Deer-Forest Study rules the terrain
// layer uses ("bed high, travel low"): deer skirt steep pitches, ride benches
// along a sidehill, cross ridges at saddles, follow draws, keep to cover and
// cross open ground only for the last few steps into a field. Every weight is a
// named constant so it can be tuned against camera evidence later.

// ---- Slope -----------------------------------------------------------------

/** Above this a slope is "steep": deer angle across it or go around. */
export const STEEP_SLOPE_DEG = 25;
/** Above this a slope is "very steep": a deer only climbs it when pushed. */
export const VERY_STEEP_SLOPE_DEG = 35;
/** Gentle ground costs 1 + slope / this (25° → 1.5×). */
export const GENTLE_SLOPE_DIVISOR = 50;
export const STEEP_SLOPE_MULT = 2.5;
export const VERY_STEEP_SLOPE_MULT = 6;
/** Extra metres-of-walking per metre climbed (Naismith-style: ~8 m flat per m up). */
export const CLIMB_COST_PER_M = 8;
/** Extra metres-of-walking per metre descended (braking downhill is cheap). */
export const DESCENT_COST_PER_M = 2;

// ---- Terrain bonuses (multipliers < 1 make a cell cheaper) -----------------

/** Low point on a ridge crest: the easy way over. */
export const SADDLE_MULT = 0.6;
/** Flat shelf on a sidehill: the deer highway along a slope. */
export const BENCH_MULT = 0.7;
/** Drainage bottom: carries travel up and down the hill. */
export const DRAW_MULT = 0.8;

/** A bench is flatter than this… */
export const BENCH_MAX_SLOPE_DEG = 12;
/** …inside a neighbourhood (radius 2 cells) at least this steep on average… */
export const BENCH_NBHD_SLOPE_DEG = 15;
/** …with ground rising AND falling by this × cell size within 2 cells. */
export const BENCH_MIN_RELIEF_RATIO = 0.3;
/** A saddle is this much lower than the crest either side and higher than the slopes off it. */
export const SADDLE_MIN_RELIEF_M = 1.5;
/** A draw is this much lower than the ground across it. */
export const DRAW_MIN_DEPTH_M = 1.5;

// ---- Land cover (NLCD classes) ---------------------------------------------

/** Classes deer treat as security cover. */
export const COVER_CLASSES: ReadonlySet<number> = new Set([41, 42, 43, 52, 90]);
/** Open classes that are food (grassland, hay/pasture, crops). */
export const OPEN_FOOD_CLASSES: ReadonlySet<number> = new Set([71, 81, 82]);
/** Shrub/scrub — cut-over regen: thick bedding cover and browse at once. */
export const REGEN_CLASS = 52;
export const WATER_CLASS = 11;

/** Open ground deer avoid in daylight; only the last few cells into a food source are waived. */
export const OPEN_FIELD_MULT = 5;
/** Cells this close (in cells) to a food/water destination aren't charged as open ground. */
export const FOOD_APPROACH_CELLS = 2;

/** Walking-cost multiplier per NLCD class; Infinity = impassable. */
export const LANDCOVER_MULT: Readonly<Record<number, number>> = {
  [WATER_CLASS]: Infinity, // open water
  21: 4, // developed, open space (lawns, road shoulders)
  22: 15, // developed, low intensity
  23: 25, // developed, medium
  24: 25, // developed, high
  31: 3, // barren rock / strip mine
  41: 1, // deciduous forest
  42: 1, // evergreen forest
  43: 1, // mixed forest
  52: 0.85, // shrub/scrub — the cheapest, thickest cover
  71: OPEN_FIELD_MULT,
  81: OPEN_FIELD_MULT,
  82: OPEN_FIELD_MULT,
  90: 1.15, // woody wetland
  95: 2, // herbaceous wetland (cattail, open marsh)
};
/** Class 0 / an unlisted class. */
export const UNKNOWN_LANDCOVER_MULT = 1.2;

// ---- Cell flags ------------------------------------------------------------

export const FLAG_BENCH = 1;
export const FLAG_DRAW = 2;
export const FLAG_SADDLE = 4;
/** Open food cell touching cover, or cover touching open food. */
export const FLAG_FIELD_EDGE = 8;
/** Cover touching other non-cover ground (marsh, barren, developed, water). */
export const FLAG_COVER_EDGE = 16;

export type CostSurface = {
  grid: MovementGrid;
  rows: number;
  cols: number;
  hasLandcover: boolean;
  /** Slope in degrees per cell (0 where it can't be computed). */
  slopeDeg: Float64Array;
  flags: Uint8Array;
  /** Land-cover multiplier per cell (Infinity = impassable). */
  landMult: Float64Array;
  /** Terrain bonus multiplier per cell (1 = none). */
  terrainMult: Float64Array;
};

const SQRT2 = Math.SQRT2;
const DEG = 180 / Math.PI;

/** The 8 neighbour offsets as [dRow, dCol]. */
export const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export function landClassAt(grid: MovementGrid, index: number): number {
  return grid.landcover ? grid.landcover[index] ?? 0 : 0;
}

export function isOpenFood(code: number): boolean {
  return OPEN_FOOD_CLASSES.has(code);
}

export function isCover(code: number): boolean {
  return COVER_CLASSES.has(code);
}

/** Multiplier for walking on ground of the given steepness. */
export function slopeMultiplier(deg: number): number {
  if (deg > VERY_STEEP_SLOPE_DEG) return VERY_STEEP_SLOPE_MULT;
  if (deg > STEEP_SLOPE_DEG) return STEEP_SLOPE_MULT;
  return 1 + deg / GENTLE_SLOPE_DIVISOR;
}

function landMultiplier(code: number): number {
  const mult = LANDCOVER_MULT[code];
  return mult === undefined ? UNKNOWN_LANDCOVER_MULT : mult;
}

/** Elevation at (r, c), NaN outside the grid or where unknown. */
function elevAt(grid: MovementGrid, r: number, c: number): number {
  if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) return NaN;
  const value = grid.elevation[r * grid.cols + c];
  return typeof value === "number" ? value : NaN;
}

/** Elevation change per metre along one axis, one-sided at edges/gaps. */
function gradient(
  grid: MovementGrid,
  r: number,
  c: number,
  dr: number,
  dc: number,
): number {
  const e = elevAt(grid, r, c);
  const plus = elevAt(grid, r + dr, c + dc);
  const minus = elevAt(grid, r - dr, c - dc);
  const run = grid.cellM;
  if (Number.isFinite(plus) && Number.isFinite(minus)) return (plus - minus) / (2 * run);
  if (Number.isFinite(plus)) return (plus - e) / run;
  if (Number.isFinite(minus)) return (e - minus) / run;
  return 0;
}

// Axis pairs used for saddle/draw tests: E–W, N–S and the two diagonals, each
// with the axis perpendicular to it.
const AXES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];
const PERPENDICULAR = [1, 0, 3, 2];

/** Saddle / draw flags from the shape of the ground across the cell. */
function curvatureFlags(grid: MovementGrid, r: number, c: number): number {
  const e = elevAt(grid, r, c);
  let flags = 0;

  // Check at 1 and 2 cells so broad landforms register as well as tight ones.
  for (const k of [1, 2]) {
    const higher: number[] = [];
    const lower: number[] = [];
    for (const [dr, dc] of AXES) {
      const plus = elevAt(grid, r + dr * k, c + dc * k);
      const minus = elevAt(grid, r - dr * k, c - dc * k);
      if (!Number.isFinite(plus) || !Number.isFinite(minus)) {
        higher.push(-Infinity);
        lower.push(-Infinity);
        continue;
      }
      higher.push(Math.min(plus, minus) - e); // > 0: ground rises both ways
      lower.push(e - Math.max(plus, minus)); // > 0: ground falls both ways
    }

    for (let axis = 0; axis < AXES.length; axis += 1) {
      if (
        higher[axis] >= SADDLE_MIN_RELIEF_M &&
        lower[PERPENDICULAR[axis]] >= SADDLE_MIN_RELIEF_M
      ) {
        flags |= FLAG_SADDLE;
      }
    }

    const pit = higher.every((h) => h > 0);
    if (!pit && !(flags & FLAG_SADDLE) && higher.some((h) => h >= DRAW_MIN_DEPTH_M)) {
      flags |= FLAG_DRAW;
    }
  }

  // A saddle is also concave across, so it would read as a draw too; keep the stronger name.
  if (flags & FLAG_SADDLE) flags &= ~FLAG_DRAW;
  return flags;
}

function isBench(grid: MovementGrid, slopeDeg: Float64Array, r: number, c: number): boolean {
  const index = r * grid.cols + c;
  if (slopeDeg[index] > BENCH_MAX_SLOPE_DEG) return false;

  const e = elevAt(grid, r, c);
  let up = 0;
  let down = 0;
  let slopeSum = 0;
  let count = 0;
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const other = elevAt(grid, r + dr, c + dc);
      if (!Number.isFinite(other)) continue;
      up = Math.max(up, other - e);
      down = Math.max(down, e - other);
      slopeSum += slopeDeg[(r + dr) * grid.cols + (c + dc)];
      count += 1;
    }
  }

  const relief = BENCH_MIN_RELIEF_RATIO * grid.cellM;
  return count > 0 && up >= relief && down >= relief && slopeSum / count >= BENCH_NBHD_SLOPE_DEG;
}

/** Slope, landform flags and land-cover / terrain multipliers for every cell. */
export function buildCostSurface(grid: MovementGrid): CostSurface {
  const { rows, cols } = grid;
  const size = rows * cols;
  const hasLandcover = Array.isArray(grid.landcover) && grid.landcover.length === size;
  const slopeDeg = new Float64Array(size);
  const flags = new Uint8Array(size);
  const landMult = new Float64Array(size);
  const terrainMult = new Float64Array(size).fill(1);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c;
      if (!Number.isFinite(elevAt(grid, r, c))) continue;
      const gx = gradient(grid, r, c, 0, 1);
      const gy = gradient(grid, r, c, 1, 0);
      slopeDeg[index] = Math.atan(Math.hypot(gx, gy)) * DEG;
    }
  }

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c;
      if (!Number.isFinite(elevAt(grid, r, c))) {
        landMult[index] = Infinity; // unknown ground: don't route deer through it
        continue;
      }

      let flag = curvatureFlags(grid, r, c);
      if (!(flag & FLAG_SADDLE) && isBench(grid, slopeDeg, r, c)) flag |= FLAG_BENCH;

      const code = hasLandcover ? landClassAt(grid, index) : 0;
      landMult[index] = hasLandcover ? landMultiplier(code) : 1;

      if (hasLandcover && (isCover(code) || isOpenFood(code))) {
        for (const [dr, dc] of NEIGHBORS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const other = landClassAt(grid, nr * cols + nc);
          if (isCover(code) && isOpenFood(other)) flag |= FLAG_FIELD_EDGE;
          else if (isOpenFood(code) && isCover(other)) flag |= FLAG_FIELD_EDGE;
          else if (isCover(code) && other !== 0 && !isCover(other) && !isOpenFood(other)) {
            flag |= FLAG_COVER_EDGE;
          }
        }
      }

      flags[index] = flag;
      // The strongest single landform bonus applies (they don't stack).
      terrainMult[index] = flag & FLAG_SADDLE
        ? SADDLE_MULT
        : flag & FLAG_BENCH
          ? BENCH_MULT
          : flag & FLAG_DRAW
            ? DRAW_MULT
            : 1;
    }
  }

  return { grid, rows, cols, hasLandcover, slopeDeg, flags, landMult, terrainMult };
}

/**
 * Waive the open-ground charge on open cells within FOOD_APPROACH_CELLS of a
 * destination — deer step out into a field to feed, they just don't cross it.
 */
export function waiveOpenNear(surface: CostSurface, cells: number[]): void {
  if (!surface.hasLandcover) return;
  const { rows, cols, grid } = surface;
  const reach = FOOD_APPROACH_CELLS;
  for (const cell of cells) {
    const r0 = Math.floor(cell / cols);
    const c0 = cell % cols;
    for (let r = r0 - reach; r <= r0 + reach; r += 1) {
      for (let c = c0 - reach; c <= c0 + reach; c += 1) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        if (Math.hypot(r - r0, c - c0) > reach + 0.01) continue;
        const index = r * cols + c;
        if (isOpenFood(landClassAt(grid, index)) && Number.isFinite(surface.landMult[index])) {
          surface.landMult[index] = 1;
        }
      }
    }
  }
}

export function isPassable(surface: CostSurface, index: number): boolean {
  return Number.isFinite(surface.landMult[index]);
}

/** Cost of one step from cell a to its neighbour b. */
export function stepCost(surface: CostSurface, a: number, b: number, diagonal: boolean): number {
  const { landMult, terrainMult, slopeDeg, grid } = surface;
  const multA = landMult[a] * terrainMult[a];
  const multB = landMult[b] * terrainMult[b];
  if (!Number.isFinite(multA) || !Number.isFinite(multB)) return Infinity;

  const run = grid.cellM * (diagonal ? SQRT2 : 1);
  const dz = grid.elevation[b] - grid.elevation[a];
  // The steeper of the line walked and the hillside it's walked on: a steep
  // sidehill is hard going even on the contour, which is why benches matter.
  const edgeDeg = Math.atan(Math.abs(dz) / run) * DEG;
  const steep = Math.max(edgeDeg, (slopeDeg[a] + slopeDeg[b]) / 2);

  return (
    run * slopeMultiplier(steep) * ((multA + multB) / 2) +
    CLIMB_COST_PER_M * Math.max(dz, 0) +
    DESCENT_COST_PER_M * Math.max(-dz, 0)
  );
}

/** Binary min-heap of cell indices keyed by cost (lazy deletion by the caller). */
class MinHeap {
  private cells: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, key: number): void {
    const { cells, keys } = this;
    let i = cells.length;
    cells.push(cell);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      cells[i] = cells[parent];
      keys[i] = keys[parent];
      i = parent;
    }
    cells[i] = cell;
    keys[i] = key;
  }

  pop(): { cell: number; key: number } | null {
    const { cells, keys } = this;
    if (cells.length === 0) return null;
    const top = { cell: cells[0], key: keys[0] };
    const lastCell = cells.pop() as number;
    const lastKey = keys.pop() as number;
    if (cells.length > 0) {
      let i = 0;
      const n = cells.length;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= n) break;
        const right = left + 1;
        const child = right < n && keys[right] < keys[left] ? right : left;
        if (keys[child] >= lastKey) break;
        cells[i] = cells[child];
        keys[i] = keys[child];
        i = child;
      }
      cells[i] = lastCell;
      keys[i] = lastKey;
    }
    return top;
  }
}

export type CostTree = {
  /** Least cost from the start to every cell (Infinity = unreachable). */
  cost: Float64Array;
  /** Previous cell on the cheapest walk (-1 at the start / unreachable). */
  prev: Int32Array;
};

/** Dijkstra over the 8-neighbour grid from one start cell. */
export function leastCostTree(surface: CostSurface, start: number): CostTree {
  const { rows, cols } = surface;
  const size = rows * cols;
  const cost = new Float64Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);
  const heap = new MinHeap();

  cost[start] = 0;
  heap.push(start, 0);

  while (heap.size > 0) {
    const next = heap.pop();
    if (!next) break;
    const { cell, key } = next;
    if (done[cell] || key > cost[cell]) continue;
    done[cell] = 1;

    const r = Math.floor(cell / cols);
    const c = cell % cols;
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const neighbor = nr * cols + nc;
      if (done[neighbor] || !isPassable(surface, neighbor)) continue;
      const diagonal = dr !== 0 && dc !== 0;
      // No squeezing diagonally between two impassable cells (water corners).
      if (
        diagonal &&
        (!isPassable(surface, r * cols + nc) || !isPassable(surface, nr * cols + c))
      ) {
        continue;
      }
      const step = stepCost(surface, cell, neighbor, diagonal);
      if (!Number.isFinite(step)) continue;
      const total = key + step;
      if (total < cost[neighbor]) {
        cost[neighbor] = total;
        prev[neighbor] = cell;
        heap.push(neighbor, total);
      }
    }
  }

  return { cost, prev };
}

/** Cells from start to end along the tree, or null when unreachable. */
export function treePath(tree: CostTree, start: number, end: number): number[] | null {
  if (!Number.isFinite(tree.cost[end])) return null;
  const cells: number[] = [];
  let cell = end;
  while (cell !== -1) {
    cells.push(cell);
    if (cell === start) break;
    cell = tree.prev[cell];
  }
  if (cells[cells.length - 1] !== start) return null;
  return cells.reverse();
}
