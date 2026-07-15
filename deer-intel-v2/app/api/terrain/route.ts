import { NextResponse } from "next/server";
import { analyzeTerrain, type ElevationGrid } from "@/lib/terrainAnalysis";
import type { TerrainMovementSet } from "@/lib/terrainMovement";

// Live per-property terrain read. Given a coordinate, samples a grid of real
// elevation, runs the ridge/saddle/bench/draw analysis, and returns a
// TerrainMovementSet the map + Scout Picks + AI Scout render. USGS 10 m (NED)
// is preferred; Open-Meteo (~90 m, global) is the fallback so it still works
// outside the US or if NED is briefly down. The 1 m LiDAR pipeline supersedes
// this when a generated set exists for the property.

const GRID_N = 10; // GRID_N x GRID_N samples (100 = one request per source)
const SPACING_M = 70;

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

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) {
    return json(cache.get(key) ?? null);
  }

  const points = buildGridPoints(lat, lng);
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
    center: [lat, lng],
    rows: GRID_N,
    cols: GRID_N,
    spacingM: SPACING_M,
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

function json(set: TerrainMovementSet | null) {
  return NextResponse.json(
    { set },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}

function buildGridPoints(lat: number, lng: number): Array<[number, number]> {
  const dLat = SPACING_M / 111_000;
  const dLng = SPACING_M / (111_000 * Math.cos((lat * Math.PI) / 180));
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

async function fetchElevations(
  points: Array<[number, number]>,
): Promise<FetchResult | null> {
  return (await fromOpenTopoData(points)) ?? (await fromOpenMeteo(points));
}

async function fromOpenTopoData(
  points: Array<[number, number]>,
): Promise<FetchResult | null> {
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
    const elev = body.results.map((r) => (typeof r.elevation === "number" ? r.elevation : NaN));
    if (elev.filter((v) => Number.isFinite(v)).length < points.length * 0.8) return null;
    return { elev, resolution: "10 m" };
  } catch {
    return null;
  }
}

async function fromOpenMeteo(
  points: Array<[number, number]>,
): Promise<FetchResult | null> {
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
    return { elev: body.elevation, resolution: "90 m" };
  } catch {
    return null;
  }
}
