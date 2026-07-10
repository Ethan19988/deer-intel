#!/usr/bin/env node
// Generate public/data/land-owners-manifest.json by scanning public/data for
// every baked land-owner dataset (*-owners.json).
//
// The Land Owners map layer loads this manifest and then every dataset it
// lists, merged under one toggle — so adding another township/county is just:
// bake its <name>-owners.json into public/data/ and this manifest picks it up
// (it runs automatically on `npm run dev` / `npm run build`, and at the end of
// scripts/bake-land-owners.mjs). No code changes, no per-township wiring.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const DATA_DIR = resolve(PROJECT_ROOT, "public/data");
const MANIFEST_NAME = "land-owners-manifest.json";
const MANIFEST_PATH = resolve(DATA_DIR, MANIFEST_NAME);
const DATASET_SUFFIX = "-owners.json";

// "Shippen Township" -> "shippen-township"; used as a stable marker key prefix.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "Shippen Township" -> "Shippen Twp"; "Emporium Borough" -> "Emporium Boro".
function shortLabelFor(name) {
  return name
    .replace(/\bTownship\b/gi, "Twp")
    .replace(/\bBorough\b/gi, "Boro")
    .trim();
}

export async function generateManifest() {
  const entries = await readdir(DATA_DIR);
  const datasetFiles = entries
    .filter((file) => file.endsWith(DATASET_SUFFIX) && file !== MANIFEST_NAME)
    .sort();

  const townships = [];
  for (const file of datasetFiles) {
    const raw = JSON.parse(await readFile(resolve(DATA_DIR, file), "utf8"));
    const name = raw.township ?? file.replace(DATASET_SUFFIX, "");
    townships.push({
      id: slugify(name),
      name,
      shortLabel: shortLabelFor(name),
      datasetUrl: `/data/${file}`,
      county: raw.county ?? "",
      state: raw.state ?? "",
      count: typeof raw.count === "number" ? raw.count : (raw.parcels?.length ?? 0),
    });
  }

  const manifest = { townships };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

// Run directly (pre-dev / pre-build / from the bake script) — print a summary.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateManifest()
    .then((manifest) => {
      const total = manifest.townships.reduce((sum, t) => sum + t.count, 0);
      console.log(
        `land-owners manifest: ${manifest.townships.length} dataset(s), ${total} parcels ` +
          `-> ${manifest.townships.map((t) => t.name).join(", ") || "(none)"}`,
      );
    })
    .catch((error) => {
      console.error(`Manifest generation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
