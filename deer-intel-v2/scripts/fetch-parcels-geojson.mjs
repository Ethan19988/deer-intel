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
//
// Owner history (optional): with PARCEL_HISTORY_IN set to a folder holding last
// build's <county>.json.gz owner snapshots, parcels whose owner changed are
// stamped with `prev` + `chg` (see parcel-owner-history.mjs), and this build's
// snapshot is written to PARCEL_HISTORY_OUT/<county>.json.gz. PARCEL_BUILD_MONTH
// (YYYY-MM) overrides the build month, for tests.

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import {
  buildMonthOf,
  carrySnapshotFile,
  createOwnerHistory,
  holdingChange,
  readSnapshotFile,
  writeSnapshotFile,
} from "./parcel-owner-history.mjs";
import { LABEL_MAX_Z, labelMinZoom } from "./parcel-label-fit.mjs";

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
    // Online service (its OID field is FID, not OBJECTID). The Oct 2026
    // republish moved the parcels from layer 0 to layer 6; layer 0's
    // description still loads but every query on it fails.
    layerUrl:
      "https://services6.arcgis.com/pcp4UiBBXQK2kACC/arcgis/rest/services/Fulton_Parcels/FeatureServer/6",
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
    // The 2026 upload renamed ACRE_PLAN1 to ACRE_PLA_1 and made OBJECTID_1 the
    // OID field. Requesting a field that no longer exists fails every query.
    layerUrl: PASDA("ChesterCounty", 11),
    orderBy: "OBJECTID_1",
    outFields: ["OWN1", "OWN2", "ACRE_PLAN_", "ACRE_PLA_1", "PIN_COMMON", "LOC_ADDRES"],
    owner: (p) => joinFields(p, ["OWN1", "OWN2"]),
    acres: (p) => toAcres(p.ACRE_PLAN_ || p.ACRE_PLA_1),
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
  pike: {
    // Pike County's own ArcGIS Server; owner parcels are layer 1.
    layerUrl: "https://gis.pikepa.org/arcgis/rest/services/PikeCo_Parcels/MapServer/1",
    outFields: ["Name", "Acreage", "Control", "Situs"],
    owner: (p) => str(p.Name),
    acres: (p) => toAcres(p.Acreage),
    pin: (p) => str(p.Control),
    addr: (p) => cleanAddr(p.Situs),
  },
  carbon: {
    // Carbon County's own ArcGIS Server. OwnerOld/PrvOwner are previous owners,
    // so only the current Owner is used.
    layerUrl:
      "https://gis.carboncounty.com/arcgis/rest/services/Parcels_Universal/MapServer/0",
    outFields: ["Owner", "DeedAcr", "CALCAC", "PIN", "Location"],
    owner: (p) => str(p.Owner),
    acres: (p) => toAcres(p.DeedAcr) || toAcres(p.CALCAC),
    pin: (p) => str(p.PIN),
    addr: (p) => cleanAddr(p.Location),
  },
  mifflin: {
    // Mifflin republishes under a new date-stamped service name each update,
    // so look up the newest one rather than hardcoding it (OID field is fid).
    resolveLayerUrl: resolveMifflinLayerUrl,
    layerUrl:
      "https://gis.mifflincountypa.gov/arcgis/rest/services/Hosted/parcels_102126/FeatureServer/0",
    orderBy: "fid",
    outFields: ["short_name", "deed_acres", "avacres", "account", "situs_comb"],
    owner: (p) => str(p.short_name),
    acres: (p) => toAcres(p.deed_acres) || toAcres(p.avacres),
    pin: (p) => str(p.account),
    addr: (p) => cleanAddr(p.situs_comb),
  },
  potter: {
    layerUrl:
      "https://maps.pottercountypa.net/arcgis/rest/services/TaxParcel/TaxParcels/MapServer/0",
    // Owner_Name_2 often holds a "C/O" contact rather than a co-owner, so the
    // label uses Owner_Name_1 alone.
    outFields: ["Owner_Name_1", "Acreage", "Control_Number", "Situs_Complete"],
    owner: (p) => str(p.Owner_Name_1),
    acres: (p) => toAcres(p.Acreage),
    pin: (p) => str(p.Control_Number),
    addr: (p) => {
      const loc = cleanAddr(p.Situs_Complete);
      return /^unassigned$/i.test(loc) ? "" : loc;
    },
  },
  lycoming: {
    // Layer 4 joins the parcel polygons to an attribute table, so every field
    // (and the GeoJSON property key) carries its table prefix. Layers 0-3 are
    // single-field views of the same data.
    layerUrl: "https://gis.lyco.org/arcgis/rest/services/Parcels/MapServer/4",
    orderBy: "DBO.Parcels.OBJECTID",
    outFields: [
      "DBO.ParcelAttributes.FULL_NAME",
      "DBO.ParcelAttributes.DEED_ACRES",
      "DBO.Parcels.TXID_NMBR",
      "DBO.ParcelAttributes.SITUS",
    ],
    owner: (p) => str(p["DBO.ParcelAttributes.FULL_NAME"]),
    acres: (p) => toAcres(p["DBO.ParcelAttributes.DEED_ACRES"]),
    pin: (p) => str(p["DBO.Parcels.TXID_NMBR"]),
    addr: (p) => cleanAddr(p["DBO.ParcelAttributes.SITUS"]),
  },
  clearfield: {
    // Served from Centre County's GIS host. ADD1-ADD4 + ZIP look like the
    // owner's mailing address, so no parcel address is taken.
    layerUrl:
      "https://gissites4.centrecountypa.gov/arcgis/rest/services/CentreRoadsAdmin/MapServer/40",
    outFields: ["NAME", "ACRES", "PIN"],
    owner: (p) => str(p.NAME),
    acres: (p) => toAcres(p.ACRES),
    pin: (p) => str(p.PIN),
    addr: () => "",
  },
  huntingdon: {
    // Huntingdon's ArcGIS Online parcels joined to CAMA. Assessed acreage
    // first, mapped acreage as the fallback.
    layerUrl:
      "https://services3.arcgis.com/liWtJPxLI3mlx8pH/arcgis/rest/services/Property_Lines/FeatureServer/1",
    outFields: ["Owner_Name", "CAMA_ACRES", "MAP_ACRES", "TAXIDNUM"],
    owner: (p) => str(p.Owner_Name),
    acres: (p) => toAcres(p.CAMA_ACRES) || toAcres(p.MAP_ACRES),
    pin: (p) => str(p.TAXIDNUM),
    addr: () => "",
  },
  cambria: {
    // Layer 8 "Surface Owners". Layer 7 "Tax Parcels" has no owner fields.
    layerUrl:
      "https://services1.arcgis.com/Fw15y9AZK02r2ZNA/arcgis/rest/services/GIS_Layers/FeatureServer/8",
    outFields: ["OWNER_NAME_1", "OWNER_NAME_2", "ACREAGE", "CONTROL_NUMBER", "SITUS_DESC_1"],
    owner: (p) => joinFields(p, ["OWNER_NAME_1", "OWNER_NAME_2"]),
    acres: (p) => toAcres(p.ACREAGE),
    pin: (p) => str(p.CONTROL_NUMBER),
    addr: (p) => cleanAddr(p.SITUS_DESC_1),
  },
};

// Picks Mifflin's newest Hosted/parcels<MMDDYY> (or parcels_<MMDDYY>) service.
// Falls back to the configured URL if the folder listing can't be read.
async function resolveMifflinLayerUrl(cfg) {
  const root = "https://gis.mifflincountypa.gov/arcgis/rest/services";
  try {
    const listing = await fetchJson(`${root}/Hosted?f=json`);
    let best = null;
    for (const svc of listing.services || []) {
      const m = /^Hosted\/parcels_?(\d{2})(\d{2})(\d{2})$/i.exec(svc.name || "");
      if (!m || svc.type !== "FeatureServer") continue;
      const stamp = Number(`20${m[3]}${m[1]}${m[2]}`); // YYYYMMDD
      if (!best || stamp > best.stamp) best = { stamp, name: svc.name };
    }
    if (best) return `${root}/${best.name}/FeatureServer/0`;
  } catch (err) {
    process.stderr.write(`mifflin: service lookup failed (${err.message}); using default\n`);
  }
  return cfg.layerUrl;
}

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

// ---------------------------------------------------------------------------
// Holding label points
//
// The map draws one owner name per holding, and it has to stay put. Deriving
// that at render time can't work: vector tiles clip every parcel at the tile
// seams, so a big tract arrives as different pieces at different zooms and any
// centre computed from a piece moves when the pieces do. So the anchor is
// computed once here, over whole parcels, and shipped as its own point layer.
//
// A holding is same-owner parcels near each other (owner names are county
// scoped, so no cross-county merging). Its anchor is an interior point of the
// biggest parcel in the group — interior, not the average of the group, which
// for an L of parcels or a pair either side of a hill lands on someone else's
// ground.
// ---------------------------------------------------------------------------

const HOLDING_CLUSTER_M = 2000;
// Label fit (the baked `mz`) lives in parcel-label-fit.mjs, measured with
// the map's Bebas Neue label metrics.

function ringArea(ring) {
  let a2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a2 += x1 * y2 - x2 * y1;
  }
  return Math.abs(a2) / 2;
}

// Point in ring, even-odd.
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// A guaranteed-interior anchor: sample a grid inside the ring's bbox and keep
// the inside point farthest from the boundary. Same intent as the renderer's
// pole of inaccessibility, cheap enough to run per parcel over a whole state.
function interiorPoint(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (pointInRing(cx, cy, ring)) return [cx, cy];

  const N = 12;
  let best = null;
  let bestScore = -1;
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const x = minX + ((maxX - minX) * i) / N;
      const y = minY + ((maxY - minY) * j) / N;
      if (!pointInRing(x, y, ring)) continue;
      // Distance to the bbox edge is a good enough proxy for "well inside".
      const score = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best || [cx, cy];
}

function summarizeParcel(geom, owner, acres, pin) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let bestRing = null;
  let bestArea = -1;
  for (const poly of polys) {
    const ring = poly && poly[0];
    if (!ring || ring.length < 4) continue;
    const a = ringArea(ring);
    if (a > bestArea) {
      bestArea = a;
      bestRing = ring;
    }
  }
  if (!bestRing) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of bestRing) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const [lng, lat] = interiorPoint(bestRing);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return {
    owner,
    pin,
    acres: acres || 0,
    lng,
    lat,
    wM: (maxX - minX) * mPerDegLng,
    hM: (maxY - minY) * mPerDegLat,
    area: bestArea,
  };
}


// Group same-owner parcels into holdings by proximity, then emit one point per
// holding at the biggest parcel's interior anchor.
// `changedOf(pin)` is the YYYY-MM a parcel changed hands, or "" — a holding
// whose main parcel (or most of whose acreage) recently sold carries the
// newest such month as `chg` (see holdingChange), so its name can be tinted
// without the map needing the parcel polygons.
function buildHoldingLabels(summaries, changedOf = () => "") {
  const byOwner = new Map();
  for (const s of summaries) {
    let list = byOwner.get(s.owner);
    if (!list) {
      list = [];
      byOwner.set(s.owner, list);
    }
    list.push(s);
  }

  const labels = [];
  for (const [owner, list] of byOwner) {
    // Grid-cluster within the owner, then union touching cells. Bucketing on
    // the cell key alone chopped contiguous ground into squares — Cameron's
    // COMMONWEALTH OF PA came out as 135 "holdings" because one state forest
    // spans dozens of cells. Merging neighbours makes a run of adjacent cells
    // a single holding, which is what a hunter reads it as.
    const cell = HOLDING_CLUSTER_M / 111320;
    const cells = new Map();
    for (const s of list) {
      const key = `${Math.round(s.lat / cell)}:${Math.round(s.lng / cell)}`;
      let c = cells.get(key);
      if (!c) {
        c = [];
        cells.set(key, c);
      }
      c.push(s);
    }

    const parent = new Map();
    const find = (k) => {
      let r = k;
      while (parent.get(r) !== r) r = parent.get(r);
      while (parent.get(k) !== r) {
        const next = parent.get(k);
        parent.set(k, r);
        k = next;
      }
      return r;
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    for (const key of cells.keys()) parent.set(key, key);
    for (const key of cells.keys()) {
      const [gy, gx] = key.split(":").map(Number);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dy && !dx) continue;
          const n = `${gy + dy}:${gx + dx}`;
          if (cells.has(n)) union(key, n);
        }
      }
    }

    const clusters = new Map();
    for (const [key, parcels] of cells) {
      const root = find(key);
      let c = clusters.get(root);
      if (!c) {
        c = [];
        clusters.set(root, c);
      }
      c.push(...parcels);
    }

    for (const group of clusters.values()) {
      let rep = group[0];
      let acres = 0;
      for (const s of group) {
        acres += s.acres || 0;
        if (s.area > rep.area) rep = s;
      }
      const chg = holdingChange(group, rep, changedOf);
      const acresText = acres > 0;
      const mz = labelMinZoom(owner, acresText, rep.wM, rep.hM, rep.lat);
      if (mz > LABEL_MAX_Z) continue; // never legible; skip rather than ship noise
      labels.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [rep.lng, rep.lat] },
        properties: {
          owner,
          acres: Math.round(acres * 100) / 100,
          pub: PUBLIC_OWNER_PATTERN.test(owner) ? 1 : 0,
          mz,
          ...(chg ? { chg } : {}),
        },
      });
    }
  }
  return labels;
}

async function fetchCounty(slug, outPath, labelPath) {
  const cfg = COUNTIES[slug];
  if (!cfg) throw new Error(`unknown county: ${slug}`);

  await mkdir(dirname(outPath), { recursive: true });
  // Parcels stream to a raw file first, each carrying its parcel id, and are
  // stamped with owner history in a second pass once the whole county has
  // been seen (a change only counts once every parcel has been compared).
  const rawPath = `${outPath}.raw`;
  const out = createWriteStream(rawPath);
  const historyIn = process.env.PARCEL_HISTORY_IN;
  const historyOut = process.env.PARCEL_HISTORY_OUT;
  const buildMonth = process.env.PARCEL_BUILD_MONTH || buildMonthOf();
  const historyInPath = historyIn ? join(historyIn, `${slug}.json.gz`) : "";
  const previous = readSnapshotFile(historyInPath);
  // A corrupt/partial snapshot: compare against nothing (so nothing is marked)
  // and carry the old file forward untouched below instead of overwriting it.
  if (previous.unreadable) {
    process.stderr.write(
      `${slug}: owner snapshot ${historyInPath} is unreadable; marking no changes and keeping it as is\n`,
    );
  }
  const history = createOwnerHistory(previous.snapshot, buildMonth);

  // One record per parcel, kept to feed the holding pass once the county has
  // streamed. Deliberately not the geometry — a big county is 300k parcels, so
  // only the label anchor, extent and area are retained.
  const parcelSummaries = [];

  const layerUrl = cfg.resolveLayerUrl ? await cfg.resolveLayerUrl(cfg) : cfg.layerUrl;
  if (layerUrl !== cfg.layerUrl) process.stderr.write(`${slug}: using ${layerUrl}\n`);

  let offset = 0;
  let total = 0;
  for (;;) {
    const url = new URL(`${layerUrl}/query`);
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
      const pin = cfg.pin ? cfg.pin(p) : "";
      history.observe(pin, owner);
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
          // Build-only: stripped in the stamping pass, never reaches the tiles.
          _pin: pin,
        })}\n`,
      );
      total += 1;

      const summary = summarizeParcel(geom, owner, cfg.acres(p), pin);
      if (summary) parcelSummaries.push(summary);
    }

    // A server whose maxRecordCount is below PAGE_SIZE returns short pages
    // but flags that more remain; only a short page WITHOUT that flag is the end.
    const more =
      page.exceededTransferLimit === true ||
      page.properties?.exceededTransferLimit === true;
    if (features.length === 0) break;
    if (features.length < PAGE_SIZE && !more) break;
    offset += features.length;
    if (offset % 10000 === 0) process.stderr.write(`  ${slug}: ${total}...\n`);
  }

  await new Promise((resolve) => out.end(resolve));

  const stamped = await stampOwnerHistory(rawPath, outPath, history);
  await rm(rawPath, { force: true });
  const { compared, changed, massChange } = history.stats();
  process.stderr.write(
    `${slug}: wrote ${total} features -> ${outPath}` +
      ` (owner history: ${compared} compared, ${changed} changed, ${stamped} marked` +
      `${massChange ? "; mass change ignored as a data reformat" : ""})\n`,
  );
  if (historyOut) {
    const historyOutPath = join(historyOut, `${slug}.json.gz`);
    if (previous.unreadable) carrySnapshotFile(historyInPath, historyOutPath);
    else writeSnapshotFile(historyOutPath, history.finish());
  }

  if (labelPath) {
    const labels = buildHoldingLabels(
      parcelSummaries,
      (pin) => history.stampFor(pin).chg ?? "",
    );
    const labelOut = createWriteStream(labelPath);
    for (const f of labels) labelOut.write(`${JSON.stringify(f)}\n`);
    await new Promise((resolve) => labelOut.end(resolve));
    process.stderr.write(
      `${slug}: wrote ${labels.length} holding labels (from ${parcelSummaries.length} parcels) -> ${labelPath}\n`,
    );
  }

  return total;
}

// Second pass over a county's raw parcels: drop the build-only parcel id and
// add `prev`/`chg` to parcels that changed hands. Returns how many were marked.
async function stampOwnerHistory(rawPath, outPath, history) {
  const out = createWriteStream(outPath);
  const lines = createInterface({ input: createReadStream(rawPath), crlfDelay: Infinity });
  let marked = 0;
  for await (const line of lines) {
    if (!line) continue;
    const feature = JSON.parse(line);
    const { _pin: pin, ...rest } = feature;
    const stamp = history.stampFor(pin);
    if (stamp.chg) marked += 1;
    const props = stamp.chg ? { ...rest.properties, ...stamp } : rest.properties;
    if (!out.write(`${JSON.stringify({ ...rest, properties: props })}\n`)) {
      await new Promise((resolve) => out.once("drain", resolve));
    }
  }
  await new Promise((resolve) => out.end(resolve));
  return marked;
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
      await fetchCounty(
        slug,
        join(dir, `${slug}.ndjson`),
        join(dir, `${slug}.labels.ndjson`),
      );
    }
    return;
  }
  const [slug, outPath, labelPath] = args;
  if (!slug || !outPath) {
    console.error(
      `Usage: fetch-parcels-geojson.mjs <${Object.keys(COUNTIES).join("|")}|--all> <out> [labels-out]`,
    );
    process.exit(1);
  }
  await fetchCounty(slug, outPath, labelPath);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
