import type {
  ParcelBoundaryLoadState,
  ParcelProviderConfig,
} from "@/types/parcel";

export const PROPERTY_LINES_NOT_CONNECTED_MESSAGE =
  "Property lines provider not connected yet";

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

export const EMPTY_PARCEL_BOUNDARY_STATE: ParcelBoundaryLoadState = {
  status: "not-configured",
  message: PROPERTY_LINES_NOT_CONNECTED_MESSAGE,
  boundaries: [],
};

type LoadParcelBoundariesOptions = {
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
