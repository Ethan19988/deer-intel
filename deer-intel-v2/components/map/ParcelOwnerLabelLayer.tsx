import { useEffect, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import {
  EMPTY_PARCEL_OWNER_LABEL_STATE,
  loadParcelOwnerLabels,
} from "@/lib/parcelProvider";
import type { ParcelOwnerLabelLoadState } from "@/types/parcel";

type ParcelOwnerLabelLayerProps = {
  enabled: boolean;
  propertyId: string;
  onStateChange: (state: ParcelOwnerLabelLoadState | null) => void;
};

export default function ParcelOwnerLabelLayer({
  enabled,
  propertyId,
  onStateChange,
}: ParcelOwnerLabelLayerProps) {
  const [loadState, setLoadState] = useState<ParcelOwnerLabelLoadState>(
    EMPTY_PARCEL_OWNER_LABEL_STATE,
  );

  useEffect(() => {
    let isActive = true;

    if (!enabled) {
      setLoadState(EMPTY_PARCEL_OWNER_LABEL_STATE);
      onStateChange(null);
      return () => {
        isActive = false;
      };
    }

    const loadingState: ParcelOwnerLabelLoadState = {
      status: "loading",
      message: "Loading owner names...",
      labels: [],
    };

    setLoadState(loadingState);
    onStateChange(loadingState);

    loadParcelOwnerLabels({ propertyId })
      .then((state) => {
        if (!isActive) return;

        setLoadState(state);
        onStateChange(state);
      })
      .catch(() => {
        if (!isActive) return;

        const errorState: ParcelOwnerLabelLoadState = {
          status: "error",
          message: "Owner names could not be loaded.",
          labels: [],
        };

        setLoadState(errorState);
        onStateChange(errorState);
      });

    return () => {
      isActive = false;
    };
  }, [enabled, onStateChange, propertyId]);

  if (!enabled || loadState.status === "not-configured") return null;

  return (
    <>
      {loadState.labels.map((label) => (
        <Marker
          key={label.id}
          icon={ownerLabelIcon}
          position={[label.center.lat, label.center.lng]}
        >
          <Tooltip permanent direction="center" opacity={0.92}>
            {label.ownerName}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

const ownerLabelIcon = divIcon({
  className: "deer-intel-owner-label-anchor",
  html: "",
  iconSize: [1, 1],
});
