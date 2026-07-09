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

// Owner labels are only useful zoomed in — below this they overlap into mush,
// and above it any viewport holds few enough parcels to render smoothly.
export const LAND_OWNERS_MIN_ZOOM = 14;
// Hard cap on labels drawn at once, even inside the viewport, for performance.
export const LAND_OWNERS_MAX_VISIBLE = 250;
export const LAND_OWNERS_DATASET_URL = "/data/shippen-township-owners.json";

let cachedDataset: LandOwnerDataset | null = null;
let inflightRequest: Promise<LandOwnerDataset> | null = null;

// Loads the baked dataset once and caches it for the session.
export async function loadLandOwners(): Promise<LandOwnerDataset> {
  if (cachedDataset) return cachedDataset;

  if (!inflightRequest) {
    inflightRequest = fetch(LAND_OWNERS_DATASET_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Land owner dataset unavailable.");
        return response.json() as Promise<LandOwnerDataset>;
      })
      .then((dataset) => {
        cachedDataset = dataset;
        return dataset;
      })
      .catch((error) => {
        inflightRequest = null;
        throw error;
      });
  }

  return inflightRequest;
}
