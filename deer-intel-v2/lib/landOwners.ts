"use client";

// A single parcel's land-owner record, baked from the county parcel service.
export type LandOwnerParcel = {
  lat: number;
  lng: number;
  owner: string;
  acres: number;
  pin: string;
  addr: string;
  pub: boolean;
};

export type LandOwnerDataset = {
  township: string;
  county: string;
  state: string;
  source: string;
  generatedAt: string;
  count: number;
  parcels: LandOwnerParcel[];
};

// One baked land-owner dataset the layer can render — a township (or any area)
// whose <name>-owners.json lives in public/data/. Discovered automatically via
// the build-time manifest (scripts/generate-land-owners-manifest.mjs), so
// adding coverage is just baking another dataset — no code changes here.
export type LandOwnerTownship = {
  id: string;
  // Full name, e.g. "Shippen Township".
  name: string;
  // Short label, e.g. "Shippen Twp".
  shortLabel: string;
  // Path under public/ of the baked dataset.
  datasetUrl: string;
  county: string;
  state: string;
  count: number;
};

type LandOwnerManifest = {
  townships: LandOwnerTownship[];
};

// Where the generated manifest lives, and a hardcoded fallback used only if it
// can't be fetched (e.g. the generator hasn't run) so the layer never breaks.
export const LAND_OWNERS_MANIFEST_URL = "/data/land-owners-manifest.json";
const FALLBACK_TOWNSHIPS: LandOwnerTownship[] = [
  {
    id: "shippen-township",
    name: "Shippen Township",
    shortLabel: "Shippen Twp",
    datasetUrl: "/data/shippen-township-owners.json",
    county: "Cameron",
    state: "PA",
    count: 0,
  },
];

// Single toggle label — the one button spans every baked dataset.
export const LAND_OWNERS_LAYER_LABEL = "Land Owners";

// An in-memory parcel tagged with the township it came from, so markers key
// uniquely across townships (parcel ids are only unique within a county).
export type LoadedLandOwnerParcel = LandOwnerParcel & { township: string };

// The merged result of loading every dataset in the manifest.
export type LoadedLandOwners = {
  parcels: LoadedLandOwnerParcel[];
  townships: LandOwnerTownship[];
};

// Owner labels are only useful zoomed in — below this they overlap into mush,
// and above it any viewport holds few enough parcels to render smoothly.
export const LAND_OWNERS_MIN_ZOOM = 14;
// Hard cap on labels drawn at once, even inside the viewport, for performance.
export const LAND_OWNERS_MAX_VISIBLE = 250;

// Smaller parcels only reveal their owner as you zoom in. At a given zoom a
// parcel must be at least this many acres to get a label, so the view isn't a
// wall of overlapping names on tightly-packed small parcels — you zoom in on
// the property to see who owns the little ones. At high zoom, everything shows.
export function minAcresForZoom(zoom: number): number {
  if (zoom >= 18) return 0;
  if (zoom >= 17) return 1;
  if (zoom >= 16) return 3;
  if (zoom >= 15) return 10;
  return 30;
}

// Per-township dataset cache, keyed by township id, so switching the layer off
// and on never refetches.
const townshipCache = new Map<string, LoadedLandOwnerParcel[]>();
let inflightRequest: Promise<LoadedLandOwners> | null = null;

async function loadTownship(
  township: LandOwnerTownship,
): Promise<LoadedLandOwnerParcel[]> {
  const cached = townshipCache.get(township.id);
  if (cached) return cached;

  const response = await fetch(township.datasetUrl);
  if (!response.ok) {
    throw new Error(`Land owner dataset unavailable for ${township.name}.`);
  }
  const dataset = (await response.json()) as LandOwnerDataset;
  const tagged = dataset.parcels.map((parcel) => ({
    ...parcel,
    township: township.id,
  }));
  townshipCache.set(township.id, tagged);
  return tagged;
}

// Reads the manifest of baked datasets, falling back to a built-in list if the
// manifest can't be fetched, so the layer always has something to load.
async function loadManifestTownships(): Promise<LandOwnerTownship[]> {
  try {
    const response = await fetch(LAND_OWNERS_MANIFEST_URL);
    if (!response.ok) return FALLBACK_TOWNSHIPS;
    const manifest = (await response.json()) as LandOwnerManifest;
    if (!manifest.townships?.length) return FALLBACK_TOWNSHIPS;
    return manifest.townships;
  } catch {
    return FALLBACK_TOWNSHIPS;
  }
}

// Loads every dataset in the manifest and merges them under the one layer,
// caching for the session. A dataset that fails to load is skipped so the rest
// still render; only an all-empty result rejects.
export async function loadLandOwners(): Promise<LoadedLandOwners> {
  if (!inflightRequest) {
    inflightRequest = loadManifestTownships()
      .then(async (registry) => {
        const results = await Promise.allSettled(
          registry.map((township) => loadTownship(township)),
        );

        const parcels: LoadedLandOwnerParcel[] = [];
        const townships: LandOwnerTownship[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            parcels.push(...result.value);
            townships.push(registry[index]);
          }
        });

        if (townships.length === 0) {
          throw new Error("No land owner datasets could be loaded.");
        }

        return { parcels, townships };
      })
      .catch((error) => {
        inflightRequest = null;
        throw error;
      });
  }

  return inflightRequest;
}
