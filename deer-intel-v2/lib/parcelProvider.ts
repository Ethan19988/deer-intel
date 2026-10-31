import type {
  ParcelBoundaryLoadState,
  ParcelProviderConfig,
} from "@/types/parcel";

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

export const PROPERTY_LINES_UNAVAILABLE_STATE: ParcelBoundaryLoadState = {
  status: "error",
  message: "Property lines unavailable here",
  boundaries: [],
};

export const PROPERTY_LINES_NEED_SIGNAL_STATE: ParcelBoundaryLoadState = {
  status: "error",
  message: "Property lines need a signal",
  boundaries: [],
};

// One failed tile (a seam, a blip) shouldn't blank the whole layer with an
// error: only call the lines unavailable once most of a load's tiles failed.
const PROPERTY_LINES_FAILED_SHARE = 0.5;

/** The error to show for one load cycle's tile results, or null for none. */
export function propertyLinesErrorState(
  loaded: number,
  failed: number,
  online: boolean,
): ParcelBoundaryLoadState | null {
  if (failed === 0) return null;
  if (!online) return PROPERTY_LINES_NEED_SIGNAL_STATE;
  return failed / (loaded + failed) > PROPERTY_LINES_FAILED_SHARE
    ? PROPERTY_LINES_UNAVAILABLE_STATE
    : null;
}
