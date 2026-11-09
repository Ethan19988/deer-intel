import { NextResponse } from "next/server";
import { throttleByIp } from "@/lib/apiGuard";
import {
  NLCD_LABEL,
  classifyLandcoverImage,
  gridCellCenter,
  gridPlanKey,
  nlcdGetMapUrl,
  parseMovementGridQuery,
  planMovementGrid,
  type GridPlan,
} from "@/lib/landcover";
import type { MovementGrid } from "@/lib/movementGridTypes";
import { decodePng } from "@/lib/pngDecode";

// Elevation + land cover per ~40 m cell over a property, for the terrain-aware
// deer route model (lib/deerRoutes). Elevation follows /api/terrain: USGS 10 m
// (NED via OpenTopoData) for the whole grid, Open-Meteo ~90 m if that fails.
// Land cover is USGS NLCD rendered by the MRLC GeoServer WMS at one pixel per
// cell and snapped back to class codes; if that fails the grid still ships,
// without `landcover`.
//
// Responses: { grid: MovementGrid }. NaN elevations serialize as null — the
// client (lib/movementGridClient) turns them back into NaN.

export const runtime = "nodejs"; // node:zlib for the PNG decode
export const maxDuration = 60; // up to 16 paced elevation calls on a cold read

const CHUNK = 100; // elevation APIs cap at 100 coordinates per request
const ELEVATION_DEADLINE_MS = 30_000;
const WMS_TIMEOUT_MS = 15_000;
/** Below this share of classified cells, treat land cover as unavailable. */
const MIN_LANDCOVER_COVERAGE = 0.5;

// Ground doesn't change: complete reads are kept per process (bounded). Reads
// that came back without land cover expire quickly so a brief MRLC outage
// isn't baked in.
type CacheEntry = { grid: MovementGrid; expires: number };
const cache = new Map<string, CacheEntry>();
const MAX_CACHED_READS = 300;
const PARTIAL_TTL_MS = 10 * 60_000;

export async function GET(request: Request) {
  const query = parseMovementGridQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return NextResponse.json({ error: query.error }, { status: 400 });
  }

  const plan = planMovementGrid(query.center, query.bbox);
  const key = gridPlanKey(plan);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return json(hit.grid);
  if (hit) cache.delete(key);

  // Each uncached read makes many calls to free elevation/WMS services.
  const limited = throttleByIp(request, "movement-grid", 10, 60_000);
  if (limited) return limited;

  const [elevation, landcover] = await Promise.all([
    fetchElevations(cellCenters(plan)),
    fetchLandcover(plan).catch(() => null),
  ]);

  if (!elevation) {
    return NextResponse.json(
      { error: "Elevation data is unavailable right now." },
      { status: 502 },
    );
  }

  const sourceParts = [
    `${elevation.resolution} elevation`,
    landcover ? `${NLCD_LABEL} land cover (MRLC)` : "land cover unavailable",
    `${plan.cellM} m cells`,
  ];
  const grid: MovementGrid = {
    origin: plan.origin,
    cellM: plan.cellM,
    cellLat: plan.cellLat,
    cellLng: plan.cellLng,
    rows: plan.rows,
    cols: plan.cols,
    elevation: elevation.elev,
    ...(landcover ? { landcover } : {}),
    source: sourceParts.join(" · "),
  };

  if (cache.size >= MAX_CACHED_READS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {
    grid,
    expires: landcover ? Number.POSITIVE_INFINITY : Date.now() + PARTIAL_TTL_MS,
  });
  return json(grid);
}

function json(grid: MovementGrid) {
  const cacheControl = grid.landcover
    ? "public, max-age=86400, s-maxage=604800"
    : "public, max-age=600, s-maxage=600";
  return NextResponse.json({ grid }, { headers: { "Cache-Control": cacheControl } });
}

/** Cell centers, row-major, row 0 = south — the MovementGrid order. */
function cellCenters(plan: GridPlan): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let r = 0; r < plan.rows; r += 1) {
    for (let c = 0; c < plan.cols; c += 1) {
      const p = gridCellCenter(plan, r, c);
      points.push([p.lat, p.lng]);
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// Land cover (MRLC WMS → PNG → NLCD codes)
// ---------------------------------------------------------------------------

async function fetchLandcover(plan: GridPlan): Promise<number[] | null> {
  const res = await fetch(nlcdGetMapUrl(plan.bbox, plan.cols, plan.rows), {
    headers: { Accept: "image/png" },
    signal: AbortSignal.timeout(WMS_TIMEOUT_MS),
  });
  // GeoServer reports errors as 200 + XML, so check the type too.
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/png")) {
    return null;
  }
  const image = decodePng(new Uint8Array(await res.arrayBuffer()));
  if (image.width !== plan.cols || image.height !== plan.rows) return null;
  const classes = classifyLandcoverImage(image);
  const known = classes.filter((c) => c !== 0).length;
  // Outside CONUS (or a blank render) comes back transparent — not a read.
  return known >= classes.length * MIN_LANDCOVER_COVERAGE ? classes : null;
}

// ---------------------------------------------------------------------------
// Elevation — same sources and fallback rule as app/api/terrain/route.ts
// (copied rather than shared so that route stays untouched).
// ---------------------------------------------------------------------------

type ElevationResult = { elev: number[]; resolution: string };

async function fetchElevations(points: Array<[number, number]>): Promise<ElevationResult | null> {
  const deadline = Date.now() + ELEVATION_DEADLINE_MS;
  // Never mix resolutions within one read: any USGS chunk failing → all Open-Meteo.
  return (
    (await fetchChunked(points, (c) => fromOpenTopoDataChunk(c, deadline), "USGS 10 m")) ??
    (await fetchChunked(points, fromOpenMeteoChunk, "Open-Meteo 90 m"))
  );
}

async function fetchChunked(
  points: Array<[number, number]>,
  provider: (chunk: Array<[number, number]>) => Promise<number[] | null>,
  resolution: string,
): Promise<ElevationResult | null> {
  const elev: number[] = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const part = await provider(points.slice(i, i + CHUNK));
    if (!part || part.length !== Math.min(CHUNK, points.length - i)) return null;
    elev.push(...part);
  }
  if (elev.filter((v) => Number.isFinite(v)).length < points.length * 0.8) return null;
  return { elev, resolution };
}

// OpenTopoData's public API allows ~1 call/s. A full 40×40 grid is 16 calls,
// so on a 429 wait a beat and retry once; give up (→ Open-Meteo) past the
// deadline rather than hold the request open.
async function fromOpenTopoDataChunk(
  points: Array<[number, number]>,
  deadline: number,
): Promise<number[] | null> {
  const locs = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join("|");
  const url = `https://api.opentopodata.org/v1/ned10m?locations=${locs}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (Date.now() > deadline) return null;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1_100));
        continue;
      }
      if (!res.ok) return null;
      const body = (await res.json()) as {
        status?: string;
        results?: Array<{ elevation: number | null }>;
      };
      if (body.status !== "OK" || !body.results) return null;
      return body.results.map((r) => (typeof r.elevation === "number" ? r.elevation : NaN));
    } catch {
      return null;
    }
  }
  return null;
}

async function fromOpenMeteoChunk(points: Array<[number, number]>): Promise<number[] | null> {
  try {
    const lats = points.map((p) => p[0].toFixed(5)).join(",");
    const lngs = points.map((p) => p[1].toFixed(5)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { elevation?: number[] };
    if (!Array.isArray(body.elevation) || body.elevation.length !== points.length) return null;
    return body.elevation.map((v) => (typeof v === "number" ? v : NaN));
  } catch {
    return null;
  }
}
