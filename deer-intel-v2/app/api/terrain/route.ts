import { NextResponse } from "next/server";
import { analyzeTerrain, type ElevationGrid } from "@/lib/terrainAnalysis";
import type { TerrainMovementSet } from "@/lib/terrainMovement";

// Live per-property terrain read. Given a coordinate, samples a grid of real
// elevation, runs the ridge/saddle/bench/draw analysis, and returns a
// TerrainMovementSet the map + Scout Picks + AI Scout render. USGS 10 m (NED)
// is preferred; Open-Meteo (~90 m, global) is the fallback so it still works
// outside the US or if NED is briefly down. The 1 m LiDAR pipeline supersedes
// this when a generated set exists for the property.

const GRID_N = 20; // GRID_N x GRID_N samples; chunked into <=100-point requests
const SPACING_M = 70;
const CHUNK = 100; // elevation APIs cap at 100 coordinates per request

// Terrain doesn't change, so cache each property's read hard (per process).
const cache = new Map<string, TerrainMovementSet | null>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const areaName = (searchParams.get("name") || "This property").slice(0, 60);

  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinate." }, { status: 400 });
  }

  // If the property has a drawn hunt area, its bounding box sizes the read so
  // the whole outline is analyzed — not just a fixed square around the center.
  const bbox = parseBbox(searchParams);
  const geom = resolveGrid(lat, lng, bbox);

  const key = bbox
    ? `${geom.centerLat.toFixed(4)},${geom.centerLng.toFixed(4)}@${Math.round(geom.spacingM)}`
    : `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) {
    return json(cache.get(key) ?? null);
  }

  const points = buildGridPoints(geom.centerLat, geom.centerLng, geom.spacingM);
  const fetched = await fetchElevations(points);

  if (!fetched) {
    return NextResponse.json(
      { error: "Elevation data is unavailable right now." },
      { status: 502 },
    );
  }

  const z: number[][] = [];
  for (let i = 0; i < GRID_N; i += 1) {
    z.push(fetched.elev.slice(i * GRID_N, i * GRID_N + GRID_N));
  }

  const grid: ElevationGrid = {
    center: [geom.centerLat, geom.centerLng],
    rows: GRID_N,
    cols: GRID_N,
    spacingM: geom.spacingM,
    z,
  };

  const set = analyzeTerrain(
    grid,
    areaName,
    `Live ${fetched.resolution} terrain read · Penn State rules`,
  );

  cache.set(key, set);
  return json(set);
}

type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

function parseBbox(searchParams: URLSearchParams): Bbox | null {
  const minLat = Number(searchParams.get("minLat"));
  const minLng = Number(searchParams.get("minLng"));
  const maxLat = Number(searchParams.get("maxLat"));
  const maxLng = Number(searchParams.get("maxLng"));
  if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return null;
  if (maxLat <= minLat || maxLng <= minLng) return null;
  return { minLat, minLng, maxLat, maxLng };
}

// A square sampling window: default fixed size around the point, or big enough
// to enclose the hunt-area bbox (with a little margin). Kept square because the
// analysis assumes uniform cell spacing.
function resolveGrid(lat: number, lng: number, bbox: Bbox | null) {
  if (!bbox) {
    return { centerLat: lat, centerLng: lng, spacingM: SPACING_M };
  }
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  const heightM = (bbox.maxLat - bbox.minLat) * 111_000;
  const widthM =
    (bbox.maxLng - bbox.minLng) * 111_000 * Math.cos((centerLat * Math.PI) / 180);
  const sideM = Math.max(heightM, widthM) * 1.15;
  // Floor the spacing so a tiny outline can't collapse below the data grain.
  const spacingM = Math.max(sideM / (GRID_N - 1), 30);
  return { centerLat, centerLng, spacingM };
}

function json(set: TerrainMovementSet | null) {
  return NextResponse.json(
    { set },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}

function buildGridPoints(
  lat: number,
  lng: number,
  spacingM: number,
): Array<[number, number]> {
  const dLat = spacingM / 111_000;
  const dLng = spacingM / (111_000 * Math.cos((lat * Math.PI) / 180));
  const points: Array<[number, number]> = [];
  for (let i = 0; i < GRID_N; i += 1) {
    for (let j = 0; j < GRID_N; j += 1) {
      points.push([
        lat + (i - (GRID_N - 1) / 2) * dLat,
        lng + (j - (GRID_N - 1) / 2) * dLng,
      ]);
    }
  }
  return points;
}

type FetchResult = { elev: number[]; resolution: string };

// Grids now exceed the 100-coordinate API cap, so fetch in chunks. Try USGS 10 m
// for the whole grid; if any chunk fails, fall back to Open-Meteo 90 m for the
// whole grid (never mix resolutions within one read).
async function fetchElevations(
  points: Array<[number, number]>,
): Promise<FetchResult | null> {
  return (
    (await fetchChunked(points, fromOpenTopoDataChunk, "10 m")) ??
    (await fetchChunked(points, fromOpenMeteoChunk, "90 m"))
  );
}

async function fetchChunked(
  points: Array<[number, number]>,
  provider: (chunk: Array<[number, number]>) => Promise<number[] | null>,
  resolution: string,
): Promise<FetchResult | null> {
  const elev: number[] = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const part = await provider(points.slice(i, i + CHUNK));
    if (!part) return null;
    elev.push(...part);
  }
  if (elev.filter((v) => Number.isFinite(v)).length < points.length * 0.8) return null;
  return { elev, resolution };
}

async function fromOpenTopoDataChunk(
  points: Array<[number, number]>,
): Promise<number[] | null> {
  try {
    const locs = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join("|");
    const url = `https://api.opentopodata.org/v1/ned10m?locations=${locs}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
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

async function fromOpenMeteoChunk(
  points: Array<[number, number]>,
): Promise<number[] | null> {
  try {
    const lats = points.map((p) => p[0].toFixed(5)).join(",");
    const lngs = points.map((p) => p[1].toFixed(5)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { elevation?: number[] };
    if (!Array.isArray(body.elevation) || body.elevation.length !== points.length) {
      return null;
    }
    return body.elevation;
  } catch {
    return null;
  }
}
