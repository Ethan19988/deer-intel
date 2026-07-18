export type ParcelProviderStatus =
  | "idle"
  | "not-configured"
  | "loading"
  | "found"
  | "not-found"
  | "unsupported"
  | "ready"
  | "error";

export type ParcelBoundaryPoint = {
  lat: number;
  lng: number;
};

export type ParcelBoundary = {
  id: string;
  providerId: string;
  propertyId: string;
  label: string;
  acreage?: number;
  ownerName?: string;
  points: ParcelBoundaryPoint[];
};

export type ParcelProviderConfig = {
  attribution: string;
  id: string;
  maxNativeZoom: number;
  minNativeZoom: number;
  name: string;
  tileUrl: string;
  enabled: boolean;
};

export type ParcelBoundaryLoadState = {
  status: ParcelProviderStatus;
  message: string;
  boundaries: ParcelBoundary[];
};

export type ParcelProviderSupportStatus =
  | "supported"
  | "partial"
  | "unavailable";

export type ParcelProviderGeometrySupport = "polygon" | "none";

export type CountyParcelProvider = {
  acreageFieldNames: string[];
  addressFieldNames: string[];
  // Optional ordered groups of field names for building the property address.
  // Each group's fields are joined with spaces (blank values skipped); the
  // first group that yields a non-empty result wins. Lets a county prefer a
  // composed situs/property address and fall back to a mailing address.
  addressFieldGroups?: string[][];
  countyFips: string;
  countyName: string;
  geometrySupport: ParcelProviderGeometrySupport;
  notes?: string;
  ownerFieldNames: string[];
  parcelIdFieldNames: string[];
  parcelLayerId?: number;
  parcelServiceUrl?: string;
  source: "PASDA" | "PA GeoData" | "County ArcGIS" | "Unavailable";
  status: ParcelProviderSupportStatus;
};

export type ParcelLookupCounty = {
  countyFips?: string;
  countyName: string;
};

export type ParcelOwnerLookupResult = {
  acreage?: string;
  address?: string;
  countyName: string;
  ownerName: string;
  parcelId?: string;
  providerName: string;
};

export type ParcelOwnerLookupState = {
  message: string;
  parcel?: ParcelOwnerLookupResult;
  status: Extract<
    ParcelProviderStatus,
    "idle" | "loading" | "found" | "not-found" | "unsupported" | "error"
  >;
};
