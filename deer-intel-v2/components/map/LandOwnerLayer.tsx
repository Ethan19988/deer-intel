import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import {
  LAND_OWNERS_MAX_VISIBLE,
  LAND_OWNERS_MIN_ZOOM,
  loadLandOwners,
  minAcresForZoom,
  type LandOwners,
  type LandOwnerParcel,
} from "@/lib/landOwners";

type LandOwnerLayerProps = {
  enabled: boolean;
  onStatusChange: (message: string) => void;
};

const MOVE_DEBOUNCE_MS = 220;

export default function LandOwnerLayer({
  enabled,
  onStatusChange,
}: LandOwnerLayerProps) {
  const map = useMap();
  const [dataset, setDataset] = useState<LandOwners | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const debounceRef = useRef<number | null>(null);

  // Load the baked dataset the first time the layer is switched on.
  useEffect(() => {
    if (!enabled || dataset || loadError) return;

    let isActive = true;

    loadLandOwners()
      .then((loaded) => {
        if (isActive) setDataset(loaded);
      })
      .catch(() => {
        if (isActive) setLoadError(true);
      });

    return () => {
      isActive = false;
    };
  }, [enabled, dataset, loadError]);

  const bumpView = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setViewVersion((version) => version + 1);
    }, MOVE_DEBOUNCE_MS);
  }, []);

  useMapEvents({
    moveend: bumpView,
    zoomend: bumpView,
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // Parcels within the current viewport whose size clears the zoom threshold,
  // largest first, capped for performance. hiddenCount is how many in-view
  // parcels are held back (too small for this zoom, or over the cap) so the
  // status line can tell the hunter to keep zooming in for the little ones.
  const { visibleParcels, hiddenCount } = useMemo<{
    visibleParcels: LandOwnerParcel[];
    hiddenCount: number;
  }>(() => {
    if (!enabled || !dataset) return { visibleParcels: [], hiddenCount: 0 };

    const zoom = map.getZoom();
    if (zoom < LAND_OWNERS_MIN_ZOOM) {
      return { visibleParcels: [], hiddenCount: 0 };
    }

    const bounds = map.getBounds();
    const inView = dataset.parcels.filter((parcel) =>
      bounds.contains([parcel.lat, parcel.lng]),
    );

    const minAcres = minAcresForZoom(zoom);
    const bigEnough = inView.filter((parcel) => parcel.acres >= minAcres);
    bigEnough.sort((a, b) => b.acres - a.acres);

    const shown = bigEnough.slice(0, LAND_OWNERS_MAX_VISIBLE);

    return { visibleParcels: shown, hiddenCount: inView.length - shown.length };
    // viewVersion drives recompute on pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dataset, map, viewVersion]);

  // Report a status message for the map overlay notice.
  useEffect(() => {
    if (!enabled) {
      onStatusChange("");
      return;
    }

    if (loadError) {
      onStatusChange("Land owners unavailable.");
      return;
    }

    if (!dataset) {
      onStatusChange("Loading land owners...");
      return;
    }

    if (map.getZoom() < LAND_OWNERS_MIN_ZOOM) {
      onStatusChange("Zoom in to see land owners.");
      return;
    }

    if (hiddenCount > 0) {
      onStatusChange("Zoom in on a property to see smaller parcels.");
      return;
    }

    onStatusChange("");
  }, [enabled, loadError, dataset, hiddenCount, map, onStatusChange]);

  if (!enabled || !dataset) return null;

  return (
    <>
      {visibleParcels.map((parcel) => (
        <Marker
          key={parcel.pin || `${parcel.lat},${parcel.lng}`}
          icon={LAND_OWNER_ICON}
          position={[parcel.lat, parcel.lng]}
        >
          <Tooltip
            className={`di-land-owner-tip${parcel.pub ? " di-land-owner-tip-public" : ""}`}
            permanent
            direction="center"
            opacity={1}
          >
            <span className="di-land-owner-name">{parcel.owner}</span>
            {parcel.acres > 0 ? (
              <span className="di-land-owner-acres">
                {parcel.acres.toFixed(parcel.acres >= 10 ? 0 : 1)} ac
              </span>
            ) : null}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

const LAND_OWNER_ICON = divIcon({
  className: "di-land-owner-anchor",
  html: "",
  iconSize: [1, 1],
});
