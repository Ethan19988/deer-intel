import { useEffect } from "react";
import { TileLayer } from "react-leaflet";
import {
  EMPTY_PARCEL_BOUNDARY_STATE,
  PARCEL_PROVIDER_CONFIG,
  PROPERTY_LINES_NOT_CONNECTED_MESSAGE,
} from "@/lib/parcelProvider";
import type { ParcelBoundaryLoadState } from "@/types/parcel";

type ParcelBoundaryLayerProps = {
  enabled: boolean;
  propertyId: string;
  onStateChange: (state: ParcelBoundaryLoadState | null) => void;
};

export default function ParcelBoundaryLayer({
  enabled,
  propertyId,
  onStateChange,
}: ParcelBoundaryLayerProps) {
  useEffect(() => {
    if (!enabled) {
      onStateChange(null);
      return;
    }

    if (!propertyId || !PARCEL_PROVIDER_CONFIG.enabled) {
      onStateChange(EMPTY_PARCEL_BOUNDARY_STATE);
      return;
    }

    onStateChange({
      status: "ready",
      message: "",
      boundaries: [],
    });
  }, [enabled, onStateChange, propertyId]);

  if (!enabled) return null;
  if (!propertyId || !PARCEL_PROVIDER_CONFIG.enabled) return null;

  return (
    <TileLayer
      attribution={PARCEL_PROVIDER_CONFIG.attribution}
      eventHandlers={{
        tileerror() {
          const errorState: ParcelBoundaryLoadState = {
            status: "error",
            message: PROPERTY_LINES_NOT_CONNECTED_MESSAGE,
            boundaries: [],
          };

          onStateChange(errorState);
        },
      }}
      maxNativeZoom={PARCEL_PROVIDER_CONFIG.maxNativeZoom}
      maxZoom={20}
      minNativeZoom={PARCEL_PROVIDER_CONFIG.minNativeZoom}
      opacity={0.9}
      pane="overlayPane"
      url={PARCEL_PROVIDER_CONFIG.tileUrl}
      zIndex={760}
    />
  );
}
