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

// The merged view the map overlay renders: every baked township's parcels in
// one list, plus which townships actually loaded (some may not be baked yet).
export type LandOwners = {
  townships: string[];
  parcels: LandOwnerParcel[];
};

// Owner labels are only useful zoomed in — below this they overlap into mush,
// and above it any viewport holds few enough parcels to render smoothly.
export const LAND_OWNERS_MIN_ZOOM = 14;
// Hard cap on labels drawn at once, even inside the viewport, for performance.
export const LAND_OWNERS_MAX_VISIBLE = 250;

// The baked datasets to overlay, one JSON per township under public/data.
// Regenerate any of these with scripts/bake-land-owners.mjs. A file that isn't
// present yet (not baked) is skipped, so this list can lead the data.
export const LAND_OWNERS_DATASET_URLS = [
  "/data/shippen-township-owners.json",
  "/data/hamiltonban-township-owners.json",
  "/data/quincy-township-owners.json",
  "/data/guilford-township-owners.json",
];

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

let cachedData: LandOwners | null = null;
let inflightRequest: Promise<LandOwners> | null = null;

async function fetchDataset(url: string): Promise<LandOwnerDataset | null> {
  try {
    const response = await fetch(url);
    // A township that hasn't been baked yet (404) is simply skipped.
    if (!response.ok) return null;
    return (await response.json()) as LandOwnerDataset;
  } catch {
    return null;
  }
}

// Loads every baked township dataset once, merges their parcels, and caches the
// result for the session. Townships whose JSON isn't present yet are skipped;
// the load only fails if none of them could be loaded.
export async function loadLandOwners(): Promise<LandOwners> {
  if (cachedData) return cachedData;

  if (!inflightRequest) {
    inflightRequest = Promise.all(
      LAND_OWNERS_DATASET_URLS.map(fetchDataset),
    )
      .then((datasets) => {
        const loaded = datasets.filter(
          (dataset): dataset is LandOwnerDataset => dataset !== null,
        );

        if (loaded.length === 0) {
          throw new Error("Land owner datasets unavailable.");
        }

        const merged: LandOwners = {
          townships: loaded.map((dataset) => dataset.township),
          parcels: loaded.flatMap((dataset) => dataset.parcels),
        };

        cachedData = merged;
        return merged;
      })
      .catch((error) => {
        inflightRequest = null;
        throw error;
      });
  }

  return inflightRequest;
}
