#!/usr/bin/env node
// Bakes a township's land-owner dataset from its county parcel service into the
// static JSON the map overlay loads (public/data/<slug>-owners.json).
//
// The overlay ships pre-baked JSON so it stays fast and fully offline at
// runtime; this script is the (occasionally re-run) build step that produces
// those files. Field mappings mirror parcelProviders/pa/index.ts — keep the two
// in sync when a county's service changes.
//
// Usage:
//   node scripts/bake-land-owners.mjs                # bake every township below
//   node scripts/bake-land-owners.mjs hamiltonban    # bake one by slug
//
// Requires network access to the county ArcGIS / PASDA hosts. Run it from an
// environment whose egress policy allows those hosts, then commit the JSON.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "data");

const ADAMS_PARCEL_OWNER_SERVICE_URL =
  "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer";

const PASDA_COUNTY_SERVICE_ROOT =
  "https://mapservices.pasda.psu.edu/server/rest/services/pasda";

const pasdaCounty = (county) =>
  `${PASDA_COUNTY_SERVICE_ROOT}/${county.replace(/\s+/g, "")}County/MapServer`;

// One entry per township to bake. Field lists come from the matching county in
// parcelProviders/pa/index.ts. `municipalityFields` is used to filter the
// service to just this township; the script auto-detects a municipality field
// too, but listing the known candidates first makes the query deterministic.
const TOWNSHIPS = [
  {
    slug: "hamiltonban",
    township: "Hamiltonban Township",
    county: "Adams",
    state: "PA",
    source: "Adams County Parcel Owners via county ArcGIS",
    serviceUrl: ADAMS_PARCEL_OWNER_SERVICE_URL,
    layerId: 0,
    ownerFields: ["SHORT_NAME"],
    acreageFields: ["DEEDED_ACRES", "Map_Ac"],
    parcelIdFields: ["Parcel_ID"],
    addressFieldGroups: [["COMBINED_SITUS"]],
    municipalityFields: ["DISTRICT_NAME", "MUNI_NAME", "MUNICIPALITY", "MUNI"],
    municipalityMatch: "HAMILTONBAN",
  },
  {
    slug: "quincy",
    township: "Quincy Township",
    county: "Franklin",
    state: "PA",
    source: "Franklin County Parcels via PASDA",
    serviceUrl: pasdaCounty("Franklin"),
    layerId: 0,
    ownerFields: ["FULL_OWNER"],
    acreageFields: ["TOTAL_DEED", "BASE_ACRES"],
    parcelIdFields: ["CONTROL_NU"],
    addressFieldGroups: [["FULL_SITUS"]],
    municipalityFields: ["MUNI_NAME", "MUNICIPALITY", "MUNI", "DISTRICT", "TWP"],
    municipalityMatch: "QUINCY",
  },
  {
    slug: "guilford",
    township: "Guilford Township",
    county: "Franklin",
    state: "PA",
    source: "Franklin County Parcels via PASDA",
    serviceUrl: pasdaCounty("Franklin"),
    layerId: 0,
    ownerFields: ["FULL_OWNER"],
    acreageFields: ["TOTAL_DEED", "BASE_ACRES"],
    parcelIdFields: ["CONTROL_NU"],
    addressFieldGroups: [["FULL_SITUS"]],
    municipalityFields: ["MUNI_NAME", "MUNICIPALITY", "MUNI", "DISTRICT", "TWP"],
    municipalityMatch: "GUILFORD",
  },
];

const PAGE_SIZE = 1000;

// Owners that are public land — mirrors the intent of the `pub` flag in the
// baked Shippen dataset (government / game-land parcels get a distinct style).
const PUBLIC_OWNER_PATTERN =
  /\b(COMMONWEALTH|STATE GAME LAND|GAME COMMISSION|DCNR|BUREAU OF FOREST|STATE FOREST|STATE PARK|UNITED STATES|U ?S ?A\b|FEDERAL|NATIONAL PARK|FOREST SERVICE|FISH (AND|&) BOAT|COUNTY OF|TOWNSHIP OF|BOROUGH OF|MUNICIPAL|SCHOOL DISTRICT|AUTHORITY|DEPARTMENT OF)/i;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const data = await response.json();
  if (data && data.error) {
    throw new Error(data.error.message || `Service error for ${url}`);
  }
  return data;
}

// Pick the municipality field to filter on: the first configured candidate the
// layer actually exposes, else the first string field whose name/alias reads
// like a municipality field.
function resolveMunicipalityField(layerMeta, candidates) {
  const fields = layerMeta.fields || [];
  const names = new Set(fields.map((f) => f.name));
  for (const candidate of candidates) {
    if (names.has(candidate)) return candidate;
  }
  const guess = fields.find(
    (f) =>
      typeof f.type === "string" &&
      f.type.includes("String") &&
      /muni|twp|township|district|boro|ward/i.test(`${f.name} ${f.alias || ""}`),
  );
  return guess ? guess.name : null;
}

function firstValue(attributes, fieldNames) {
  for (const name of fieldNames) {
    const value = attributes[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function composeAddress(attributes, fieldGroups) {
  for (const group of fieldGroups) {
    const parts = [];
    for (const name of group) {
      const value = attributes[name];
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

function toAcres(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) return Math.round(parsed * 100) / 100;
  }
  return 0;
}

// Average of a polygon's outer-ring vertices — a cheap interior-ish anchor for
// a label. Used only when the service doesn't return a centroid.
function ringCentroid(geometry) {
  const rings = geometry && geometry.rings;
  if (!Array.isArray(rings) || rings.length === 0) return null;
  let biggest = rings[0];
  for (const ring of rings) if (ring.length > biggest.length) biggest = ring;
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (const [x, y] of biggest) {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      sumX += x;
      sumY += y;
      n += 1;
    }
  }
  if (n === 0) return null;
  return { x: sumX / n, y: sumY / n };
}

function centroidOf(feature) {
  if (
    feature.centroid &&
    Number.isFinite(feature.centroid.x) &&
    Number.isFinite(feature.centroid.y)
  ) {
    return feature.centroid;
  }
  return ringCentroid(feature.geometry);
}

async function bakeTownship(config) {
  const layerUrl = `${config.serviceUrl}/${config.layerId}`;
  const layerMeta = await fetchJson(`${layerUrl}?f=json`);
  const muniField = resolveMunicipalityField(
    layerMeta,
    config.municipalityFields,
  );
  if (!muniField) {
    throw new Error(
      `Could not find a municipality field on ${layerUrl}. ` +
        `Available: ${(layerMeta.fields || []).map((f) => f.name).join(", ")}`,
    );
  }

  const where = `UPPER(${muniField}) LIKE '%${config.municipalityMatch}%'`;
  const outFields = [
    ...config.ownerFields,
    ...config.acreageFields,
    ...config.parcelIdFields,
    ...config.addressFieldGroups.flat(),
  ];

  const parcels = [];
  let offset = 0;
  for (;;) {
    const queryUrl = new URL(`${layerUrl}/query`);
    queryUrl.searchParams.set("f", "json");
    queryUrl.searchParams.set("where", where);
    queryUrl.searchParams.set("outFields", outFields.join(","));
    queryUrl.searchParams.set("returnGeometry", "true");
    queryUrl.searchParams.set("returnCentroid", "true");
    queryUrl.searchParams.set("outSR", "4326");
    queryUrl.searchParams.set("resultOffset", String(offset));
    queryUrl.searchParams.set("resultRecordCount", String(PAGE_SIZE));

    const page = await fetchJson(queryUrl.toString());
    const features = page.features || [];
    for (const feature of features) {
      const attributes = feature.attributes || {};
      const owner = firstValue(attributes, config.ownerFields);
      if (typeof owner !== "string" || !owner.trim()) continue;

      const centroid = centroidOf(feature);
      if (!centroid) continue;

      parcels.push({
        lat: Math.round(centroid.y * 1e6) / 1e6,
        lng: Math.round(centroid.x * 1e6) / 1e6,
        owner: owner.trim(),
        acres: toAcres(firstValue(attributes, config.acreageFields)),
        pin: String(firstValue(attributes, config.parcelIdFields) ?? ""),
        addr: composeAddress(attributes, config.addressFieldGroups),
        pub: PUBLIC_OWNER_PATTERN.test(owner),
      });
    }

    if (features.length < PAGE_SIZE || !page.exceededTransferLimit) break;
    offset += features.length;
  }

  parcels.sort((a, b) => b.acres - a.acres);

  const dataset = {
    township: config.township,
    county: config.county,
    state: config.state,
    source: config.source,
    generatedAt: new Date().toISOString().slice(0, 10),
    count: parcels.length,
    parcels,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${config.slug}-township-owners.json`);
  await writeFile(outPath, JSON.stringify(dataset));
  console.log(
    `Baked ${parcels.length} parcels for ${config.township} -> ${outPath} (municipality field: ${muniField})`,
  );
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const targets = only.length
    ? TOWNSHIPS.filter(
        (t) => only.includes(t.slug) || only.includes(t.township.toLowerCase()),
      )
    : TOWNSHIPS;

  if (targets.length === 0) {
    console.error(`No matching townships. Known slugs: ${TOWNSHIPS.map((t) => t.slug).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  for (const config of targets) {
    try {
      await bakeTownship(config);
    } catch (error) {
      console.error(`Failed to bake ${config.township}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

main();
