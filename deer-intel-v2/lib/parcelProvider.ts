import type {
  ParcelBoundaryLoadState,
  ParcelOwnerLabelLoadState,
  ParcelOwnerProviderConfig,
  ParcelProviderConfig,
} from "@/types/parcel";

export const PROPERTY_LINES_NOT_CONNECTED_MESSAGE =
  "Property lines provider not connected yet";
export const OWNER_NAMES_PROVIDER_NOT_CONNECTED_MESSAGE =
  "Owner names require a parcel data provider.";

export const PARCEL_PROVIDER_CONFIG: ParcelProviderConfig = {
  attribution: "Parcel boundaries &copy; Regrid",
  enabled: true,
  id: "regrid-nationwide-parcel-boundaries-v1",
  maxNativeZoom: 17,
  minNativeZoom: 15,
  name: "Regrid Nationwide Parcel Boundaries",
  tileUrl:
    "https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}",
};

export const PARCEL_OWNER_PROVIDER_CONFIG: ParcelOwnerProviderConfig = {
  enabled: false,
  id: "not-connected",
  name: "Parcel owner data provider",
};

export const EMPTY_PARCEL_BOUNDARY_STATE: ParcelBoundaryLoadState = {
  status: "not-configured",
  message: PROPERTY_LINES_NOT_CONNECTED_MESSAGE,
  boundaries: [],
};

export const EMPTY_PARCEL_OWNER_LABEL_STATE: ParcelOwnerLabelLoadState = {
  status: "not-configured",
  message: OWNER_NAMES_PROVIDER_NOT_CONNECTED_MESSAGE,
  labels: [],
};

type LoadParcelBoundariesOptions = {
  propertyId: string;
};

type LoadParcelOwnerLabelsOptions = {
  propertyId: string;
};

export async function loadParcelBoundaries({
  propertyId,
}: LoadParcelBoundariesOptions): Promise<ParcelBoundaryLoadState> {
  if (
    !propertyId ||
    !PARCEL_PROVIDER_CONFIG.enabled ||
    !PARCEL_PROVIDER_CONFIG.tileUrl
  ) {
    return EMPTY_PARCEL_BOUNDARY_STATE;
  }

  return {
    status: "ready",
    message: "",
    boundaries: [],
  };
}

export async function loadParcelOwnerLabels({
  propertyId,
}: LoadParcelOwnerLabelsOptions): Promise<ParcelOwnerLabelLoadState> {
  if (!propertyId || !PARCEL_OWNER_PROVIDER_CONFIG.enabled) {
    return EMPTY_PARCEL_OWNER_LABEL_STATE;
  }

  return {
    status: "ready",
    message: "",
    labels: [],
  };
}
