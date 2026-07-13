import type {
  AddressSearchPlace,
  AddressSearchResult,
} from "@/lib/propertyMap";

export const dynamic = "force-dynamic";

// Nominatim's usage policy wants a User-Agent that identifies the app; a
// browser can't set one (it's a forbidden header), which is part of why the
// old client-side search was flaky. Running it here lets us set it properly.
const USER_AGENT = "DeerIntel/1.0 (+https://deer-intel-fghk.vercel.app)";

async function fetchJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 8000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

type CensusMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
};

// US Census "onelineaddress" geocoder — the official TIGER/Line address file.
// It has near-complete rural US street coverage that OpenStreetMap lacks, which
// is why some rural property addresses never showed up on Nominatim alone.
async function geocodeCensus(query: string): Promise<AddressSearchPlace[]> {
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
  );
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url.toString(), { Accept: "application/json" });
  const matches =
    (data as { result?: { addressMatches?: unknown[] } }).result
      ?.addressMatches ?? [];

  const places: AddressSearchPlace[] = [];
  for (const raw of matches) {
    const match = raw as CensusMatch;
    const latitude = match.coordinates?.y;
    const longitude = match.coordinates?.x;
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;

    places.push({
      id: `census-${latitude}-${longitude}`,
      center: [latitude, longitude],
      label: match.matchedAddress
        ? toTitleCase(match.matchedAddress)
        : `${latitude}, ${longitude}`,
      provider: "US Census",
      typeLabel: "Address",
      zoom: 17,
    });
  }
  return places;
}

type NominatimResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
};

async function geocodeNominatim(query: string): Promise<AddressSearchPlace[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const data = await fetchJson(url.toString(), {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  });
  if (!Array.isArray(data)) return [];

  const places: AddressSearchPlace[] = [];
  for (const raw of data as NominatimResult[]) {
    if (!raw.display_name || !raw.lat || !raw.lon) continue;
    const latitude = Number(raw.lat);
    const longitude = Number(raw.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const typeLabel = [raw.class, raw.type]
      .filter((value): value is string => typeof value === "string" && !!value)
      .map((value) => value.replaceAll("_", " "))
      .join(" / ");

    places.push({
      id:
        raw.osm_type && raw.osm_id
          ? `${raw.osm_type}-${raw.osm_id}`
          : `place-${raw.place_id ?? `${latitude}-${longitude}`}`,
      center: [latitude, longitude],
      label: raw.display_name,
      provider: "OpenStreetMap",
      typeLabel: typeLabel || "Place",
      zoom: 16,
    });
  }
  return places;
}

function metersBetween(a: AddressSearchPlace, b: AddressSearchPlace): number {
  const earthRadius = 6371000;
  const [lat1, lng1] = a.center;
  const [lat2, lng2] = b.center;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

// Precise Census address hits lead; OSM places/POIs follow unless one already
// sits within ~80 m of a Census point (the same spot from two sources).
function mergePlaces(
  censusPlaces: AddressSearchPlace[],
  osmPlaces: AddressSearchPlace[],
): AddressSearchPlace[] {
  const merged = [...censusPlaces];
  for (const place of osmPlaces) {
    if (!merged.some((existing) => metersBetween(existing, place) < 80)) {
      merged.push(place);
    }
  }
  return merged.slice(0, 6);
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    const empty: AddressSearchResult = {
      status: "not-found",
      message: "Enter an address, place, road, or GPS coordinate.",
    };
    return Response.json(empty);
  }

  const [censusOutcome, osmOutcome] = await Promise.allSettled([
    geocodeCensus(query),
    geocodeNominatim(query),
  ]);

  const censusPlaces =
    censusOutcome.status === "fulfilled" ? censusOutcome.value : [];
  const osmPlaces = osmOutcome.status === "fulfilled" ? osmOutcome.value : [];

  if (censusOutcome.status === "rejected" && osmOutcome.status === "rejected") {
    const failure: AddressSearchResult = {
      status: "error",
      message: "Address search is temporarily unavailable.",
    };
    return Response.json(failure);
  }

  const results = mergePlaces(censusPlaces, osmPlaces);
  const payload: AddressSearchResult =
    results.length > 0
      ? { status: "found", results }
      : { status: "not-found", message: "No address or place found." };

  return Response.json(payload);
}
