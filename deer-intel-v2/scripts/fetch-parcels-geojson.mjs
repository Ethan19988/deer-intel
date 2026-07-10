#!/usr/bin/env node
// Streams a county's parcels (geometry + a normalized owner record) from its
// ArcGIS/PASDA service into newline-delimited GeoJSON, the input format
// tippecanoe consumes to build the statewide parcel vector tiles.
//
// Each output line is one GeoJSON Feature whose properties are reduced to the
// shared schema the map renders: { owner, acres, pin, addr, pub }. Keeping the
// property set tiny is what makes the resulting tiles small.
//
// Usage:
//   node scripts/fetch-parcels-geojson.mjs franklin out/franklin.ndjson
//   node scripts/fetch-parcels-geojson.mjs adams    out/adams.ndjson
//
// Requires network access to the county services (run with NODE_USE_ENV_PROXY=1
// behind the agent proxy).

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const PAGE_SIZE = 1000;

// Government / public land — gets a distinct style, same intent as the baked
// datasets' `pub` flag.
const PUBLIC_OWNER_PATTERN =
  /\b(COMMONWEALTH|STATE GAME LAND|GAME COMMISSION|DCNR|BUREAU OF FOREST|STATE FOREST|STATE PARK|UNITED STATES|U ?S ?A\b|FEDERAL|NATIONAL PARK|FOREST SERVICE|FISH (AND|&) BOAT|COUNTY OF|TOWNSHIP OF|BOROUGH OF|MUNICIPAL|SCHOOL DISTRICT|AUTHORITY|DEPARTMENT OF)/i;

const COUNTIES = {
  franklin: {
    layerUrl:
      "https://mapservices.pasda.psu.edu/server/rest/services/pasda/FranklinCounty/MapServer/0",
    ownerFields: ["FULL_OWNER"],
    acreageFields: ["TOTAL_DEED", "BASE_ACRES"],
    parcelIdFields: ["CONTROL_NU"],
    addressFields: ["FULL_SITUS"],
  },
  adams: {
    layerUrl:
      "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer/0",
    ownerFields: ["SHORT_NAME"],
    acreageFields: ["DEEDED_ACRES", "Map_Ac"],
    parcelIdFields: ["Parcel_ID"],
    addressFields: ["COMBINED_SITUS"],
  },
};

function firstString(props, names) {
  for (const n of names) {
    const v = props[n];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function firstAcres(props, names) {
  for (const n of names) {
    const v = props[n];
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.round(v * 100) / 100;
    }
    if (typeof v === "string") {
      const p = Number.parseFloat(v.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(p)) return Math.round(p * 100) / 100;
    }
  }
  return 0;
}

function sanitizeAddress(value) {
  return value.replace(/^none\s+/i, "").replace(/\s+/g, " ").trim();
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.error) throw new Error(data.error.message || "service error");
      return data;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

async function main() {
  const [slug, outPath] = process.argv.slice(2);
  const cfg = COUNTIES[slug];
  if (!cfg || !outPath) {
    console.error(`Usage: fetch-parcels-geojson.mjs <${Object.keys(COUNTIES).join("|")}> <out.ndjson>`);
    process.exit(1);
  }

  const outFields = [
    ...cfg.ownerFields,
    ...cfg.acreageFields,
    ...cfg.parcelIdFields,
    ...cfg.addressFields,
  ].join(",");

  await mkdir(dirname(outPath), { recursive: true });
  const out = createWriteStream(outPath);

  let offset = 0;
  let total = 0;
  for (;;) {
    const url = new URL(`${cfg.layerUrl}/query`);
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", outFields);
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("orderByFields", "OBJECTID");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
    url.searchParams.set("f", "geojson");

    const page = await fetchJson(url.toString());
    const features = page.features || [];
    for (const feature of features) {
      if (!feature.geometry) continue;
      const props = feature.attributes || feature.properties || {};
      const owner = firstString(props, cfg.ownerFields);
      if (!owner) continue;
      const normalized = {
        type: "Feature",
        geometry: feature.geometry,
        properties: {
          owner,
          acres: firstAcres(props, cfg.acreageFields),
          pin: firstString(props, cfg.parcelIdFields),
          addr: sanitizeAddress(firstString(props, cfg.addressFields)),
          pub: PUBLIC_OWNER_PATTERN.test(owner) ? 1 : 0,
        },
      };
      out.write(`${JSON.stringify(normalized)}\n`);
      total += 1;
    }

    if (features.length < PAGE_SIZE) break;
    offset += features.length;
    if (offset % 10000 === 0) console.error(`  ${slug}: ${total} written...`);
  }

  await new Promise((resolve) => out.end(resolve));
  console.error(`${slug}: wrote ${total} features -> ${outPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
