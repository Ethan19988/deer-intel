#!/usr/bin/env node
// Bake the Land Owners overlay dataset for Shippen Township, Cameron County, PA.
//
// The map's Land Owners layer (components/map/LandOwnerLayer.tsx) reads a static
// JSON file instead of hitting the parcel service live: at the zoom levels where
// owner labels are useful the county ArcGIS layer would be queried on every pan,
// and the whole township is small enough to ship as one baked file. This script
// regenerates that file.
//
// What it does:
//   1. Fetch the Shippen Township boundary polygon.
//   2. Query the Cameron County parcel FeatureServer for every parcel whose
//      geometry INTERSECTS that boundary (parcels straddling the line from
//      neighbouring municipalities are included on purpose), paging through the
//      layer's maxRecordCount.
//   3. Flatten each parcel to the compact { lat, lng, owner, acres, pin, addr,
//      pub } record the client expects, drop the owner-less rows, sort by
//      acreage descending, and write public/data/shippen-township-owners.json.
//
// Requires outbound HTTPS to the parcel + boundary services. Run it from the
// deer-intel-v2 directory:  node scripts/bake-land-owners.mjs
//
// The field names and service URL mirror the Cameron override in
// parcelProviders/pa/index.ts — keep the two in sync if the county changes its
// schema.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");

// --- What we're baking -------------------------------------------------------

const TOWNSHIP = "Shippen Township";
const COUNTY = "Cameron";
const STATE = "PA";
const SOURCE = "Cameron County Parcels (Sept 2025) via county ArcGIS";
const OUTPUT_PATH = resolve(PROJECT_ROOT, "public/data/shippen-township-owners.json");

// --- Cameron County parcel FeatureServer (mirrors parcelProviders/pa) ---------

const PARCEL_SERVICE_URL =
  "https://services5.arcgis.com/NN66N9nlzcCXJ9he/arcgis/rest/services/Parcels_(September_2025)/FeatureServer";
const PARCEL_LAYER_ID = 0;

const OWNER_FIELDS = ["OwnerName1", "OwnerName2"];
const ACREAGE_FIELDS = ["Acres"];
const PARCEL_ID_FIELDS = ["PIN", "MapNumber"];
// Prefer the composed situs (property) address; fall back to the owner's
// mailing address for parcels with no situs on file (e.g. vacant land). Each
// group's non-empty fields are joined with a space; the first group that yields
// anything wins.
const ADDRESS_FIELD_GROUPS = [
  ["SitusSt", "SitusDir", "SitusDesc1", "SitusSufx"],
  ["OwnerAddr1", "OwnerCity"],
];

// Owner names that mark a parcel as public land (state forest / game lands /
// county / borough / school district). Styled distinctly on the map. Tuned so a
// private "... AUTHORITY"/"MUNICIPAL ..." owner is NOT treated as public.
const PUBLIC_OWNER_PATTERN =
  /\b(COMMONWEALTH|STATE GAME LAND(?:S)?|GAME COMMISSION|SCHOOL DISTRICT|COUNTY OF|BOROUGH OF|TOWNSHIP OF|BUREAU OF FORESTRY|DCNR|UNITED STATES|U\.?S\.?A\.?|NATIONAL FOREST)\b/;

// --- Township boundary source ------------------------------------------------
//
// The parcel selection is a spatial intersection, so we need Shippen Township's
// polygon. By default it comes from the US Census TIGERweb "Current" County
// Subdivisions layer (public, stable): Cameron County is state FIPS 42, county
// FIPS 023. Override any of these with env vars, or point BOUNDARY_GEOJSON_FILE
// at a local GeoJSON/Esri-JSON polygon to run fully offline against a cached
// boundary.

const BOUNDARY_GEOJSON_FILE = process.env.BOUNDARY_GEOJSON_FILE;
const BOUNDARY_SERVICE_URL =
  process.env.BOUNDARY_SERVICE_URL ??
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/1";
const BOUNDARY_WHERE =
  process.env.BOUNDARY_WHERE ??
  "STATE='42' AND COUNTY='023' AND NAME LIKE 'Shippen%'";

// --- HTTP helpers ------------------------------------------------------------

const MAX_ATTEMPTS = 4;

async function fetchJson(url, { body } = {}) {
  const init = body
    ? {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    : { headers: { Accept: "application/json" } };

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // ArcGIS returns HTML on some errors; surface a snippet, not a JSON blob.
        throw new Error(`non-JSON response: ${text.slice(0, 120)}`);
      }
      if (parsed?.error) {
        throw new Error(
          `service error: ${parsed.error.message ?? JSON.stringify(parsed.error)}`,
        );
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        const delay = 2 ** attempt * 1000;
        console.warn(
          `  request failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${error.message} — retrying in ${delay / 1000}s`,
        );
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// --- Boundary ----------------------------------------------------------------

// Returns an Esri polygon geometry ({ rings, spatialReference }) in WGS84 to use
// as the parcel query's spatial filter.
async function getTownshipBoundary() {
  if (BOUNDARY_GEOJSON_FILE) {
    console.log(`Boundary: reading ${BOUNDARY_GEOJSON_FILE}`);
    const raw = JSON.parse(await readFile(BOUNDARY_GEOJSON_FILE, "utf8"));
    const rings = ringsFromAnyPolygon(raw);
    if (!rings) {
      throw new Error(`No polygon geometry found in ${BOUNDARY_GEOJSON_FILE}`);
    }
    return { rings, spatialReference: { wkid: 4326 } };
  }

  console.log(`Boundary: querying ${BOUNDARY_SERVICE_URL}`);
  const url = new URL(`${BOUNDARY_SERVICE_URL.replace(/\/$/, "")}/query`);
  url.searchParams.set("where", BOUNDARY_WHERE);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "json");

  const data = await fetchJson(url.toString());
  const feature = data.features?.[0];
  const rings = feature?.geometry?.rings;
  if (!rings?.length) {
    throw new Error(
      `Boundary query returned no polygon for WHERE "${BOUNDARY_WHERE}". ` +
        `Adjust BOUNDARY_SERVICE_URL / BOUNDARY_WHERE, or supply BOUNDARY_GEOJSON_FILE.`,
    );
  }
  return { rings, spatialReference: { wkid: 4326 } };
}

// Accepts GeoJSON (Feature / FeatureCollection / Polygon / MultiPolygon) or an
// Esri polygon and returns Esri-style rings ([[ [x,y], ... ]]).
function ringsFromAnyPolygon(input) {
  if (input?.rings) return input.rings;
  const geom =
    input?.type === "FeatureCollection"
      ? input.features?.[0]?.geometry
      : input?.type === "Feature"
        ? input.geometry
        : input;
  if (geom?.type === "Polygon") return geom.coordinates;
  if (geom?.type === "MultiPolygon") return geom.coordinates.flat();
  if (geom?.rings) return geom.rings;
  return null;
}

// --- Parcel query ------------------------------------------------------------

async function fetchLayerMeta() {
  const url = `${PARCEL_SERVICE_URL}/${PARCEL_LAYER_ID}?f=json`;
  const meta = await fetchJson(url);
  return {
    maxRecordCount: meta.maxRecordCount ?? 1000,
    supportsPagination: meta.advancedQueryCapabilities?.supportsPagination ?? true,
  };
}

async function queryParcelsIntersecting(boundary) {
  const { maxRecordCount, supportsPagination } = await fetchLayerMeta();
  const pageSize = Math.min(maxRecordCount, 1000);
  console.log(
    `Parcels: paging ${pageSize} at a time (layer maxRecordCount ${maxRecordCount})`,
  );

  const outFields = [
    ...OWNER_FIELDS,
    ...ACREAGE_FIELDS,
    ...PARCEL_ID_FIELDS,
    ...ADDRESS_FIELD_GROUPS.flat(),
  ];
  const queryUrl = `${PARCEL_SERVICE_URL}/${PARCEL_LAYER_ID}/query`;

  const features = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      geometry: JSON.stringify(boundary),
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: outFields.join(","),
      returnGeometry: "true",
      returnCentroid: "true",
      outSR: "4326",
      geometryPrecision: "6",
      f: "json",
    });
    if (supportsPagination) {
      params.set("resultOffset", String(offset));
      params.set("resultRecordCount", String(pageSize));
    }

    const page = await fetchJson(queryUrl, { body: params.toString() });
    const batch = page.features ?? [];
    features.push(...batch);
    process.stdout.write(`  fetched ${features.length} parcels\r`);

    const more = page.exceededTransferLimit || batch.length === pageSize;
    if (!supportsPagination || !more || batch.length === 0) break;
    offset += batch.length;
  }
  process.stdout.write("\n");
  return features;
}

// --- Field extraction (mirrors lib/parcelLookup.ts) --------------------------

function firstNonEmpty(attributes, fieldNames) {
  for (const name of fieldNames) {
    const value = attributes?.[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

// Owner is every non-empty owner field joined with " / " (e.g. an individual
// name plus an "ETUX"/"LLC" second line).
function composeOwner(attributes) {
  const parts = [];
  for (const name of OWNER_FIELDS) {
    const value = attributes?.[name];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
    else if (typeof value === "number" && Number.isFinite(value)) {
      parts.push(String(value));
    }
  }
  return parts.join(" / ");
}

function composeAddress(attributes) {
  for (const group of ADDRESS_FIELD_GROUPS) {
    const parts = [];
    for (const name of group) {
      const value = attributes?.[name];
      if (typeof value === "string" && value.trim()) parts.push(value.trim());
      else if (typeof value === "number" && Number.isFinite(value)) {
        parts.push(String(value));
      }
    }
    const composed = parts.join(" ").replace(/\s+/g, " ").trim();
    if (composed) return composed;
  }
  return "";
}

function parseAcres(attributes) {
  for (const name of ACREAGE_FIELDS) {
    const value = attributes?.[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      return round(value, 2);
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return round(parsed, 2);
    }
  }
  return 0;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Centroid in WGS84: prefer the server-computed centroid, else the area-weighted
// centroid of the polygon's largest ring.
function centroidOf(feature) {
  const c = feature.centroid;
  if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) {
    return { lat: round(c.y, 6), lng: round(c.x, 6) };
  }
  const rings = feature.geometry?.rings;
  if (rings?.length) {
    const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
    const p = ringCentroid(ring);
    if (p) return { lat: round(p.y, 6), lng: round(p.x, 6) };
  }
  return null;
}

function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (area === 0) {
    // Degenerate ring: fall back to the mean vertex.
    const mean = ring.reduce(
      (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
      { x: 0, y: 0 },
    );
    return { x: mean.x / ring.length, y: mean.y / ring.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function toRecord(feature) {
  const attributes = feature.attributes ?? {};
  const owner = composeOwner(attributes);
  if (!owner) return null;

  const point = centroidOf(feature);
  if (!point) return null;

  return {
    lat: point.lat,
    lng: point.lng,
    owner,
    acres: parseAcres(attributes),
    pin: firstNonEmpty(attributes, PARCEL_ID_FIELDS),
    addr: composeAddress(attributes),
    pub: PUBLIC_OWNER_PATTERN.test(owner),
  };
}

// --- Main --------------------------------------------------------------------

async function main() {
  console.log(`Baking Land Owners dataset for ${TOWNSHIP}, ${COUNTY} County, ${STATE}`);

  const boundary = await getTownshipBoundary();
  const features = await queryParcelsIntersecting(boundary);

  const parcels = features
    .map(toRecord)
    .filter((record) => record !== null)
    .sort((a, b) => b.acres - a.acres || a.pin.localeCompare(b.pin));

  const dropped = features.length - parcels.length;
  if (dropped > 0) {
    console.log(`Dropped ${dropped} parcel(s) with no owner or geometry.`);
  }

  const dataset = {
    township: TOWNSHIP,
    county: COUNTY,
    state: STATE,
    source: SOURCE,
    generatedAt: new Date().toISOString().slice(0, 10),
    count: parcels.length,
    parcels,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(dataset));

  const publicCount = parcels.filter((p) => p.pub).length;
  console.log(
    `Wrote ${parcels.length} parcels (${publicCount} public) to ${OUTPUT_PATH}`,
  );
}

// Only bake when run directly (`node scripts/bake-land-owners.mjs`); importing
// the module for testing must not trigger network calls.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nBake failed: ${error.message}`);
    process.exitCode = 1;
  });
}
