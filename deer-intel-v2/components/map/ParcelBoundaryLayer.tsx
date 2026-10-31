import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  PARCEL_PROVIDER_CONFIG,
  PROPERTY_LINES_NEED_SIGNAL_STATE,
  PROPERTY_LINES_UNAVAILABLE_STATE,
  propertyLinesErrorState,
} from "@/lib/parcelProvider";
import { isMobileMapDevice } from "@/lib/mapDevice";
import type { ParcelBoundaryLoadState } from "@/types/parcel";

type ParcelBoundaryLayerProps = {
  enabled: boolean;
  propertyId: string;
  onStateChange: (state: ParcelBoundaryLoadState | null) => void;
};

const MOBILE_SLOW_LOAD_MS = 3000;
const PROPERTY_LINES_MIN_ZOOM = Math.max(
  15,
  PARCEL_PROVIDER_CONFIG.minNativeZoom,
);
const PROPERTY_LINES_ZOOM_GATE_DEBOUNCE_MS = 240;
const PROPERTY_LINES_ZOOM_GATE_STATE: ParcelBoundaryLoadState = {
  status: "idle",
  message: "Zoom in to view property lines.",
  boundaries: [],
};
function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

type ParcelBoundaryTileOverlayProps = {
  eventHandlers: {
    loading: () => void;
    load: () => void;
    tileload: () => void;
    tileerror: () => void;
  };
};

const ParcelBoundaryTileOverlay = memo(function ParcelBoundaryTileOverlay({
  eventHandlers,
}: ParcelBoundaryTileOverlayProps) {
  const tileOptions = useMemo(() => {
    const mobile = isMobileMapDevice();

    return {
      keepBuffer: mobile ? 0 : 1,
      updateInterval: mobile ? 900 : 350,
      updateWhenIdle: true,
      updateWhenZooming: false,
    };
  }, []);

  return (
    <TileLayer
      attribution={PARCEL_PROVIDER_CONFIG.attribution}
      eventHandlers={eventHandlers}
      keepBuffer={tileOptions.keepBuffer}
      maxNativeZoom={PARCEL_PROVIDER_CONFIG.maxNativeZoom}
      maxZoom={20}
      minNativeZoom={PARCEL_PROVIDER_CONFIG.minNativeZoom}
      minZoom={PROPERTY_LINES_MIN_ZOOM}
      opacity={0.9}
      updateInterval={tileOptions.updateInterval}
      updateWhenIdle={tileOptions.updateWhenIdle}
      updateWhenZooming={tileOptions.updateWhenZooming}
      url={PARCEL_PROVIDER_CONFIG.tileUrl}
      zIndex={760}
    />
  );
});

function ParcelBoundaryLayer({
  enabled,
  propertyId,
  onStateChange,
}: ParcelBoundaryLayerProps) {
  const map = useMap();
  const [isZoomHighEnough, setIsZoomHighEnough] = useState(
    () => map.getZoom() >= PROPERTY_LINES_MIN_ZOOM,
  );
  const lastStateKeyRef = useRef("");
  const slowLoadTimerRef = useRef<number | null>(null);
  // Tile results for the current load cycle (reset on each "loading").
  const tileCountsRef = useRef({ loaded: 0, failed: 0 });
  const zoomGateTimerRef = useRef<number | null>(null);

  const clearZoomGateTimer = useCallback(() => {
    if (zoomGateTimerRef.current === null) return;

    window.clearTimeout(zoomGateTimerRef.current);
    zoomGateTimerRef.current = null;
  }, []);

  const reportState = useCallback(
    (state: ParcelBoundaryLoadState | null) => {
      const stateKey = state
        ? `${state.status}:${state.message}:${state.boundaries.length}`
        : "off";

      if (lastStateKeyRef.current === stateKey) return;

      lastStateKeyRef.current = stateKey;
      onStateChange(state);
    },
    [onStateChange],
  );

  const syncZoomGate = useCallback(() => {
    const isNextZoomHighEnough = map.getZoom() >= PROPERTY_LINES_MIN_ZOOM;

    setIsZoomHighEnough((current) =>
      current === isNextZoomHighEnough ? current : isNextZoomHighEnough,
    );
  }, [map]);

  const queueZoomGateSync = useCallback(() => {
    clearZoomGateTimer();
    zoomGateTimerRef.current = window.setTimeout(() => {
      zoomGateTimerRef.current = null;
      syncZoomGate();
    }, PROPERTY_LINES_ZOOM_GATE_DEBOUNCE_MS);
  }, [clearZoomGateTimer, syncZoomGate]);

  useMapEvents({
    moveend: queueZoomGateSync,
    zoomend: queueZoomGateSync,
  });

  const clearSlowLoadTimer = useCallback(() => {
    if (slowLoadTimerRef.current === null) return;

    window.clearTimeout(slowLoadTimerRef.current);
    slowLoadTimerRef.current = null;
  }, []);

  useEffect(() => {
    syncZoomGate();
  }, [enabled, syncZoomGate]);

  useEffect(() => {
    clearSlowLoadTimer();

    if (!enabled) {
      reportState(null);
      return;
    }

    if (!propertyId || !PARCEL_PROVIDER_CONFIG.enabled) {
      reportState(PROPERTY_LINES_UNAVAILABLE_STATE);
      return;
    }

    if (!isZoomHighEnough) {
      reportState(PROPERTY_LINES_ZOOM_GATE_STATE);
      return;
    }

    reportState({
      status: "loading",
      message: "Loading property lines...",
      boundaries: [],
    });
  }, [
    clearSlowLoadTimer,
    enabled,
    isZoomHighEnough,
    propertyId,
    reportState,
  ]);

  useEffect(() => {
    return () => {
      clearSlowLoadTimer();
      clearZoomGateTimer();
    };
  }, [clearSlowLoadTimer, clearZoomGateTimer]);

  const eventHandlers = useMemo(
    () => ({
      loading() {
        clearSlowLoadTimer();
        tileCountsRef.current = { loaded: 0, failed: 0 };
        reportState({
          status: "loading",
          message: "Loading property lines...",
          boundaries: [],
        });

        if (!isMobileMapDevice()) return;

        slowLoadTimerRef.current = window.setTimeout(() => {
          reportState({
            status: "loading",
            message: "Property lines are still loading in the background.",
            boundaries: [],
          });
        }, MOBILE_SLOW_LOAD_MS);
      },
      load() {
        clearSlowLoadTimer();
        const { loaded, failed } = tileCountsRef.current;
        reportState(
          propertyLinesErrorState(loaded, failed, browserOnline()) ?? {
            status: "ready",
            message: "",
            boundaries: [],
          },
        );
      },
      tileload() {
        tileCountsRef.current.loaded += 1;
      },
      tileerror() {
        tileCountsRef.current.failed += 1;
        // Offline, every tile will fail: say so right away rather than
        // waiting for the whole load to give up.
        if (!browserOnline()) {
          clearSlowLoadTimer();
          reportState(PROPERTY_LINES_NEED_SIGNAL_STATE);
        }
      },
    }),
    [clearSlowLoadTimer, reportState],
  );

  if (!enabled) return null;
  if (!propertyId || !PARCEL_PROVIDER_CONFIG.enabled) return null;
  if (!isZoomHighEnough) return null;

  return <ParcelBoundaryTileOverlay eventHandlers={eventHandlers} />;
}

export default memo(ParcelBoundaryLayer);
