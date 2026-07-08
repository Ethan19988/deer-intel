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

export async function lookupPaParcelOwnerAtPoint(
  lat: number,
  lng: number,
): Promise<ParcelOwnerLookupState> {
  try {
    const county = await lookupPaCountyAtPoint(lat, lng);

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

    const parcel = await queryParcelOwnerProvider(provider, lat, lng);

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
  } catch {
    return {
      status: "error",
      message: "Parcel owner lookup is temporarily unavailable.",
    };
  }
}

async function lookupPaCountyAtPoint(
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
  const outFields = [
    ...provider.ownerFieldNames,
    ...provider.parcelIdFieldNames,
    ...provider.acreageFieldNames,
    ...provider.addressFieldNames,
    ...(provider.addressFieldGroups?.flat() ?? []),
  ];
  const response = await queryArcGisPoint({
    lat,
    lng,
    outFields,
    serviceLayerUrl,
  });
  const attributes = response.features?.[0]?.attributes;

  if (!attributes) return null;

  const ownerName = getStringAttribute(attributes, provider.ownerFieldNames);

  if (!ownerName) return null;

  return {
    acreage: getAcreageAttribute(attributes, provider.acreageFieldNames),
    address: getParcelAddress(provider, attributes),
    countyName: provider.countyName,
    ownerName,
    parcelId: getStringAttribute(attributes, provider.parcelIdFieldNames),
    providerName: `${provider.countyName} County ${provider.source}`,
  };
}

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

  const response = await fetch(queryUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Parcel query failed.");
  }

  const result: unknown = await response.json();

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

function getAcreageAttribute(
  attributes: Record<string, unknown>,
  fieldNames: string[],
) {
  for (const fieldName of fieldNames) {
    const value = attributes[fieldName];

    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value.toFixed(2)} acres`;
    }

    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function isArcGisQueryResponse(value: unknown): value is ArcGisQueryResponse {
  return typeof value === "object" && value !== null;
}
