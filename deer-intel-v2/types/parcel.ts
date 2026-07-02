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

export type ParcelOwnerLabel = {
  id: string;
  parcelId: string;
  providerId: string;
  ownerName: string;
  center: ParcelBoundaryPoint;
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

export type ParcelOwnerProviderConfig = {
  attribution?: string;
  enabled: boolean;
  id: string;
  name: string;
};

export type ParcelBoundaryLoadState = {
  status: ParcelProviderStatus;
  message: string;
  boundaries: ParcelBoundary[];
};

export type ParcelOwnerLabelLoadState = {
  status: ParcelProviderStatus;
  message: string;
  labels: ParcelOwnerLabel[];
};

export type ParcelProviderSupportStatus =
  | "supported"
  | "partial"
  | "unavailable";

export type ParcelProviderGeometrySupport = "polygon" | "none";

export type CountyParcelProvider = {
  acreageFieldNames: string[];
  addressFieldNames: string[];
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
