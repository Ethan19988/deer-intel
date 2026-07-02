import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import {
  EMPTY_PARCEL_BOUNDARY_STATE,
  PARCEL_PROVIDER_CONFIG,
  PROPERTY_LINES_NOT_CONNECTED_MESSAGE,
  loadParcelBoundaries,
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
  const [loadState, setLoadState] = useState<ParcelBoundaryLoadState>(
    EMPTY_PARCEL_BOUNDARY_STATE,
  );

  useEffect(() => {
    let isActive = true;

    if (!enabled) {
      setLoadState(EMPTY_PARCEL_BOUNDARY_STATE);
      onStateChange(null);
      return () => {
        isActive = false;
      };
    }

    const loadingState: ParcelBoundaryLoadState = {
      status: "loading",
      message: "Loading property lines...",
      boundaries: [],
    };

    setLoadState(loadingState);
    onStateChange(loadingState);

    loadParcelBoundaries({ propertyId })
      .then((state) => {
        if (!isActive) return;

        setLoadState(state);
        onStateChange(state);
      })
      .catch(() => {
        if (!isActive) return;

        const errorState: ParcelBoundaryLoadState = {
          status: "error",
          message: "Property lines could not be loaded.",
          boundaries: [],
        };

        setLoadState(errorState);
        onStateChange(errorState);
      });

    return () => {
      isActive = false;
    };
  }, [enabled, onStateChange, propertyId]);

  if (!enabled) return null;
  if (loadState.status === "not-configured") return null;

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

          setLoadState(errorState);
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
