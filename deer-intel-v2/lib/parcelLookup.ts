import { getPaParcelProviderByCounty } from "@/parcelProviders/pa";
import type {
  CountyParcelProvider,
  ParcelLookupCounty,
  ParcelOwnerLookupState,
} from "@/types/parcel";

const PASDA_PA_COUNTY_LAYER_URL =
  "https://maps.pasda.psu.edu/arcgis/rest/services/PA_Parcels/MapServer/0";

export const PARCEL_OWNER_INFO_UNAVAILABLE_MESSAGE =
  "Parcel owner info is not available for this county yet";

type ArcGisFeature = {
  attributes?: Record<string, unknown>;
};

type ArcGisQueryResponse = {
  error?: {
    message?: string;
  };
  features?: ArcGisFeature[];
};

type PointQueryOptions = {
  lat: number;
  lng: number;
  outFields: string[];
  serviceLayerUrl: string;
};

export const IDLE_PARCEL_OWNER_LOOKUP_STATE: ParcelOwnerLookupState = {
  status: "idle",
  message: "",
};

export const COUNTY_RECORD_NO_SIGNAL_MESSAGE = "County record unavailable (no signal)";
export const COUNTY_RECORD_FAILED_MESSAGE = "County record unavailable right now";

// The county the last lookup landed in. Taps cluster on one property, so the
// next tap is almost always in the same county: its parcel query starts right
// away, alongside the county check, instead of waiting a full round trip (and
// up to a 15 s timeout) for the county answer first.
let lastCountyName: string | null = null;

// A failed lookup on a weak or absent signal (fetch rejects, or we gave up
// waiting) reads as "no signal"; a county server answering with an error
// doesn't.
function lookupFailureMessage(error: unknown): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || error instanceof TypeError || error instanceof ParcelQueryTimeoutError) {
    return COUNTY_RECORD_NO_SIGNAL_MESSAGE;
  }
  return COUNTY_RECORD_FAILED_MESSAGE;
}

export async function lookupPaParcelOwnerAtPoint(
  lat: number,
  lng: number,
): Promise<ParcelOwnerLookupState> {
  try {
    const guessedProvider = lastCountyName
      ? getPaParcelProviderByCounty(lastCountyName)
      : undefined;
    const speculative =
      guessedProvider && providerSupportsOwnerLookup(guessedProvider)
        ? queryParcelOwnerProvider(guessedProvider, lat, lng)
        : null;
    // Settled here so a wasted guess (a different county) never surfaces as
    // an unhandled rejection.
    const speculativeResult = speculative?.then(
      (parcel) => ({ ok: true as const, parcel }),
      (error: unknown) => ({ ok: false as const, error }),
    );

    let county: ParcelLookupCounty | null;
    try {
      county = await lookupPaCountyAtPoint(lat, lng);
    } catch (error) {
      // The statewide county service is down or slow, but the guessed
      // county's own service answered with a parcel at this exact point —
      // that answer stands on its own.
      const settled = await speculativeResult;
      if (settled && settled.ok && settled.parcel) {
        return { status: "found", message: "", parcel: settled.parcel };
      }
      throw error;
    }
    if (county) lastCountyName = county.countyName;

    if (!county) {
      return {
        status: "not-found",
        message: "Click inside Pennsylvania to look up parcel owner info.",
      };
    }

    const provider = getPaParcelProviderByCounty(county.countyName);

    if (!provider || !providerSupportsOwnerLookup(provider)) {
      return {
        status: "unsupported",
        message: PARCEL_OWNER_INFO_UNAVAILABLE_MESSAGE,
      };
    }

    let parcel: Awaited<ReturnType<typeof queryParcelOwnerProvider>>;
    if (speculativeResult && guessedProvider === provider) {
      const settled = await speculativeResult;
      if (!settled.ok) throw settled.error;
      parcel = settled.parcel;
    } else {
      parcel = await queryParcelOwnerProvider(provider, lat, lng);
    }

    if (!parcel) {
      return {
        status: "not-found",
        message: "No parcel owner record found at this spot.",
      };
    }

    return {
      status: "found",
      message: "",
      parcel,
    };
  } catch (error) {
    return {
      status: "error",
      message: lookupFailureMessage(error),
    };
  }
}

export async function lookupPaCountyAtPoint(
  lat: number,
  lng: number,
): Promise<ParcelLookupCounty | null> {
  const response = await queryArcGisPoint({
    lat,
    lng,
    outFields: ["COUNTY_NAM", "FIPS_COUNT"],
    serviceLayerUrl: PASDA_PA_COUNTY_LAYER_URL,
  });
  const attributes = response.features?.[0]?.attributes;

  if (!attributes) return null;

  const countyName = getStringAttribute(attributes, ["COUNTY_NAM"]);

  if (!countyName) return null;

  return {
    countyFips: getStringAttribute(attributes, ["FIPS_COUNT"]),
    countyName,
  };
}

async function queryParcelOwnerProvider(
  provider: CountyParcelProvider,
  lat: number,
  lng: number,
) {
  const serviceLayerUrl = `${provider.parcelServiceUrl}/${provider.parcelLayerId}`;
  // Ask for every field and pick ours from the result. Naming one field the
  // layer doesn't have (counties rename fields on re-upload) fails the whole
  // query, which blanked the owner card for that county. One parcel's full
  // record is small.
  const outFields = ["*"];
  const response = await queryArcGisPoint({
    lat,
    lng,
    outFields,
    serviceLayerUrl,
  });
  const attributes = response.features?.[0]?.attributes;

  if (!attributes) return null;

  // Every owner field joined, the same way the tile build joins them
  // (scripts/fetch-parcels-geojson.mjs joinFields), so a co-owned parcel's
  // county name matches the name printed on the map.
  const ownerName = joinOwnerFields(attributes, provider.ownerFieldNames);

  if (!ownerName) return null;

  return {
    address: getParcelAddress(provider, attributes),
    countyName: provider.countyName,
    ownerName,
    parcelId: getStringAttribute(attributes, provider.parcelIdFieldNames),
    providerName: `${provider.countyName} County ${provider.source}`,
  };
}

const PARCEL_QUERY_TIMEOUT_MS = 15_000;

class ParcelQueryTimeoutError extends Error {}

async function queryArcGisPoint({
  lat,
  lng,
  outFields,
  serviceLayerUrl,
}: PointQueryOptions): Promise<ArcGisQueryResponse> {
  const queryUrl = new URL(`${serviceLayerUrl.replace(/\/$/, "")}/query`);

  queryUrl.searchParams.set("f", "json");
  queryUrl.searchParams.set("geometry", `${lng},${lat}`);
  queryUrl.searchParams.set("geometryType", "esriGeometryPoint");
  queryUrl.searchParams.set("inSR", "4326");
  queryUrl.searchParams.set("outFields", outFields.join(","));
  queryUrl.searchParams.set("returnGeometry", "false");
  queryUrl.searchParams.set("spatialRel", "esriSpatialRelIntersects");

  // County servers can hang on a weak signal; give up rather than leave the
  // owner card on "Looking up…" forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PARCEL_QUERY_TIMEOUT_MS);
  let result: unknown;

  try {
    const response = await fetch(queryUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Parcel query failed.");
    }

    result = await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ParcelQueryTimeoutError("The county parcel service took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!isArcGisQueryResponse(result)) {
    throw new Error("Unexpected parcel query result.");
  }

  if (result.error) {
    throw new Error(result.error.message ?? "Parcel service returned an error.");
  }

  return result;
}

function providerSupportsOwnerLookup(provider: CountyParcelProvider) {
  return (
    provider.status === "supported" &&
    typeof provider.parcelServiceUrl === "string" &&
    typeof provider.parcelLayerId === "number" &&
    provider.ownerFieldNames.length > 0
  );
}

function getStringAttribute(
  attributes: Record<string, unknown>,
  fieldNames: string[],
) {
  for (const fieldName of fieldNames) {
    const value = attributes[fieldName];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function nameWordSet(value: string): Set<string> {
  return new Set(value.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) if (!b.has(word)) return false;
  return true;
}

/**
 * Join every non-empty owner field with single spaces, matching the tile
 * build's joinFields: blanks skipped, whitespace collapsed. Some counties list
 * two fields that are alternative forms of ONE name (York's OWNER_FULL /
 * OWN_NAME1, which the build reads as `a || b`); a field whose words are all
 * in an earlier one, or that contains all of an earlier one's words, is that
 * kind of alternate and is skipped, so the first form wins as in the build.
 */
export function joinOwnerFields(
  attributes: Record<string, unknown>,
  fieldNames: string[],
): string | undefined {
  const parts: string[] = [];
  const partWords: Set<string>[] = [];
  for (const fieldName of fieldNames) {
    const raw = attributes[fieldName];
    let value = "";
    if (typeof raw === "string") value = raw.trim();
    else if (typeof raw === "number" && Number.isFinite(raw)) value = String(raw);
    if (!value) continue;
    const words = nameWordSet(value);
    if (partWords.some((seen) => isSubset(words, seen) || isSubset(seen, words))) continue;
    parts.push(value);
    partWords.push(words);
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined || undefined;
}

// Prefer a composed property address (e.g. a situs address split across
// several fields) and fall back to a mailing address, before falling back
// to any plain single-field address the provider lists.
function getParcelAddress(
  provider: CountyParcelProvider,
  attributes: Record<string, unknown>,
) {
  if (provider.addressFieldGroups?.length) {
    const composed = getComposedAddress(
      attributes,
      provider.addressFieldGroups,
    );

    if (composed) return composed;
  }

  return getStringAttribute(attributes, provider.addressFieldNames);
}

function getComposedAddress(
  attributes: Record<string, unknown>,
  fieldGroups: string[][],
) {
  for (const group of fieldGroups) {
    const parts: string[] = [];

    for (const fieldName of group) {
      const value = attributes[fieldName];

      if (typeof value === "string" && value.trim()) parts.push(value.trim());
      else if (typeof value === "number" && Number.isFinite(value)) {
        parts.push(String(value));
      }
    }

    const composed = parts.join(" ").replace(/\s+/g, " ").trim();

    if (composed) return composed;
  }

  return undefined;
}

function isArcGisQueryResponse(value: unknown): value is ArcGisQueryResponse {
  return typeof value === "object" && value !== null;
}
