#!/usr/bin/env node
// Streams a county's parcels (geometry + a normalized owner record) from its
// ArcGIS/PASDA service into newline-delimited GeoJSON, the input format
// tippecanoe consumes to build the parcel vector tiles.
//
// Each output line is one GeoJSON Feature whose properties are reduced to the
// shared schema the map renders: { owner, acres, pin, addr, pub }. Every county
// exposes these differently (split name fields, acreage buried in a legal-text
// blob, etc.), so each has a small purpose-built extractor below.
//
// Usage:
//   node scripts/fetch-parcels-geojson.mjs franklin out/franklin.ndjson
//   node scripts/fetch-parcels-geojson.mjs --all out/           # every county
//
// Requires network access to the county services (run with NODE_USE_ENV_PROXY=1
// behind the agent proxy).

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const PAGE_SIZE = 1000;

// Government / public land — gets a distinct style, same intent as the baked
// datasets' `pub` flag.
const PUBLIC_OWNER_PATTERN =
  /\b(COMMONWEALTH|STATE GAME LAND|GAME COMMISSION|DCNR|BUREAU OF FOREST|STATE FOREST|STATE PARK|UNITED STATES|U ?S ?A\b|FEDERAL|NATIONAL PARK|FOREST SERVICE|FISH (AND|&) BOAT|COUNTY OF|TOWNSHIP OF|BOROUGH OF|MUNICIPAL|SCHOOL DISTRICT|AUTHORITY|DEPARTMENT OF)/i;

const PASDA = (name, layer = 0) =>
  `https://mapservices.pasda.psu.edu/server/rest/services/pasda/${name}/MapServer/${layer}`;

function str(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

// Join several fields into one string, skipping blanks, collapsing whitespace.
function joinFields(props, names) {
  return names
    .map((n) => str(props[n]))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAcres(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const p = Number.parseFloat(str(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(p) ? Math.round(p * 100) / 100 : 0;
}

// Pull an acreage out of a free-text legal description, e.g. "1.47 ACS DBL TRLR".
function acresFromText(v) {
  const m = str(v).match(/(\d+(?:\.\d+)?)\s*AC/i);
  return m ? Math.round(parseFloat(m[1]) * 100) / 100 : 0;
}

function cleanAddr(v) {
  return str(v).replace(/^none\s+/i, "").replace(/\s+/g, " ").trim();
}

// Dauphin stores the owner as separate name parts (or an org name in last_name
// when first_name is blank).
function dauphinOwner(p) {
  const last = str(p.last_name);
  const first = str(p.first_name);
  const mi = str(p.middle_ini);
  const suf = str(p.suffix);
  if (!last && !first) return "";
  if (!first) return last;
  return [`${last}, ${first}`, mi, suf].filter(Boolean).join(" ");
}

// One extractor per county. outFields lists exactly what to request.
const COUNTIES = {
  franklin: {
    layerUrl: PASDA("FranklinCounty"),
    outFields: ["FULL_OWNER", "TOTAL_DEED", "BASE_ACRES", "CONTROL_NU", "FULL_SITUS"],
    owner: (p) => str(p.FULL_OWNER),
    acres: (p) => toAcres(p.TOTAL_DEED || p.BASE_ACRES),
    pin: (p) => str(p.CONTROL_NU),
    addr: (p) => cleanAddr(p.FULL_SITUS),
  },
  adams: {
    layerUrl:
      "https://mapping.adamscountypa.gov/arcgis/rest/services/AGOL/Parcel_Owners/MapServer/0",
    outFields: ["SHORT_NAME", "DEEDED_ACRES", "Map_Ac", "Parcel_ID", "COMBINED_SITUS"],
    owner: (p) => str(p.SHORT_NAME),
    acres: (p) => toAcres(p.DEEDED_ACRES || p.Map_Ac),
    pin: (p) => str(p.Parcel_ID),
    addr: (p) => cleanAddr(p.COMBINED_SITUS),
  },
  dauphin: {
    layerUrl: PASDA("DauphinCounty"),
    outFields: [
      "last_name", "first_name", "middle_ini", "suffix", "acres", "PID",
      "house_numb", "prefix_dir", "street_nam", "street_suf", "post_direc",
    ],
    owner: dauphinOwner,
    acres: (p) => toAcres(p.acres),
    pin: (p) => str(p.PID),
    addr: (p) =>
      cleanAddr(
        joinFields(p, ["house_numb", "prefix_dir", "street_nam", "street_suf", "post_direc"]),
      ),
  },
  butler: {
    layerUrl: PASDA("ButlerCounty"),
    outFields: ["Own1", "Legal1", "DPIN", "Legal2"],
    owner: (p) => str(p.Own1),
    acres: (p) => acresFromText(p.Legal1),
    pin: (p) => str(p.DPIN),
    addr: (p) => cleanAddr(p.Legal2),
  },
  bedford: {
    layerUrl: PASDA("BedfordCounty"),
    outFields: ["OWNER_NAME", "OWNER_NA_1", "ACRES", "MAP_NO", "SITUS_DESC"],
    owner: (p) => joinFields(p, ["OWNER_NAME", "OWNER_NA_1"]),
    acres: (p) => toAcres(p.ACRES),
    pin: (p) => str(p.MAP_NO),
    addr: (p) => cleanAddr(p.SITUS_DESC),
  },
  juniata: {
    layerUrl: PASDA("JuniataCounty"),
    outFields: ["Owners_Nam", "Owners_N_1", "Calc_AC", "PIN", "Physical_A"],
    owner: (p) => joinFields(p, ["Owners_Nam", "Owners_N_1"]),
    acres: (p) => toAcres(p.Calc_AC),
    pin: (p) => str(p.PIN),
    addr: (p) => cleanAddr(p.Physical_A),
  },
  fulton: {
    // PASDA has no owner data for Fulton; this is the county's own ArcGIS
    // Online service (its OID field is FID, not OBJECTID).
    layerUrl:
      "https://services6.arcgis.com/pcp4UiBBXQK2kACC/arcgis/rest/services/Fulton_Parcels/FeatureServer/0",
    orderBy: "FID",
    outFields: ["Deeded_Nam", "Deeded_Acr", "PIN", "Location"],
    owner: (p) => str(p.Deeded_Nam),
    acres: (p) => toAcres(p.Deeded_Acr),
    pin: (p) => str(p.PIN),
    addr: (p) => {
      const loc = cleanAddr(p.Location);
      return /^unassigned$/i.test(loc) ? "" : loc;
    },
  },
  berks: {
    layerUrl: PASDA("BerksCounty", 6),
    outFields: ["NAME1", "ACREAGE", "PIN", "FULLSITEAD"],
    owner: (p) => str(p.NAME1),
    acres: (p) => toAcres(p.ACREAGE),
    pin: (p) => str(p.PIN),
    addr: (p) => cleanAddr(p.FULLSITEAD),
  },
  bucks: {
    layerUrl: PASDA("BucksCounty", 17),
    outFields: ["OWNER1", "OWNER2", "DEED_AREA", "PARCEL_NUM", "ADDRESS"],
    owner: (p) => joinFields(p, ["OWNER1", "OWNER2"]),
    acres: (p) => toAcres(p.DEED_AREA),
    pin: (p) => str(p.PARCEL_NUM),
    addr: (p) => cleanAddr(p.ADDRESS),
  },
  cameron: {
    // Cameron publishes its own ArcGIS Online FeatureServer (OID field is FID).
    layerUrl:
      "https://services5.arcgis.com/NN66N9nlzcCXJ9he/arcgis/rest/services/Parcels_(September_2025)/FeatureServer/0",
    orderBy: "FID",
    outFields: [
      "OwnerName1", "OwnerName2", "Acres", "PIN",
      "SitusSt", "SitusDir", "SitusDesc1", "SitusSufx",
    ],
    owner: (p) => joinFields(p, ["OwnerName1", "OwnerName2"]),
    acres: (p) => toAcres(p.Acres),
    pin: (p) => str(p.PIN),
    addr: (p) =>
      cleanAddr(joinFields(p, ["SitusSt", "SitusDir", "SitusDesc1", "SitusSufx"])),
  },
  chester: {
    layerUrl: PASDA("ChesterCounty", 11),
    outFields: ["OWN1", "OWN2", "ACRE_PLAN_", "ACRE_PLAN1", "PIN_COMMON", "LOC_ADDRES"],
    owner: (p) => joinFields(p, ["OWN1", "OWN2"]),
    acres: (p) => toAcres(p.ACRE_PLAN_ || p.ACRE_PLAN1),
    pin: (p) => str(p.PIN_COMMON),
    addr: (p) => cleanAddr(p.LOC_ADDRES),
  },
  forest: {
    layerUrl: PASDA("ForestCounty", 3),
    outFields: ["OWNER1", "ACRES", "PARCEL", "SITUS"],
    owner: (p) => str(p.OWNER1),
    acres: (p) => toAcres(p.ACRES),
    pin: (p) => str(p.PARCEL),
    addr: (p) => cleanAddr(p.SITUS),
  },
  montgomery: {
    // Montgomery's OID field is OBJECTID_12, not the default OBJECTID.
    layerUrl: PASDA("MontgomeryCounty", 14),
    orderBy: "OBJECTID_12",
    outFields: ["OWN1", "OWN2", "LAND_ACRES", "PARCEL", "LOCATION1"],
    owner: (p) => joinFields(p, ["OWN1", "OWN2"]),
    acres: (p) => toAcres(p.LAND_ACRES),
    pin: (p) => str(p.PARCEL),
    addr: (p) => cleanAddr(p.LOCATION1),
  },
  wyoming: {
    layerUrl: PASDA("WyomingCounty", 2),
    outFields: ["Owner", "Owner_2", "Deeded_Acr", "CALC_AC", "PARCELNUM", "Situs_Addr"],
    owner: (p) => joinFields(p, ["Owner", "Owner_2"]),
    acres: (p) => toAcres(p.Deeded_Acr || p.CALC_AC),
    pin: (p) => str(p.PARCELNUM),
    addr: (p) => cleanAddr(p.Situs_Addr),
  },
  york: {
    layerUrl: PASDA("YorkCounty", 31),
    outFields: ["OWNER_FULL", "OWN_NAME1", "ACRES", "PIDN", "PROPADR"],
    owner: (p) => str(p.OWNER_FULL) || str(p.OWN_NAME1),
    acres: (p) => toAcres(p.ACRES),
    pin: (p) => str(p.PIDN),
    addr: (p) => cleanAddr(p.PROPADR),
  },
  northampton: {
    // Northampton's own ArcGIS Online parcels (122k features; OID field is FID).
    // OWNER_LN2 is blank in practice but joined anyway for the rare second name;
    // LOCATION is the situs address (MAIL_ADDR* are the owner's mailing address).
    layerUrl:
      "https://services2.arcgis.com/NlbUAihbvA50xxJw/arcgis/rest/services/Northampton_Parcels/FeatureServer/0",
    orderBy: "FID",
    outFields: ["OWNER_LN1", "OWNER_LN2", "ASSMNT_AC", "PARCEL_ID", "LOCATION"],
    owner: (p) => joinFields(p, ["OWNER_LN1", "OWNER_LN2"]),
    acres: (p) => toAcres(p.ASSMNT_AC),
    pin: (p) => str(p.PARCEL_ID),
    addr: (p) => cleanAddr(p.LOCATION),
  },
  wayne: {
    // Wayne County's own tax-parcel FeatureServer (57k features). It publishes
    // no parcel address: PropertyLocation is null throughout and Address/City
    // are the OWNER's mailing address, so addr stays blank rather than passing
    // off a mailing address as where the land is.
    layerUrl:
      "https://services1.arcgis.com/VMKRr2Ecl6EFwJpm/arcgis/rest/services/TaxParcels/FeatureServer/0",
    outFields: ["Name", "Acreage", "GISACRE", "ControlNumber", "PARCELNO"],
    owner: (p) => str(p.Name),
    acres: (p) => toAcres(p.Acreage) || toAcres(p.GISACRE),
    pin: (p) => str(p.ControlNumber) || str(p.PARCELNO),
    addr: () => "",
  },
  indiana: {
    // NAME_EXT is the full assessment name; SHORT_NAME is a truncated form, so
    // it's only the fallback. Deeded acreage beats the GIS-computed figure.
    layerUrl: PASDA("IndianaCounty", 5),
    outFields: [
      "NAME_EXT",
      "SHORT_NAME",
      "DEEDED_ACR",
      "ACRES",
      "PARCEL_ID",
      "COMBINED_S",
    ],
    owner: (p) => str(p.NAME_EXT) || str(p.SHORT_NAME),
    acres: (p) => toAcres(p.DEEDED_ACR) || toAcres(p.ACRES),
    pin: (p) => str(p.PARCEL_ID),
    addr: (p) => cleanAddr(p.COMBINED_S),
  },
  bradford: {
    // Owner parcels live on layer 5 (a join); OID field is OBJECTID_12.
    layerUrl: PASDA("BradfordCounty", 5),
    orderBy: "OBJECTID_12",
    outFields: ["NAME", "ACREAGE", "ParcelJoin", "ADDRESS", "CITY"],
    owner: (p) => str(p.NAME),
    acres: (p) => toAcres(p.ACREAGE),
    pin: (p) => str(p.ParcelJoin),
    addr: (p) => cleanAddr(joinFields(p, ["ADDRESS", "CITY"])),
  },
};

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.error) throw new Error(data.error.message || "service error");
      return data;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
}

async function fetchCounty(slug, outPath) {
  const cfg = COUNTIES[slug];
  if (!cfg) throw new Error(`unknown county: ${slug}`);

  await mkdir(dirname(outPath), { recursive: true });
  const out = createWriteStream(outPath);

  let offset = 0;
  let total = 0;
  for (;;) {
    const url = new URL(`${cfg.layerUrl}/query`);
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", cfg.outFields.join(","));
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("orderByFields", cfg.orderBy || "OBJECTID");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
    url.searchParams.set("f", "geojson");

    const page = await fetchJson(url.toString());
    const features = page.features || [];
    for (const feature of features) {
      const geom = feature.geometry;
      // Owner parcels are polygons; skip anything else (guards against a county
      // whose layer turns out to be address points).
      if (!geom || !/Polygon/.test(geom.type)) continue;
      const p = feature.properties || {};
      const owner = cfg.owner(p);
      if (!owner) continue;
      out.write(
        `${JSON.stringify({
          type: "Feature",
          geometry: geom,
          properties: {
            // Only owner/acres/pub are rendered by the map overlay; pin/addr
            // were dead weight in the tiles (click-to-identify queries the
            // county services live), so they're dropped to shrink the archive.
            owner,
            acres: cfg.acres(p),
            pub: PUBLIC_OWNER_PATTERN.test(owner) ? 1 : 0,
          },
        })}\n`,
      );
      total += 1;
    }

    if (features.length < PAGE_SIZE) break;
    offset += features.length;
    if (offset % 10000 === 0) process.stderr.write(`  ${slug}: ${total}...\n`);
  }

  await new Promise((resolve) => out.end(resolve));
  process.stderr.write(`${slug}: wrote ${total} features -> ${outPath}\n`);
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  // Single source of truth for which counties are configured, so the tile build
  // can't drift from this file (it used to keep its own hardcoded list, and a
  // county added here silently never made it into the archive).
  if (args[0] === "--list") {
    process.stdout.write(`${Object.keys(COUNTIES).join(" ")}\n`);
    return;
  }
  if (args[0] === "--all") {
    const dir = args[1] || "out";
    for (const slug of Object.keys(COUNTIES)) {
      await fetchCounty(slug, join(dir, `${slug}.ndjson`));
    }
    return;
  }
  const [slug, outPath] = args;
  if (!slug || !outPath) {
    console.error(`Usage: fetch-parcels-geojson.mjs <${Object.keys(COUNTIES).join("|")}|--all> <out>`);
    process.exit(1);
  }
  await fetchCounty(slug, outPath);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
