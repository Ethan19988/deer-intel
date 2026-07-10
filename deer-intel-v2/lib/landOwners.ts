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

// A township whose baked owner dataset the Land Owners layer can render.
//
// To put a township on the map: bake its dataset with
// scripts/bake-land-owners.mjs (see the disabled Cameron County neighbours
// below for the exact command per township), drop the file in public/data/,
// and flip `enabled` to true. No component changes needed.
export type LandOwnerTownship = {
  id: string;
  // Full name, e.g. "Shippen Township".
  name: string;
  // Short label for the layer toggle, e.g. "Shippen Twp".
  shortLabel: string;
  // Path under public/ of the baked dataset.
  datasetUrl: string;
  // Whether the layer loads and counts this township. Disabled entries are
  // pre-wired placeholders whose dataset hasn't been baked yet — flip to true
  // once public/<datasetUrl> exists.
  enabled: boolean;
};

// Cameron County, PA townships. Shippen is baked and live; its neighbours are
// pre-registered but disabled until their datasets are baked. To bake one, run
// from deer-intel-v2/ with outbound network access, then set enabled: true:
//   TOWNSHIP="Lumber Township" OUTPUT_FILE=lumber-township-owners.json \
//     node scripts/bake-land-owners.mjs
export const LAND_OWNER_TOWNSHIPS: LandOwnerTownship[] = [
  {
    id: "shippen",
    name: "Shippen Township",
    shortLabel: "Shippen Twp",
    datasetUrl: "/data/shippen-township-owners.json",
    enabled: true,
  },
  {
    id: "lumber",
    name: "Lumber Township",
    shortLabel: "Lumber Twp",
    datasetUrl: "/data/lumber-township-owners.json",
    enabled: false,
  },
  {
    id: "gibson",
    name: "Gibson Township",
    shortLabel: "Gibson Twp",
    datasetUrl: "/data/gibson-township-owners.json",
    enabled: false,
  },
  {
    id: "grove",
    name: "Grove Township",
    shortLabel: "Grove Twp",
    datasetUrl: "/data/grove-township-owners.json",
    enabled: false,
  },
  {
    id: "portage",
    name: "Portage Township",
    shortLabel: "Portage Twp",
    datasetUrl: "/data/portage-township-owners.json",
    enabled: false,
  },
];

// The townships the layer actually loads and labels — everything else is a
// placeholder awaiting a baked dataset.
export function activeLandOwnerTownships(): LandOwnerTownship[] {
  return LAND_OWNER_TOWNSHIPS.filter((township) => township.enabled);
}

// An in-memory parcel tagged with the township it came from, so markers key
// uniquely across townships (parcel ids are only unique within a county).
export type LoadedLandOwnerParcel = LandOwnerParcel & { township: string };

// The merged result of loading every registered township's dataset.
export type LoadedLandOwners = {
  parcels: LoadedLandOwnerParcel[];
  townships: LandOwnerTownship[];
};

// Owner labels are only useful zoomed in — below this they overlap into mush,
// and above it any viewport holds few enough parcels to render smoothly.
export const LAND_OWNERS_MIN_ZOOM = 14;
// Hard cap on labels drawn at once, even inside the viewport, for performance.
export const LAND_OWNERS_MAX_VISIBLE = 250;

// The layer toggle label: names the single active township when there's only
// one, otherwise a count. Keeps the current "(Shippen Twp)" wording until more
// townships are enabled.
export function landOwnersLayerLabel(): string {
  const active = activeLandOwnerTownships();
  if (active.length === 1) {
    return `Land Owners (${active[0].shortLabel})`;
  }
  return `Land Owners (${active.length} townships)`;
}

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

// Loads every enabled township's baked dataset and merges them, caching for
// the session. A township that fails to load is skipped so the rest still
// render; only an all-empty result rejects.
export async function loadLandOwners(): Promise<LoadedLandOwners> {
  if (!inflightRequest) {
    const active = activeLandOwnerTownships();
    inflightRequest = Promise.allSettled(
      active.map((township) => loadTownship(township)),
    )
      .then((results) => {
        const parcels: LoadedLandOwnerParcel[] = [];
        const townships: LandOwnerTownship[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            parcels.push(...result.value);
            townships.push(active[index]);
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
