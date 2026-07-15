"use client";

import "leaflet/dist/leaflet.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "next/navigation";
import { divIcon, type Map as LeafletMap } from "leaflet";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  ScaleControl,
  WMSTileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import CachedTileLayer from "@/components/map/CachedTileLayer";
import SuperWMSTileLayer from "@/components/map/SuperWMSTileLayer";
import ContourLabels from "@/components/map/ContourLabels";
import MapTopBar from "@/components/map/MapTopBar";
import WindThermalLayer, {
  type WindStandPoint,
} from "@/components/map/WindThermalLayer";
import WindThermalBadge, {
  type WindBadgeStatus,
} from "@/components/map/WindThermalBadge";
import MovementLayer from "@/components/map/MovementLayer";
import MovementBadge from "@/components/map/MovementBadge";
import TerrainMovementLayer from "@/components/map/TerrainMovementLayer";
import TerrainLegend from "@/components/map/TerrainLegend";
import ScoutPicksPanel from "@/components/map/ScoutPicksPanel";
import type { LatLng } from "@/lib/terrainMovement";
import {
  boundsOfHuntArea,
  centerOfBounds,
  useTerrainSet,
} from "@/lib/useTerrainSet";
import {
  buildCorridors,
  corridorDirection,
  corridorEvidence,
  currentMovementPeriod,
  movementForecast,
  movementPhaseForDate,
  movementPhaseLabel,
  propertyMovementSignal,
  resolveSeasonalPhotos,
  rutRegionLabel,
  rutShiftDays,
  type BeddingPoint,
  type CameraPhotoTiming,
  type CameraPoint,
  type MovementForecast,
  type ResourcePoint,
} from "@/lib/movementPrediction";
import MapAssetInfoCard from "@/components/map/MapAssetInfoCard";
import MapAssetSelectorPanel from "@/components/map/MapAssetSelectorPanel";
import MapLayerManager, {
  type MapToolId,
  type MapToolState,
} from "@/components/map/MapLayerManager";
import MapPinBox, {
  PIN_BOX_DRAG_DATA_TYPE,
} from "@/components/map/MapPinBox";
import ParcelBoundaryLayer from "@/components/map/ParcelBoundaryLayer";
import ParcelOwnerLabelLayer from "@/components/map/ParcelOwnerLabelLayer";
import ParcelOwnerInfoCard from "@/components/map/ParcelOwnerInfoCard";
import ParcelTilesLayer, {
  type ParcelTileOwnerPick,
} from "@/components/map/ParcelTilesLayer";
import { ownerAcresText } from "@/lib/ownerLabel";
import MapSearchBar from "@/components/map/MapSearchBar";
import MapSearchResultMarker from "@/components/map/MapSearchResultMarker";
import OfflineDownloadStatus from "@/components/map/OfflineDownloadStatus";
import OfflineMapsPanel, {
  type OfflineStatus,
} from "@/components/map/OfflineMapsPanel";
import PropertyMapAssetMarker from "@/components/map/PropertyMapAssetMarker";
import UserLocationMarker from "@/components/map/UserLocationMarker";
import WalkTrackLayer from "@/components/map/WalkTrackLayer";
import {
  createDeerIntelId,
  PROPERTY_ASSET_PIN_TYPES,
  type PinType,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { formatHuntAreaAcres, huntAreaIsValid } from "@/lib/huntArea";
import {
  distanceBetweenMeters,
  formatWalkDistance,
  formatWalkDuration,
  MIN_TRACK_POINT_METERS,
  walkTrackDistanceMeters,
} from "@/lib/walkTrack";
import type { WalkTrack, WalkTrackPoint } from "@/types/walkTrack";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
} from "@/lib/liveWeather";
import { parseWindSpeed, thermalCue, type ThermalCue } from "@/lib/windViz";
import { getStandWindCheck } from "@/lib/standWind";
import {
  deleteOfflinePack,
  downloadOfflinePack,
  offlineMapsSupported,
  planOfflinePack,
  useOfflineMapPacks,
  type OfflineMapBounds,
  type OfflineTileSource,
} from "@/lib/offlineMaps";
import {
  fetchWaybackReleases,
  waybackTileUrl,
  type WaybackRelease,
} from "@/lib/waybackImagery";
import { parsePropertyCoordinate } from "@/lib/propertyLocation";
import {
  IDLE_PARCEL_OWNER_LOOKUP_STATE,
  lookupPaParcelOwnerAtPoint,
} from "@/lib/parcelLookup";
import {
  MOBILE_MAP_MEDIA_QUERY,
  isMobileMapDevice as getIsMobileMapDevice,
} from "@/lib/mapDevice";
import {
  cameraToMapAsset,
  createVisibleAssetLayerState,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getAssetDetailHref,
  getAssetEditHref,
  geocodeAddressOrPlace,
  MAP_LAYER_BY_ID,
  pinToMapAsset,
  CONTOUR_WMS_URL,
  CONTOUR_WMS_COARSE_LINES,
  CONTOUR_FINE_WMS_URL,
  CONTOUR_FINE_WMS_LAYER,
  CONTOUR_ATTRIBUTION,
  CONTOUR_MIN_ZOOM,
  CONTOUR_FINE_ZOOM,
  SLOPE_WMS_URL,
  SLOPE_WMS_LAYER,
  SLOPE_ATTRIBUTION,
  type AddressSearchPlace,
  type MapAsset,
  type AssetLayerId,
  type MapCenter,
  type MapLayerId,
} from "@/lib/propertyMap";
import type {
  ParcelBoundaryLoadState,
  ParcelOwnerLookupState,
  ParcelOwnerLabelLoadState,
} from "@/types/parcel";
import type { HuntAreaPoint } from "@/types/property";
import { useDefaultMapLayer } from "@/lib/mapPreferences";
import Button from "./ui/Button";

type ClickToAddPinProps = {
  enabled: boolean;
  pinType: PinType;
  propertyId: string;
  onAddPin: (pinType: PinType, lat: number, lng: number) => void;
};

type MapClickEvent = {
  latlng: {
    lat: number;
    lng: number;
  };
};

type SearchTarget = {
  center: MapCenter;
  id: number;
  zoom: number;
};

const MAP_CENTER_EPSILON = 0.00001;

// Zoom used when auto-centering on a property. Close enough to see a property's
// footprint without diving all the way to individual-asset zoom.
const PROPERTY_FOCUS_ZOOM = 16;

// Highlight styling for a property's hunt area — a bright, translucent overlay
// so the ground you hunt reads at a glance without hiding the terrain beneath.
const HUNT_AREA_PATH_OPTIONS = {
  color: "#4aa3ff",
  weight: 2,
  fillColor: "#4aa3ff",
  fillOpacity: 0.18,
};

const HUNT_AREA_DRAFT_PATH_OPTIONS = {
  color: "#7ec2ff",
  weight: 2,
  dashArray: "6 6",
  fillColor: "#7ec2ff",
  fillOpacity: 0.12,
};

function huntAreaVertexIcon(pointNumber: number) {
  return divIcon({
    className: "di-area-vertex-icon",
    html: `<span class="di-area-vertex">${pointNumber}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function useIsMobileMapDevice() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_MAP_MEDIA_QUERY);
    const updateMobileState = () => setIsMobile(mediaQuery.matches);

    updateMobileState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMobileState);
      return () =>
        mediaQuery.removeEventListener("change", updateMobileState);
    }

    mediaQuery.addListener(updateMobileState);
    return () => mediaQuery.removeListener(updateMobileState);
  }, []);

  return isMobile;
}

function normalizeMapCenter(center: MapCenter): MapCenter {
  return [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))];
}

function mapCentersAreClose(firstCenter: MapCenter, secondCenter: MapCenter) {
  return (
    Math.abs(firstCenter[0] - secondCenter[0]) < MAP_CENTER_EPSILON &&
    Math.abs(firstCenter[1] - secondCenter[1]) < MAP_CENTER_EPSILON
  );
}

function ClickToAddPin({
  enabled,
  pinType,
  propertyId,
  onAddPin,
}: ClickToAddPinProps) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!enabled || !propertyId) return;

      onAddPin(pinType, event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function ClickToLookupParcelOwner({
  enabled,
  onLookup,
}: {
  enabled: boolean;
  onLookup: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!enabled) return;

      onLookup(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function ClickToDrawArea({
  enabled,
  onAddPoint,
}: {
  enabled: boolean;
  onAddPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!enabled) return;

      onAddPoint(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function isSupportedPropertyPinType(value: string): value is PinType {
  return PROPERTY_ASSET_PIN_TYPES.includes(
    value as (typeof PROPERTY_ASSET_PIN_TYPES)[number],
  );
}

function MapPinDropTarget({
  enabled,
  onDropPin,
}: {
  enabled: boolean;
  onDropPin: (pinType: PinType, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const onDropPinRef = useRef(onDropPin);

  useEffect(() => {
    onDropPinRef.current = onDropPin;
  }, [onDropPin]);

  useEffect(() => {
    const container = map.getContainer();

    function getDroppedPinType(event: DragEvent): PinType | null {
      const droppedType =
        event.dataTransfer?.getData(PIN_BOX_DRAG_DATA_TYPE) ||
        event.dataTransfer?.getData("text/plain") ||
        "";

      return isSupportedPropertyPinType(droppedType) ? droppedType : null;
    }

    function handleDragOver(event: DragEvent) {
      if (!enabled || !getDroppedPinType(event)) return;

      event.preventDefault();

      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }

    function handleDrop(event: DragEvent) {
      const droppedType = getDroppedPinType(event);

      if (!enabled || !droppedType) return;

      event.preventDefault();
      event.stopPropagation();

      const bounds = container.getBoundingClientRect();
      const point: [number, number] = [
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      ];
      const latLng = map.containerPointToLatLng(point);

      onDropPinRef.current(droppedType, latLng.lat, latLng.lng);
    }

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
    };
  }, [enabled, map]);

  return null;
}

function MapControlButtons({
  showCompass,
  showGps,
  isFollowing,
  onToggleFollow,
  onHeadingChange,
}: {
  showCompass: boolean;
  showGps: boolean;
  isFollowing: boolean;
  onToggleFollow: (next: boolean) => void;
  onHeadingChange: (heading: number | null) => void;
}) {
  const map = useMap();
  const [heading, setHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const lastHeadingAtRef = useRef(0);

  function startFollow() {
    if (!navigator.geolocation) {
      alert("GPS is not supported on this device.");
      return;
    }

    // Recenter right away for instant feedback, then stay following as the
    // live-location dot keeps updating.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
      },
      () => {
        alert(
          "Could not get your location. Make sure location permission is allowed.",
        );
      },
    );
    onToggleFollow(true);
  }

  // The GPS button steps through three states on plain single taps: the 1st tap
  // follows your live location, the 2nd adds the heading beam + compass, and the
  // 3rd turns both back off.
  function handleGpsTap() {
    if (compassOn) {
      onToggleFollow(false);
      setCompassOn(false);
      setHeading(null);
      onHeadingChange(null);
      return;
    }

    if (isFollowing) {
      void enableCompass();
      return;
    }

    startFollow();
  }

  async function enableCompass() {
    // iOS 13+ only delivers compass data after an explicit grant, and the
    // request has to come straight from this tap gesture.
    const orientationApi = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied" | "default">;
        })
      | undefined;

    if (
      orientationApi &&
      typeof orientationApi.requestPermission === "function"
    ) {
      try {
        const permission = await orientationApi.requestPermission();
        if (permission !== "granted") {
          alert("Compass permission was declined.");
          return;
        }
      } catch {
        alert("The compass isn't available on this device.");
        return;
      }
    }

    setCompassOn(true);
  }

  // While the compass is on, follow the device's heading. Prefer iOS's
  // true-north webkitCompassHeading; otherwise use an absolute-orientation
  // event's alpha (relative deviceorientation isn't tied to north, so skip it).
  useEffect(() => {
    if (!compassOn) return;

    function onOrientation(event: DeviceOrientationEvent) {
      const now = Date.now();
      if (now - lastHeadingAtRef.current < 80) return;

      const iosHeading = (
        event as DeviceOrientationEvent & { webkitCompassHeading?: number }
      ).webkitCompassHeading;

      let next: number | null = null;
      if (typeof iosHeading === "number" && !Number.isNaN(iosHeading)) {
        next = iosHeading;
      } else if (event.absolute && typeof event.alpha === "number") {
        next = 360 - event.alpha;
      }

      if (next === null) return;
      lastHeadingAtRef.current = now;
      const rounded = Math.round(((next % 360) + 360) % 360);
      setHeading(rounded);
      onHeadingChange(rounded);
    }

    window.addEventListener(
      "deviceorientationabsolute",
      onOrientation as EventListener,
      true,
    );
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        onOrientation as EventListener,
        true,
      );
      window.removeEventListener("deviceorientation", onOrientation, true);
    };
  }, [compassOn, onHeadingChange]);

  const facingCardinal =
    heading === null
      ? null
      : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
          Math.round(heading / 45) % 8
        ];

  return (
    <div
      className="di-map-controls"
      style={mapControlsStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Zoom in"
        className="di-map-control-button"
        style={mapControlButtonStyle}
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        className="di-map-control-button"
        style={mapControlButtonStyle}
        onClick={() => map.zoomOut()}
      >
        -
      </button>
      {showCompass ? (
        <div
          aria-label={
            compassOn && heading !== null
              ? `Facing ${facingCardinal}, ${heading} degrees`
              : "Compass north indicator"
          }
          className="di-map-control-button di-map-compass"
          role="img"
          style={{
            ...mapControlButtonStyle,
            ...compassButtonStyle,
            ...(compassOn ? compassActiveStyle : null),
          }}
          title={
            compassOn
              ? heading !== null
                ? `Facing ${facingCardinal} · ${heading}°`
                : "Reading compass…"
              : "Tap GPS again to show which way you're facing"
          }
        >
          {compassOn && heading !== null ? (
            <>
              <span
                style={{
                  ...compassArrowStyle,
                  transform: `rotate(${heading}deg)`,
                }}
              >
                ▲
              </span>
              <span style={compassFacingStyle}>{facingCardinal}</span>
            </>
          ) : (
            <>
              <span style={compassNeedleStyle}>^</span>
              <span style={compassTextStyle}>N</span>
            </>
          )}
        </div>
      ) : null}
      {showGps ? (
        <button
          type="button"
          aria-label={
            compassOn
              ? "Turn off location and compass"
              : isFollowing
                ? "Show which way I'm facing"
                : "Follow my location"
          }
          aria-pressed={isFollowing || compassOn}
          className="di-map-control-button di-map-gps-button"
          style={{
            ...mapControlButtonStyle,
            ...gpsButtonStyle,
            ...(isFollowing ? gpsButtonActiveStyle : null),
          }}
          onClick={handleGpsTap}
        >
          GPS
        </button>
      ) : null}
    </div>
  );
}

function MapStateTracker({
  onMapStateChange,
}: {
  onMapStateChange: (center: MapCenter, zoom: number) => void;
}) {
  const lastCenterRef = useRef<MapCenter | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const map = useMapEvents({
    moveend() {
      queueMapStateSync();
    },
    zoomend() {
      queueMapStateSync();
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function queueMapStateSync() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        syncMapState();
      });
    }, 180);
  }

  function syncMapState() {
    const center = map.getCenter();
    const nextCenter = normalizeMapCenter([center.lat, center.lng]);
    const nextZoom = map.getZoom();

    if (
      lastCenterRef.current &&
      lastZoomRef.current === nextZoom &&
      mapCentersAreClose(lastCenterRef.current, nextCenter)
    ) {
      return;
    }

    lastCenterRef.current = nextCenter;
    lastZoomRef.current = nextZoom;

    onMapStateChange(nextCenter, nextZoom);
  }

  return null;
}

function MapSearchTargetController({
  target,
}: {
  target: SearchTarget | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    map.flyTo(target.center, target.zoom, { duration: 0.85 });
  }, [map, target]);

  return null;
}

function MapInstanceBridge({
  onReady,
}: {
  onReady: (map: LeafletMap) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

// Bounding box of a property's drawn hunt area, padded outward a touch so the
// saved map covers a little ground around the edges.
function boundsFromHuntArea(points: HuntAreaPoint[]): OfflineMapBounds {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latPad = 0.003;
  const lngPad = 0.003;

  return {
    south: Math.min(...lats) - latPad,
    west: Math.min(...lngs) - lngPad,
    north: Math.max(...lats) + latPad,
    east: Math.max(...lngs) + lngPad,
  };
}

export default function HuntingMap() {
  const state = useDeerIntelStore();
  const [pinType, setPinType] = useState<PinType>(
    PROPERTY_ASSET_PIN_TYPES[0],
  );
  const [mapCenter, setMapCenter] =
    useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const latestMapZoomRef = useRef(DEFAULT_MAP_ZOOM);
  // A ?layer= param (e.g. the sidebar's "LiDAR" shortcut) opens the map on that
  // base layer, and switches to it if it changes while the map is already open.
  const requestedLayer = useSearchParams().get("layer");
  const requestedLayerId =
    requestedLayer && requestedLayer in MAP_LAYER_BY_ID
      ? (requestedLayer as MapLayerId)
      : null;
  // The base layer the map opens on comes from Settings; a ?layer= param still
  // wins for that visit. Kept in a ref so changing the default in Settings while
  // the map is open doesn't yank the user off a layer they picked manually.
  const defaultLayer = useDefaultMapLayer();
  const defaultLayerRef = useRef(defaultLayer);
  useEffect(() => {
    defaultLayerRef.current = defaultLayer;
  }, [defaultLayer]);

  const [selectedLayer, setSelectedLayer] = useState<MapLayerId>(
    requestedLayerId ?? defaultLayer,
  );

  // The layer param drives the base map whenever it changes (LiDAR shortcut in,
  // plain Map out). Manual Layers-panel picks don't touch the URL, so this only
  // fires on navigation and never fights the user's own choice.
  useEffect(() => {
    setSelectedLayer(requestedLayerId ?? defaultLayerRef.current);
  }, [requestedLayerId]);
  // Data overlays from the top bar — independent of the base map, stacked on top.
  const [showContours, setShowContours] = useState(false);
  const [showSlope, setShowSlope] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  // One live-weather fetch feeds both the wind and movement overlays.
  const [forecastStatus, setForecastStatus] =
    useState<WindBadgeStatus>("loading");
  const [windData, setWindData] = useState<{
    fromCompass: string;
    speedLabel: string;
    speedMph: number | null;
    thermal: ThermalCue | null;
  } | null>(null);
  const [forecastMeta, setForecastMeta] = useState<{
    sunriseISO: string;
    sunsetISO: string;
    moonPhase?: string;
    pressureTrend?: "rising" | "steady" | "falling";
    temperature?: string;
  } | null>(null);
  const [waybackReleases, setWaybackReleases] = useState<WaybackRelease[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<string>();

  useEffect(() => {
    let active = true;

    fetchWaybackReleases().then((releases) => {
      if (!active || releases.length === 0) return;
      setWaybackReleases(releases);
      setSelectedRelease((current) => current ?? releases[0]?.release);
    });

    return () => {
      active = false;
    };
  }, []);

  const [mapTools, setMapTools] = useState<MapToolState>({
    gps: true,
    compass: true,
    scaleBar: true,
  });
  // Whether the map is locked onto the live GPS location and recenters as the
  // hunter moves. Off by default so scouting a property from home doesn't yank
  // the view to wherever the device is; the GPS button turns it on.
  const [followUser, setFollowUser] = useState(false);
  // Live device heading (degrees, 0 = N) while the compass is on — drives both
  // the compass control and the facing cone on the live-location dot.
  const [liveHeading, setLiveHeading] = useState<number | null>(null);
  // Live walk recording: while `isTracking` is on, each GPS fix is appended to
  // `activeTrackPoints` to draw the trail as the hunter moves. On stop, the
  // finished trail is saved to the property; the id/start-time captured when
  // recording began ride along in refs so a mid-walk property switch can't
  // retag or lose the walk in progress.
  const [isTracking, setIsTracking] = useState(false);
  const [activeTrackPoints, setActiveTrackPoints] = useState<WalkTrackPoint[]>(
    [],
  );
  const [trackMessage, setTrackMessage] = useState("");
  const trackPropertyIdRef = useRef("");
  const trackStartedAtRef = useRef("");
  // One switch drives the whole ownership picture: the parcel-line overlay
  // plus the statewide land-owner tiles (names + tap-to-identify).
  const [showPropertyLines, setShowPropertyLines] = useState(false);
  const [showOwnerNames, setShowOwnerNames] = useState(false);
  const [parcelLayerState, setParcelLayerState] =
    useState<ParcelBoundaryLoadState | null>(null);
  const [ownerLabelState, setOwnerLabelState] =
    useState<ParcelOwnerLabelLoadState | null>(null);
  const [parcelOwnerLookupState, setParcelOwnerLookupState] =
    useState<ParcelOwnerLookupState>(IDLE_PARCEL_OWNER_LOOKUP_STATE);
  // Parcel picked by tapping the Land Owners overlay (owner read straight from
  // the loaded tiles) — how small, label-gated parcels reveal their owner.
  const [tileOwnerPick, setTileOwnerPick] =
    useState<ParcelTileOwnerPick | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isMobileAssetSheetOpen, setIsMobileAssetSheetOpen] = useState(false);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [draftAreaPoints, setDraftAreaPoints] = useState<HuntAreaPoint[]>([]);
  const [areaCoordInput, setAreaCoordInput] = useState("");
  const [areaPointMessage, setAreaPointMessage] = useState("");
  const [showCoordEntry, setShowCoordEntry] = useState(false);
  const [pinBoxMessage, setPinBoxMessage] = useState(
    "Choose a pin type, then tap Place Pin.",
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchResults, setSearchResults] = useState<AddressSearchPlace[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<AddressSearchPlace | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [visibleAssetLayers, setVisibleAssetLayers] = useState<
    Record<AssetLayerId, boolean>
  >(createVisibleAssetLayerState);
  const isMobileMapPerformanceMode = useIsMobileMapDevice();

  const offlinePacks = useOfflineMapPacks();
  const offlineSupported = offlineMapsSupported();
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({
    phase: "idle",
  });
  // Where the current offline save was started, so the confirm/progress notice
  // shows next to that entry point (the Layers panel or the Hunt Area controls)
  // rather than in both at once.
  const [offlineOrigin, setOfflineOrigin] = useState<"panel" | "controls">(
    "panel",
  );
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const offlineControllerRef = useRef<AbortController | null>(null);
  const pendingOfflineRef = useRef<{
    bounds: OfflineMapBounds;
    sources: OfflineTileSource[];
    minZoom: number;
    maxZoom: number;
    targetLabel: string;
    propertyName: string;
  } | null>(null);

  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const selectedMapLayer = MAP_LAYER_BY_ID[selectedLayer];
  const baseTileUrl =
    selectedMapLayer.isWayback && selectedRelease
      ? waybackTileUrl(selectedRelease)
      : selectedMapLayer.url;
  // Tile sources the current base map draws from — the base layer plus any
  // reference overlays — so an offline save captures exactly what's on screen.
  const offlineTileSources = useMemo<OfflineTileSource[]>(() => {
    const base: OfflineTileSource = {
      url: baseTileUrl,
      maxNativeZoom: selectedMapLayer.maxNativeZoom ?? 19,
    };
    const overlays = (selectedMapLayer.overlayLayers ?? []).map((overlay) => ({
      url: overlay.url,
      maxNativeZoom: 19,
    }));

    return [base, ...overlays];
  }, [baseTileUrl, selectedMapLayer]);
  const showYearPicker =
    Boolean(selectedMapLayer.isWayback) && waybackReleases.length > 0;
  const currentReleaseIndex = Math.max(
    0,
    waybackReleases.findIndex((release) => release.release === selectedRelease),
  );
  const currentRelease = waybackReleases[currentReleaseIndex];

  function stepImageryYear(direction: "newer" | "older") {
    const nextIndex =
      direction === "newer"
        ? currentReleaseIndex - 1
        : currentReleaseIndex + 1;
    const next = waybackReleases[nextIndex];

    if (next) setSelectedRelease(next.release);
  }
  const pins = useMemo(
    () => state.pins.filter((pin) => pin.propertyId === selectedPropertyId),
    [selectedPropertyId, state.pins],
  );
  const propertyCameras = useMemo(
    () =>
      state.cameras.filter(
        (camera) => camera.propertyId === selectedPropertyId,
      ),
    [selectedPropertyId, state.cameras],
  );
  const walkTracks = useMemo(
    () =>
      state.walkTracks.filter(
        (track) => track.propertyId === selectedPropertyId,
      ),
    [selectedPropertyId, state.walkTracks],
  );
  const activeDistanceMeters = useMemo(
    () => walkTrackDistanceMeters(activeTrackPoints),
    [activeTrackPoints],
  );
  const mapAssets = useMemo(() => {
    const cameraAssets = propertyCameras
      .map(cameraToMapAsset)
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null);

    return [...cameraAssets, ...pins.map(pinToMapAsset)];
  }, [pins, propertyCameras]);
  const visibleAssets = mapAssets.filter((asset) =>
    asset.layerId === "other" ? true : visibleAssetLayers[asset.layerId],
  );
  const propertyStands = useMemo(
    () =>
      state.stands.filter((stand) => stand.propertyId === selectedPropertyId),
    [state.stands, selectedPropertyId],
  );
  // A stand *pin* carries a location; a saved Stand carries best/avoid winds.
  // There's no hard link, so bridge them by matching the pin's label to a
  // stand's name (case-insensitive). Matched cones get a good/avoid/marginal
  // color from today's wind; unmatched ones stay neutral.
  const windStandPoints = useMemo<WindStandPoint[]>(() => {
    const currentWind = windData?.fromCompass;
    const standByName = new Map(
      propertyStands.map((stand) => [stand.name.trim().toLowerCase(), stand]),
    );

    return visibleAssets
      .filter((asset) => asset.layerId === "stands")
      .map((asset) => {
        const match = standByName.get(asset.label.trim().toLowerCase());
        const status = match
          ? getStandWindCheck(match, currentWind).status
          : "unknown";

        return {
          id: asset.id,
          lat: asset.lat,
          lng: asset.lng,
          label: asset.label,
          status,
        };
      });
  }, [visibleAssets, propertyStands, windData?.fromCompass]);
  const windStatusSummary = useMemo(() => {
    let good = 0;
    let avoid = 0;
    let matched = 0;

    for (const point of windStandPoints) {
      if (point.status === "unknown") continue;
      matched += 1;
      if (point.status === "good") good += 1;
      if (point.status === "avoid") avoid += 1;
    }

    return { good, avoid, matched };
  }, [windStandPoints]);

  // Movement prediction: corridors are bedding→food/water links from the
  // property's own pins; direction and the outlook rating come from the shared
  // live-weather fetch.
  const beddingPoints = useMemo<BeddingPoint[]>(
    () =>
      visibleAssets
        .filter((asset) => asset.layerId === "bedding")
        .map((asset) => ({
          id: asset.id,
          lat: asset.lat,
          lng: asset.lng,
          label: asset.label,
        })),
    [visibleAssets],
  );
  const resourcePoints = useMemo<ResourcePoint[]>(
    () =>
      visibleAssets
        .filter(
          (asset) => asset.layerId === "food" || asset.layerId === "water",
        )
        .map((asset) => ({
          id: asset.id,
          lat: asset.lat,
          lng: asset.lng,
          label: asset.label,
          kind: asset.layerId === "water" ? "water" : "food",
        })),
    [visibleAssets],
  );
  const movementCorridors = useMemo(
    () => buildCorridors(beddingPoints, resourcePoints),
    [beddingPoints, resourcePoints],
  );
  const movementPeriod = useMemo(
    () =>
      forecastMeta
        ? currentMovementPeriod(
            new Date(),
            forecastMeta.sunriseISO,
            forecastMeta.sunsetISO,
          )
        : "midday",
    [forecastMeta],
  );
  // The property's own deer photos (with usable capture times) tune the outlook
  // to this ground rather than relying on generic almanac patterns alone.
  const propertyPhotoTimings = useMemo<CameraPhotoTiming[]>(
    () =>
      state.photoRecords
        .filter((photo) => photo.propertyId === selectedPropertyId)
        .map((photo) => ({
          cameraSiteId: photo.cameraSiteId,
          photoDate: photo.photoDate,
          species: photo.species,
          buckName: photo.buckName,
          deerProfileId: photo.deerProfileId,
        })),
    [state.photoRecords, selectedPropertyId],
  );
  const cameraPoints = useMemo<CameraPoint[]>(
    () =>
      propertyCameras
        .filter(
          (camera) =>
            typeof camera.latitude === "number" &&
            typeof camera.longitude === "number",
        )
        .map((camera) => ({
          id: camera.id,
          lat: camera.latitude as number,
          lng: camera.longitude as number,
        })),
    [propertyCameras],
  );
  // Rut phase runs later at southern latitudes, so anchor it to the property's
  // own location (falling back to the map center when it has none saved yet).
  const propertyLatitude = useMemo(() => {
    const point = resolvePropertyWeatherPoint(
      selectedProperty,
      propertyCameras,
      pins,
    );
    return point ? point.lat : mapCenter[0];
  }, [selectedProperty, propertyCameras, pins, mapCenter]);
  // Size the read to the drawn hunt-area outline when there is one, so the whole
  // highlighted region is analyzed instead of a fixed square around the center.
  const terrainBbox = useMemo(
    () => boundsOfHuntArea(selectedProperty?.huntArea),
    [selectedProperty?.huntArea],
  );
  // Terrain-movement prediction anchored on the ground the hunter actually
  // selected: the drawn hunt area wins, since that IS the answer to "analyze
  // here". Only fall back to the saved coordinate / placed assets when nothing
  // is drawn — a property with just an outline used to resolve to no point at
  // all, which silently skipped the read entirely.
  const terrainPoint = useMemo(
    () =>
      (terrainBbox ? centerOfBounds(terrainBbox) : null) ??
      resolvePropertyWeatherPoint(selectedProperty, propertyCameras, pins),
    [terrainBbox, selectedProperty, propertyCameras, pins],
  );
  const terrainSet = useTerrainSet(
    terrainPoint,
    selectedProperty?.name,
    terrainBbox,
  );
  const flyToTerrainPick = useCallback((point: LatLng) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo(point, Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, []);
  // Bucket history by rut phase so early-season and rut patterns don't average
  // out. Falls back to all-season photos when the current phase is still thin.
  const currentMovementPhase = useMemo(
    () => movementPhaseForDate(new Date(), propertyLatitude),
    [propertyLatitude],
  );
  const seasonalPhotos = useMemo(
    () =>
      resolveSeasonalPhotos(
        propertyPhotoTimings,
        currentMovementPhase,
        propertyLatitude,
      ),
    [propertyPhotoTimings, currentMovementPhase, propertyLatitude],
  );
  const movementOutlook = useMemo<MovementForecast | null>(() => {
    if (!forecastMeta) return null;

    const propertySignal = propertyMovementSignal(
      seasonalPhotos.photos,
      movementPeriod,
      forecastMeta.sunriseISO,
      forecastMeta.sunsetISO,
    );

    return movementForecast({
      period: movementPeriod,
      moonPhase: forecastMeta.moonPhase,
      pressureTrend: forecastMeta.pressureTrend,
      temperature: forecastMeta.temperature,
      propertySignal,
    });
  }, [forecastMeta, movementPeriod, seasonalPhotos]);
  // Push the same camera-timing signal down to each corridor via nearby cameras.
  const corridorEvidenceById = useMemo(
    () =>
      forecastMeta
        ? corridorEvidence(
            movementCorridors,
            cameraPoints,
            seasonalPhotos.photos,
            movementPeriod,
            forecastMeta.sunriseISO,
            forecastMeta.sunsetISO,
          )
        : {},
    [
      forecastMeta,
      movementCorridors,
      cameraPoints,
      seasonalPhotos,
      movementPeriod,
    ],
  );
  const hotCorridorCount = useMemo(
    () =>
      Object.values(corridorEvidenceById).filter(
        (evidence) => evidence.level === "hot",
      ).length,
    [corridorEvidenceById],
  );

  const selectedAsset = mapAssets.find((asset) => asset.id === selectedAssetId);
  const ownerNamesEnabled = showOwnerNames && !isMobileMapPerformanceMode;
  const pinBoxDisabled =
    !selectedPropertyId || ownerNamesEnabled || isDrawingArea;
  const huntArea = selectedProperty?.huntArea;
  const hasHuntArea = huntAreaIsValid(huntArea);
  const draftAreaAcresLabel = formatHuntAreaAcres(draftAreaPoints);
  const savedAreaAcresLabel = formatHuntAreaAcres(huntArea);
  const currentPinBoxMessage = pinBoxDisabled
    ? ownerNamesEnabled
      ? "Turn off Owner Names to add pins."
      : "Choose a property before placing pins."
    : isPlacingPin
      ? `Tap map to place ${pinType}`
      : pinBoxMessage;
  const mapOverlayMessages = [
    showPropertyLines ? parcelLayerState?.message : "",
    ownerNamesEnabled && parcelOwnerLookupState.status === "idle"
      ? ownerLabelState?.message
      : "",
    parcelOwnerLookupState.status !== "idle" &&
    parcelOwnerLookupState.status !== "found"
      ? parcelOwnerLookupState.message
      : "",
  ].filter((message): message is string => Boolean(message));

  const saveMapState = useCallback((center: MapCenter, zoom: number) => {
    latestMapZoomRef.current = zoom;

    setMapCenter((currentCenter) =>
      mapCentersAreClose(currentCenter, center)
        ? currentCenter
        : center,
    );
    setMapZoom((currentZoom) => (currentZoom === zoom ? currentZoom : zoom));
  }, []);

  // Auto-center when the selected property changes (including first load) so the
  // map opens on the right ground. We only key on the property id — not the
  // assets — so adding or moving a pin never yanks the view out from under the
  // user. Latest assets are kept in a ref so the fly-to point stays accurate.
  const focusInputsRef = useRef({
    selectedProperty,
    propertyCameras,
    pins,
    mapCenter,
  });

  useEffect(() => {
    focusInputsRef.current = {
      selectedProperty,
      propertyCameras,
      pins,
      mapCenter,
    };
  });

  useEffect(() => {
    if (!selectedPropertyId) return;

    const {
      selectedProperty: property,
      propertyCameras: cameras,
      pins: propertyPins,
    } = focusInputsRef.current;
    const point = resolvePropertyWeatherPoint(property, cameras, propertyPins);

    if (!point) return;

    setSearchTarget({
      center: [point.lat, point.lng],
      id: Date.now(),
      zoom: PROPERTY_FOCUS_ZOOM,
    });
  }, [selectedPropertyId]);

  // Live wind for the wind/thermal overlay. Fetch only while the layer is on
  // (and re-fetch when the property changes) so panning never spams the API —
  // the point comes from refs, and Open-Meteo responses are cached per point.
  useEffect(() => {
    if (!showWind && !showMovement) return;

    const {
      selectedProperty: property,
      propertyCameras: cameras,
      pins: propertyPins,
      mapCenter: center,
    } = focusInputsRef.current;
    const point =
      resolvePropertyWeatherPoint(property, cameras, propertyPins) ??
      { lat: center[0], lng: center[1] };

    let cancelled = false;

    fetchLiveForecast(point)
      .then((result) => {
        if (cancelled) return;

        if (result.status !== "ok") {
          setWindData(null);
          setForecastMeta(null);
          setForecastStatus("error");
          return;
        }

        const { current, sunrise, sunset, pressure } = result.forecast;
        setWindData({
          fromCompass: current.windDirection,
          speedLabel: current.windSpeed,
          speedMph: parseWindSpeed(current.windSpeed),
          thermal: thermalCue(new Date(), sunrise, sunset),
        });
        setForecastMeta({
          sunriseISO: sunrise,
          sunsetISO: sunset,
          moonPhase: current.moonPhase,
          pressureTrend: pressure?.trend,
          temperature: current.temperature,
        });
        setForecastStatus("ok");
      })
      .catch(() => {
        if (!cancelled) {
          setWindData(null);
          setForecastMeta(null);
          setForecastStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showWind, showMovement, selectedPropertyId]);

  function toggleWind() {
    setShowWind((current) => !current);
  }

  function toggleMovement() {
    setShowMovement((current) => !current);
  }

  // While recording, watch the device position and append each new fix to the
  // live trail. A small minimum-distance filter drops the jitter a GPS reports
  // while standing still so a paused walk doesn't pad the trail with noise.
  useEffect(() => {
    if (!isTracking) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: WalkTrackPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          at: new Date().toISOString(),
        };

        setActiveTrackPoints((currentPoints) => {
          const lastPoint = currentPoints[currentPoints.length - 1];

          if (
            lastPoint &&
            distanceBetweenMeters(lastPoint, point) < MIN_TRACK_POINT_METERS
          ) {
            return currentPoints;
          }

          return [...currentPoints, point];
        });
      },
      () => {
        // Hold the trail on a transient error (a brief signal drop, a denied
        // one-off read) rather than dropping what's recorded so far.
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking]);

  function startTracking() {
    if (!selectedPropertyId || isTracking) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTrackMessage("This device can't share a location.");
      return;
    }

    if (isDrawingArea) cancelAreaDraw();

    trackPropertyIdRef.current = selectedPropertyId;
    trackStartedAtRef.current = new Date().toISOString();
    setActiveTrackPoints([]);
    setTrackMessage("");
    setIsTracking(true);
    // Lock the map onto the live location so the trail stays in view as you walk.
    setFollowUser(true);

    // Recenter right away for instant feedback, then the live dot keeps it there.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          Math.max(map.getZoom(), 16),
        );
      },
      () => {
        setTrackMessage(
          "Recording started, but couldn't get a first fix. Allow location access.",
        );
      },
    );
  }

  function stopTracking() {
    if (!isTracking) return;

    setIsTracking(false);
    setFollowUser(false);

    const points = activeTrackPoints;
    const propertyId = trackPropertyIdRef.current;

    if (points.length < 2 || !propertyId) {
      setActiveTrackPoints([]);
      setTrackMessage(
        "Walk discarded — you need to move a bit for a trail to save.",
      );
      return;
    }

    const startedAt = trackStartedAtRef.current || points[0].at;
    const endedAt = points[points.length - 1].at;
    const name = `Walk · ${new Date(startedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
    const track: WalkTrack = {
      id: createDeerIntelId("track"),
      propertyId,
      name,
      points,
      startedAt,
      endedAt,
    };

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      walkTracks: [...currentState.walkTracks, track],
    }));

    setActiveTrackPoints([]);
    setTrackMessage(
      `Saved ${name} — ${formatWalkDistance(walkTrackDistanceMeters(points))}.`,
    );
  }

  function deleteWalkTrack(trackId: string) {
    if (!window.confirm("Delete this saved walk?")) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      walkTracks: currentState.walkTracks.filter(
        (track) => track.id !== trackId,
      ),
    }));
  }

  function selectProperty(propertyId: string) {
    if (isDrawingArea) cancelAreaDraw();

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  function startAreaDraw() {
    if (!selectedPropertyId) return;

    setIsPlacingPin(false);
    setIsDrawingArea(true);
    setDraftAreaPoints(huntArea ? [...huntArea] : []);
    setAreaCoordInput("");
    setAreaPointMessage("");
    setShowCoordEntry(false);
  }

  function addAreaPoint(lat: number, lng: number) {
    setDraftAreaPoints((currentPoints) => [...currentPoints, { lat, lng }]);
  }

  function addAreaPointFromInput() {
    const coordinate = parsePropertyCoordinate(areaCoordInput);

    if (!coordinate) {
      setAreaPointMessage("Enter a point as latitude, longitude.");
      return;
    }

    addAreaPoint(coordinate.latitude, coordinate.longitude);
    setAreaCoordInput("");
    setAreaPointMessage("Point added.");
  }

  function addAreaPointFromLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAreaPointMessage("This device can't share a location.");
      return;
    }

    setAreaPointMessage("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        addAreaPoint(position.coords.latitude, position.coords.longitude);
        setAreaPointMessage("Added a point at your location.");
      },
      () => setAreaPointMessage("Couldn't get your location. Allow access."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function removeAreaPoint(index: number) {
    setDraftAreaPoints((currentPoints) =>
      currentPoints.filter((_, pointIndex) => pointIndex !== index),
    );
  }

  function moveAreaPoint(index: number, lat: number, lng: number) {
    setDraftAreaPoints((currentPoints) =>
      currentPoints.map((point, pointIndex) =>
        pointIndex === index ? { lat, lng } : point,
      ),
    );
  }

  function undoAreaPoint() {
    setDraftAreaPoints((currentPoints) => currentPoints.slice(0, -1));
  }

  function cancelAreaDraw() {
    setIsDrawingArea(false);
    setDraftAreaPoints([]);
    setAreaCoordInput("");
    setAreaPointMessage("");
  }

  function finishAreaDraw() {
    if (!selectedPropertyId || !huntAreaIsValid(draftAreaPoints)) return;

    const nextArea = draftAreaPoints;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      properties: currentState.properties.map((property) =>
        property.id === selectedPropertyId
          ? { ...property, huntArea: nextArea }
          : property,
      ),
    }));
    cancelAreaDraw();
  }

  function clearHuntArea() {
    if (!selectedPropertyId) return;
    if (!window.confirm("Clear the saved hunt area for this property?")) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      properties: currentState.properties.map((property) =>
        property.id === selectedPropertyId
          ? { ...property, huntArea: undefined }
          : property,
      ),
    }));
  }

  function toggleAssetLayer(layerId: AssetLayerId) {
    setVisibleAssetLayers((currentLayers) => ({
      ...currentLayers,
      [layerId]: !currentLayers[layerId],
    }));
  }

  function toggleMapTool(toolId: MapToolId) {
    setMapTools((currentTools) => ({
      ...currentTools,
      [toolId]: !currentTools[toolId],
    }));
  }

  function togglePropertyLines() {
    const shouldShowPropertyLines = !showPropertyLines;

    setShowPropertyLines(shouldShowPropertyLines);
    // Whichever direction the toggle goes, any open parcel card is stale.
    setTileOwnerPick(null);

    if (!shouldShowPropertyLines) {
      setShowOwnerNames(false);
      setOwnerLabelState(null);
      setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE);
    }
  }

  function toggleOwnerNames() {
    if (getIsMobileMapDevice()) {
      setShowOwnerNames(false);
      setOwnerLabelState(null);
      setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE);
      return;
    }

    setShowOwnerNames((isVisible) => {
      const shouldShowOwnerNames = !isVisible;

      if (shouldShowOwnerNames) {
        setShowPropertyLines(true);
      }

      if (!shouldShowOwnerNames) {
        setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE);
      }

      return shouldShowOwnerNames;
    });
  }

  function handleTileOwnerPick(pick: ParcelTileOwnerPick | null) {
    // A parcel card replaces any open asset card; tapping empty ground just
    // dismisses the parcel card.
    if (pick) setSelectedAssetId(null);
    setTileOwnerPick(pick);
  }

  async function lookupParcelOwner(lat: number, lng: number) {
    setSelectedAssetId(null);
    setParcelOwnerLookupState({
      status: "loading",
      message: "Looking up parcel owner...",
    });

    const result = await lookupPaParcelOwnerAtPoint(lat, lng);

    setParcelOwnerLookupState(result);
  }

  async function searchAddressOrPlace(query: string) {
    setIsSearching(true);
    setSearchMessage("Searching...");
    setSearchResults([]);
    setSelectedSearchResult(null);

    try {
      const result = await geocodeAddressOrPlace(query);

      if (result.status !== "found") {
        setSearchMessage(result.message);
        return;
      }

      const firstResult = result.results[0];

      setSearchResults(result.results);
      setSearchMessage(
        result.results.length === 1
          ? "1 result found."
          : `${result.results.length} results found.`,
      );

      if (firstResult) selectSearchResult(firstResult);
    } finally {
      setIsSearching(false);
    }
  }

  function selectSearchResult(result: AddressSearchPlace) {
    setSelectedSearchResult(result);
    setSearchTarget({
      center: result.center,
      id: Date.now(),
      zoom: result.zoom,
    });
  }

  function createAssetFromSearchResult() {
    if (!selectedSearchResult) return;

    const pinId = addPin(
      pinType,
      selectedSearchResult.center[0],
      selectedSearchResult.center[1],
    );

    if (!pinId) return;

    setSelectedAssetId(`pin-${pinId}`);
    setSearchMessage(`${pinType} saved at searched location.`);
    setSearchResults([]);
    setSelectedSearchResult(null);
  }

  function updatePinType(type: PinType) {
    setPinType(type);
    setPinBoxMessage(`${type} selected. Tap Place Pin when ready.`);
  }

  function startPinPlacement() {
    if (pinBoxDisabled) return;

    setIsPlacingPin(true);
    setPinBoxMessage(`Tap map to place ${pinType}`);
    // The Pin Box lives in the Layers drawer now — close it so the map is
    // tappable for placement.
    setLayersOpen(false);
  }

  function cancelPinPlacement() {
    setIsPlacingPin(false);
    setPinBoxMessage("Pin placement canceled.");
  }

  function createPinAtLocation(type: PinType, lat: number, lng: number) {
    const notes = window.prompt(`Name or notes for this ${type}`, "");

    if (notes === null) {
      setIsPlacingPin(false);
      setPinBoxMessage("Pin placement canceled.");
      return null;
    }

    const pinId = addPin(type, lat, lng, notes.trim());

    if (!pinId) return null;

    setSelectedAssetId(`pin-${pinId}`);
    setIsPlacingPin(false);
    setPinBoxMessage(`${type} saved.`);

    return pinId;
  }

  function selectAsset(assetId: string) {
    setSelectedAssetId(assetId);
  }

  function selectAssetAndCenter(asset: MapAsset) {
    setSelectedAssetId(asset.id);
    setSearchTarget({
      center: [asset.lat, asset.lng],
      id: Date.now(),
      zoom: Math.max(latestMapZoomRef.current, 17),
    });
  }

  function centerOnAsset() {
    if (!selectedAsset) return;

    setSearchTarget({
      center: [selectedAsset.lat, selectedAsset.lng],
      id: Date.now(),
      zoom: Math.max(latestMapZoomRef.current, 17),
    });
  }

  function deleteSelectedAsset() {
    if (!selectedAsset) return;

    if (!window.confirm(`Delete ${selectedAsset.label}?`)) return;

    if (selectedAsset.source === "camera") {
      const cameraId = selectedAsset.sourceId;

      updateDeerIntelStore((currentState) => ({
        ...currentState,
        cameras: currentState.cameras.filter(
          (camera) => camera.id !== cameraId,
        ),
        cameraChecks: currentState.cameraChecks.filter(
          (check) => check.cameraId !== cameraId,
        ),
        photoRecords: currentState.photoRecords.filter(
          (photo) => photo.cameraSiteId !== cameraId,
        ),
      }));
      setSelectedAssetId(null);
      return;
    }

    if (selectedAsset.pinId) deletePin(selectedAsset.pinId);
  }

  function addPin(type: PinType, lat: number, lng: number, notes = "") {
    if (!selectedPropertyId) return null;

    const pinId = createDeerIntelId("pin");

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: [
        ...currentState.pins,
        {
          id: pinId,
          propertyId: selectedPropertyId,
          type,
          lat,
          lng,
          createdAt: new Date().toISOString(),
          notes,
        },
      ],
    }));

    return pinId;
  }

  function deletePin(pinId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: currentState.pins.filter((pin) => pin.id !== pinId),
    }));
    setSelectedAssetId((currentAssetId) =>
      currentAssetId === `pin-${pinId}` ? null : currentAssetId,
    );
  }

  // Stage an offline download: work out the tile plan for a target and show it
  // for confirmation before anything is fetched.
  function previewOfflineDownload(
    bounds: OfflineMapBounds,
    minZoom: number,
    requestedMaxZoom: number,
    targetLabel: string,
    origin: "panel" | "controls",
  ) {
    setOfflineOrigin(origin);

    const plan = planOfflinePack(
      offlineTileSources,
      bounds,
      minZoom,
      requestedMaxZoom,
    );

    if (plan.tileCount === 0) {
      setOfflineStatus({
        phase: "error",
        message: "Nothing to save for this spot. Zoom to your ground first.",
      });
      return;
    }

    pendingOfflineRef.current = {
      bounds,
      sources: offlineTileSources,
      minZoom: plan.minZoom,
      maxZoom: plan.maxZoom,
      targetLabel,
      propertyName: selectedProperty?.name ?? "Map",
    };
    setOfflineStatus({ phase: "preview", plan, targetLabel });
  }

  function saveCurrentViewOffline() {
    const map = mapInstanceRef.current;

    if (!map) {
      setOfflineStatus({
        phase: "error",
        message: "The map isn't ready yet. Try again in a moment.",
      });
      return;
    }

    const leafletBounds = map.getBounds();
    const bounds: OfflineMapBounds = {
      south: leafletBounds.getSouth(),
      west: leafletBounds.getWest(),
      north: leafletBounds.getNorth(),
      east: leafletBounds.getEast(),
    };
    // Anchor the range on the current zoom so it always spans from what's on
    // screen down to a few levels of extra detail — never an empty range.
    const baseZoom = Math.max(3, Math.min(17, Math.round(map.getZoom())));

    previewOfflineDownload(
      bounds,
      baseZoom,
      Math.min(19, baseZoom + 3),
      "this view",
      "panel",
    );
  }

  function saveHuntAreaOffline(origin: "panel" | "controls" = "panel") {
    if (!hasHuntArea || !huntArea) return;

    previewOfflineDownload(
      boundsFromHuntArea(huntArea),
      13,
      17,
      "hunt area",
      origin,
    );
  }

  async function confirmOfflineDownload() {
    const pending = pendingOfflineRef.current;

    if (!pending) return;

    const controller = new AbortController();
    offlineControllerRef.current = controller;

    setOfflineStatus({
      phase: "downloading",
      targetLabel: pending.targetLabel,
      progress: { completed: 0, total: 0, failed: 0, bytes: 0 },
    });

    try {
      const pack = await downloadOfflinePack(
        {
          propertyId: selectedPropertyId,
          propertyName: pending.propertyName,
          layerId: selectedLayer,
          layerLabel: selectedMapLayer.label,
          targetLabel: pending.targetLabel,
          bounds: pending.bounds,
          sources: pending.sources,
          minZoom: pending.minZoom,
          maxZoom: pending.maxZoom,
        },
        (progress) => {
          setOfflineStatus({
            phase: "downloading",
            targetLabel: pending.targetLabel,
            progress,
          });
        },
        controller.signal,
      );

      const skipped = pack.tileCount;
      setOfflineStatus({
        phase: "done",
        message: `Saved ${pending.targetLabel} — ${skipped.toLocaleString()} tiles ready offline.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setOfflineStatus({ phase: "idle" });
      } else {
        setOfflineStatus({
          phase: "error",
          message:
            "Couldn't finish the download. Check your connection and try again.",
        });
      }
    } finally {
      offlineControllerRef.current = null;
      pendingOfflineRef.current = null;
    }
  }

  function cancelOfflineDownload() {
    offlineControllerRef.current?.abort();
    pendingOfflineRef.current = null;
    setOfflineStatus({ phase: "idle" });
  }

  async function removeOfflinePack(id: string) {
    if (!window.confirm("Delete this saved offline map?")) return;

    await deleteOfflinePack(id);
  }

  // Walk tracking now lives in the Layers drawer rather than a panel above the
  // map, so build its UI here and hand it to MapLayerManager.
  const walkTrackingSection = (
    <div style={huntAreaControlStyle}>
      {isTracking ? (
        <>
          <div style={huntAreaHeaderStyle}>
            <span style={walkRecordingBadgeStyle}>
              <span style={walkRecordingDotStyle} />
              Recording
            </span>
          </div>
          <p style={helpTextStyle}>
            Recording your path — keep the app open as you walk. The trail draws
            live on the map. Tap Stop when you&apos;re done.
          </p>
          <div style={walkStatRowStyle}>
            <span style={walkStatValueStyle}>
              {formatWalkDistance(activeDistanceMeters)}
            </span>
            <span style={walkStatLabelStyle}>
              {activeTrackPoints.length} point
              {activeTrackPoints.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button type="button" variant="danger" onClick={stopTracking}>
            Stop Tracking
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={startTracking}
          disabled={!selectedPropertyId}
        >
          Start Tracking
        </Button>
      )}

      {trackMessage ? (
        <p style={areaPointMessageStyle}>{trackMessage}</p>
      ) : null}

      {walkTracks.length > 0 ? (
        <ul style={walkTrackListStyle}>
          {walkTracks.map((track) => (
            <li key={track.id} style={walkTrackRowStyle}>
              <div style={walkTrackInfoStyle}>
                <span style={walkTrackNameStyle}>{track.name}</span>
                <span style={walkTrackMetaStyle}>
                  {formatWalkDistance(walkTrackDistanceMeters(track.points))}
                  {" · "}
                  {formatWalkDuration(track.startedAt, track.endedAt)}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Delete ${track.name}`}
                style={areaPointRemoveStyle}
                onClick={() => deleteWalkTrack(track.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const scoutPanelOpen = scoutOpen || isDrawingArea;

  return (
    <div className="di-map-layout" style={mapLayoutStyle}>
      <div className="di-map-scout" style={scoutOverlayStyle}>
        <div style={scoutHeaderStyle}>
          <select
            aria-label="Property"
            style={scoutSelectStyle}
            value={selectedPropertyId}
            onChange={(event) => selectProperty(event.target.value)}
          >
            {state.properties.length === 0 ? (
              <option value="">No properties saved</option>
            ) : null}
            {state.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={{
              ...scoutToggleStyle,
              ...(scoutPanelOpen ? scoutToggleActiveStyle : null),
            }}
            aria-expanded={scoutPanelOpen}
            onClick={() => setScoutOpen((current) => !current)}
          >
            {scoutPanelOpen ? "Close" : "Hunt Area"}
          </button>
        </div>

        {scoutPanelOpen ? (
          <div style={scoutBodyStyle}>
            <div style={huntAreaControlStyle}>
          <div style={huntAreaHeaderStyle}>
            <span style={labelTextStyle}>Hunt Area</span>
            {hasHuntArea && !isDrawingArea && savedAreaAcresLabel ? (
              <span style={huntAreaBadgeStyle}>{savedAreaAcresLabel}</span>
            ) : null}
            {isDrawingArea ? (
              <span style={huntAreaBadgeStyle}>
                {draftAreaPoints.length} point
                {draftAreaPoints.length === 1 ? "" : "s"}
                {draftAreaAcresLabel ? ` · ${draftAreaAcresLabel}` : ""}
              </span>
            ) : null}
          </div>

          {isDrawingArea ? (
            <>
              <p style={helpTextStyle}>
                Tap the map to drop each corner around your ground. They connect
                automatically as you go — add as many as it takes, and drag any
                point to fine-tune it.
              </p>

              {draftAreaPoints.length > 0 ? (
                <ol style={areaPointListStyle}>
                  {draftAreaPoints.map((point, index) => (
                    <li key={`point-${index}`} style={areaPointRowStyle}>
                      <span style={areaPointNumberStyle}>{index + 1}</span>
                      <span style={areaPointCoordStyle}>
                        {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove point ${index + 1}`}
                        style={areaPointRemoveStyle}
                        onClick={() => removeAreaPoint(index)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p style={areaEmptyHintStyle}>
                  Tap the map to drop your first corner.
                </p>
              )}

              <div style={huntAreaButtonRowStyle}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addAreaPointFromLocation}
                >
                  Add my location
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={undoAreaPoint}
                  disabled={draftAreaPoints.length === 0}
                >
                  Undo last
                </Button>
              </div>

              <button
                type="button"
                style={coordToggleStyle}
                onClick={() => setShowCoordEntry((current) => !current)}
              >
                {showCoordEntry
                  ? "Hide coordinate entry"
                  : "Add a point by coordinates instead"}
              </button>

              {showCoordEntry ? (
                <div style={areaAddRowStyle}>
                  <input
                    style={areaCoordInputStyle}
                    placeholder="Lat, Lng (e.g. 41.40000, -78.20000)"
                    value={areaCoordInput}
                    onChange={(event) => setAreaCoordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addAreaPointFromInput();
                      }
                    }}
                  />
                  <Button type="button" onClick={addAreaPointFromInput}>
                    Add point
                  </Button>
                </div>
              ) : null}

              {areaPointMessage ? (
                <p style={areaPointMessageStyle}>{areaPointMessage}</p>
              ) : null}

              <div style={huntAreaButtonRowStyle}>
                <Button
                  type="button"
                  onClick={finishAreaDraw}
                  disabled={draftAreaPoints.length < 3}
                >
                  Save Area
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelAreaDraw}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p style={helpTextStyle}>
                {hasHuntArea
                  ? "Your hunt area is highlighted on the map. Edit the points or clear it anytime."
                  : "Add points around the ground you hunt and they connect into a highlighted area, like a property boundary."}
              </p>
              <div style={huntAreaButtonRowStyle}>
                <Button
                  type="button"
                  onClick={startAreaDraw}
                  disabled={!selectedPropertyId}
                >
                  {hasHuntArea ? "Edit Area Points" : "Add Area Points"}
                </Button>
                {hasHuntArea ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={clearHuntArea}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              {hasHuntArea && offlineSupported ? (
                <div style={huntAreaOfflineStyle}>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => saveHuntAreaOffline("controls")}
                    disabled={
                      offlineOrigin === "controls" &&
                      offlineStatus.phase === "downloading"
                    }
                  >
                    Save this area offline
                  </Button>
                  {offlineOrigin === "controls" ? (
                    <OfflineDownloadStatus
                      status={offlineStatus}
                      onConfirm={confirmOfflineDownload}
                      onCancel={cancelOfflineDownload}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          )}
            </div>

            <p style={helpTextStyle}>
              Use the Pin Box on the map to add cameras, stands, sign, trails,
              parking, and gates.
            </p>
          </div>
        ) : null}
      </div>

      <div className="di-map-stage" style={mapStageStyle}>
        <div className="di-map-frame" style={mapFrameStyle}>
          <MapSearchBar
            canCreateAsset={selectedSearchResult !== null}
            isSearching={isSearching}
            message={searchMessage}
            results={searchResults}
            selectedAssetType={pinType}
            selectedResultId={selectedSearchResult?.id ?? null}
            biasCenter={mapCenter}
            onCreateAssetHere={createAssetFromSearchResult}
            onSearch={searchAddressOrPlace}
            onSelectResult={selectSearchResult}
          />

          <MapTopBar
            selectedLayer={selectedLayer}
            showContours={showContours}
            contourNeedsZoomIn={showContours && mapZoom < CONTOUR_MIN_ZOOM}
            showSlope={showSlope}
            showPropertyOwners={showPropertyLines}
            showWind={showWind}
            showMovement={showMovement}
            showTerrain={showTerrain}
            onSelectLayer={setSelectedLayer}
            onToggleContours={() => setShowContours((current) => !current)}
            onToggleSlope={() => setShowSlope((current) => !current)}
            onTogglePropertyOwners={togglePropertyLines}
            onToggleWind={toggleWind}
            onToggleMovement={toggleMovement}
            onToggleTerrain={() => setShowTerrain((current) => !current)}
          />

          {showWind ? (
            <WindThermalBadge
              status={forecastStatus}
              windFromCompass={windData?.fromCompass ?? ""}
              speedLabel={windData?.speedLabel ?? ""}
              thermal={windData?.thermal ?? null}
              standCount={windStandPoints.length}
              goodCount={windStatusSummary.good}
              avoidCount={windStatusSummary.avoid}
              matchedCount={windStatusSummary.matched}
            />
          ) : null}

          {showMovement ? (
            <MovementBadge
              status={forecastStatus}
              forecast={movementOutlook}
              corridorCount={movementCorridors.length}
              direction={corridorDirection(movementPeriod)}
              hasBedding={beddingPoints.length > 0}
              hasResources={resourcePoints.length > 0}
              personalized={movementOutlook?.personalized ?? false}
              sampleSize={movementOutlook?.sampleSize ?? 0}
              hotCorridorCount={hotCorridorCount}
              phaseLabel={movementPhaseLabel(currentMovementPhase)}
              phaseScoped={seasonalPhotos.scope === "phase"}
              regionLabel={rutRegionLabel(propertyLatitude)}
              rutShiftDays={rutShiftDays(propertyLatitude)}
            />
          ) : null}

          {showYearPicker ? (
            <div className="di-map-year" style={yearStepperStyle}>
              <button
                type="button"
                aria-label="Newer imagery"
                onClick={() => stepImageryYear("newer")}
                disabled={currentReleaseIndex <= 0}
                style={{
                  ...yearStepButtonStyle,
                  ...(currentReleaseIndex <= 0 ? yearStepDisabledStyle : null),
                }}
              >
                ▲
              </button>
              <div style={yearStepValueStyle}>
                <span style={yearStepLabelStyle}>
                  {currentReleaseIndex === 0 ? "Now" : "Imagery"}
                </span>
                <span style={yearStepYearStyle}>{currentRelease?.year}</span>
              </div>
              <button
                type="button"
                aria-label="Older imagery"
                onClick={() => stepImageryYear("older")}
                disabled={currentReleaseIndex >= waybackReleases.length - 1}
                style={{
                  ...yearStepButtonStyle,
                  ...(currentReleaseIndex >= waybackReleases.length - 1
                    ? yearStepDisabledStyle
                    : null),
                }}
              >
                ▼
              </button>
            </div>
          ) : null}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            maxZoom={19}
            zoomControl={false}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <CachedTileLayer
              key={`${selectedMapLayer.id}-base-${selectedRelease ?? "static"}`}
              className={selectedMapLayer.className}
              attribution={selectedMapLayer.attribution}
              url={baseTileUrl}
              maxZoom={19}
              maxNativeZoom={selectedMapLayer.maxNativeZoom ?? 19}
            />

            {selectedMapLayer.overlayLayers?.map((overlayLayer, index) => (
              <CachedTileLayer
                key={`${selectedMapLayer.id}-${overlayLayer.label}`}
                className={overlayLayer.className}
                attribution={overlayLayer.attribution}
                url={overlayLayer.url}
                maxZoom={19}
                maxNativeZoom={19}
                opacity={overlayLayer.opacity ?? 1}
                zIndex={650 + index}
              />
            ))}

            {showSlope ? (
              <WMSTileLayer
                key="slope-overlay"
                className="di-slope-overlay"
                url={SLOPE_WMS_URL}
                layers={SLOPE_WMS_LAYER}
                styles="default"
                format="image/png"
                transparent
                version="1.3.0"
                opacity={0.5}
                zIndex={690}
                maxZoom={19}
                // Only fetch when the map settles, and never mid-zoom, so
                // zooming out doesn't fire a storm of WMS requests that blocks
                // the main thread. keepBuffer trimmed to hold fewer offscreen
                // tiles in memory.
                updateWhenIdle
                updateWhenZooming={false}
                keepBuffer={1}
                attribution={SLOPE_ATTRIBUTION}
              />
            ) : null}

            {showContours && mapZoom < CONTOUR_FINE_ZOOM ? (
              /* Zoomed out: a sparse white 100-ft overview so the map reads
                 through instead of drowning in a white blur. */
              <SuperWMSTileLayer
                key="contours-coarse"
                className="di-contour-line-white"
                url={CONTOUR_WMS_URL}
                layers={CONTOUR_WMS_COARSE_LINES}
                format="image/png"
                transparent
                version="1.3.0"
                opacity={0.9}
                zIndex={695}
                minZoom={CONTOUR_MIN_ZOOM}
                maxZoom={CONTOUR_FINE_ZOOM - 1}
                superSample={2}
                updateWhenIdle
                updateWhenZooming={false}
                keepBuffer={1}
                attribution={CONTOUR_ATTRIBUTION}
              />
            ) : null}

            {showContours && mapZoom >= CONTOUR_FINE_ZOOM ? (
              <>
                {/* Zoomed in: thin white 25-ft contour lines, supersampled so
                    they stay smooth instead of pixelated at device resolution. */}
                <SuperWMSTileLayer
                  key="contours-fine"
                  className="di-contour-line-white"
                  url={CONTOUR_FINE_WMS_URL}
                  layers={CONTOUR_FINE_WMS_LAYER}
                  styles="default"
                  format="image/png"
                  transparent
                  version="1.3.0"
                  opacity={0.9}
                  zIndex={695}
                  minZoom={CONTOUR_FINE_ZOOM}
                  maxZoom={19}
                  superSample={2}
                  updateWhenIdle
                  updateWhenZooming={false}
                  keepBuffer={1}
                />
                {/* Elevation numbers as our own bold, dark-outlined labels
                    (queried from the index-contour features), not from the
                    raster — so the contour lines above stay all white while the
                    numbers stay crisp and legible at any screen density. */}
                <ContourLabels minZoom={CONTOUR_FINE_ZOOM} />
              </>
            ) : null}

            {showWind && forecastStatus === "ok" && windData ? (
              <WindThermalLayer
                standPoints={windStandPoints}
                windFromCompass={windData.fromCompass}
                speedMph={windData.speedMph}
              />
            ) : null}

            {showMovement ? (
              <MovementLayer
                corridors={movementCorridors}
                period={movementPeriod}
                evidenceById={corridorEvidenceById}
              />
            ) : null}

            {showTerrain && terrainSet ? (
              <TerrainMovementLayer set={terrainSet} />
            ) : null}

            <MapInstanceBridge
              onReady={(map) => {
                mapInstanceRef.current = map;
              }}
            />

            <ParcelBoundaryLayer
              enabled={showPropertyLines}
              propertyId={selectedPropertyId}
              onStateChange={setParcelLayerState}
            />
            <ParcelOwnerLabelLayer
              enabled={showPropertyLines && ownerNamesEnabled}
              propertyId={selectedPropertyId}
              onStateChange={setOwnerLabelState}
            />
            <ParcelTilesLayer
              enabled={showPropertyLines}
              pickEnabled={!isPlacingPin && !isDrawingArea}
              onOwnerPick={handleTileOwnerPick}
            />

            <MapSearchTargetController target={searchTarget} />
            <MapStateTracker onMapStateChange={saveMapState} />
            <MapControlButtons
              showCompass={mapTools.compass}
              showGps={mapTools.gps}
              isFollowing={mapTools.gps && followUser}
              onToggleFollow={setFollowUser}
              onHeadingChange={setLiveHeading}
            />
            <UserLocationMarker
              enabled={mapTools.gps}
              follow={mapTools.gps && followUser}
              heading={liveHeading}
              onUserPan={() => setFollowUser(false)}
            />
            <WalkTrackLayer
              tracks={walkTracks}
              activePoints={activeTrackPoints}
              isTracking={isTracking}
            />
            {mapTools.scaleBar ? (
              <ScaleControl imperial metric position="bottomleft" />
            ) : null}
            <MapPinDropTarget
              enabled={!pinBoxDisabled}
              onDropPin={createPinAtLocation}
            />

            <ClickToAddPin
              enabled={isPlacingPin && !pinBoxDisabled}
              pinType={pinType}
              propertyId={selectedPropertyId}
              onAddPin={createPinAtLocation}
            />
            <ClickToLookupParcelOwner
              enabled={showPropertyLines && ownerNamesEnabled && !isDrawingArea}
              onLookup={lookupParcelOwner}
            />
            <ClickToDrawArea
              enabled={isDrawingArea}
              onAddPoint={addAreaPoint}
            />

            {hasHuntArea && huntArea && !isDrawingArea ? (
              <Polygon
                positions={huntArea.map((point) => [point.lat, point.lng])}
                pathOptions={HUNT_AREA_PATH_OPTIONS}
              />
            ) : null}

            {isDrawingArea && draftAreaPoints.length >= 3 ? (
              <Polygon
                positions={draftAreaPoints.map((point) => [
                  point.lat,
                  point.lng,
                ])}
                pathOptions={HUNT_AREA_DRAFT_PATH_OPTIONS}
              />
            ) : null}

            {isDrawingArea && draftAreaPoints.length === 2 ? (
              <Polyline
                positions={draftAreaPoints.map((point) => [
                  point.lat,
                  point.lng,
                ])}
                pathOptions={HUNT_AREA_DRAFT_PATH_OPTIONS}
              />
            ) : null}

            {isDrawingArea
              ? draftAreaPoints.map((point, index) => (
                  <Marker
                    key={`draft-${index}`}
                    position={[point.lat, point.lng]}
                    icon={huntAreaVertexIcon(index + 1)}
                    draggable
                    eventHandlers={{
                      dragend: (event) => {
                        const latlng = event.target?.getLatLng();
                        if (!latlng) return;
                        moveAreaPoint(index, latlng.lat, latlng.lng);
                      },
                    }}
                  />
                ))
              : null}

            {visibleAssets.map((asset) => (
              <PropertyMapAssetMarker
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onSelect={() => selectAsset(asset.id)}
              />
            ))}

            {selectedSearchResult ? (
              <MapSearchResultMarker
                assetType={pinType}
                result={selectedSearchResult}
                onCreateAssetHere={createAssetFromSearchResult}
              />
            ) : null}
          </MapContainer>

          {showSlope ? (
            <div className="di-slope-legend" aria-label="Slope angle key">
              <span className="di-slope-legend-title">Slope angle</span>
              <div className="di-slope-legend-bar" />
              <div className="di-slope-legend-ticks">
                <span>Flat</span>
                <span>15°</span>
                <span>30°</span>
                <span>45°+</span>
              </div>
            </div>
          ) : null}

          {showTerrain && terrainSet ? <TerrainLegend /> : null}

          {showTerrain ? (
            <ScoutPicksPanel set={terrainSet} onSelect={flyToTerrainPick} />
          ) : null}

          <MapLayerManager
            open={layersOpen}
            onOpenChange={setLayersOpen}
            mapTools={mapTools}
            pinBoxSection={
              <MapPinBox
                disabled={pinBoxDisabled}
                isPlacing={isPlacingPin}
                message={currentPinBoxMessage}
                pinType={pinType}
                onCancelPlacement={cancelPinPlacement}
                onPinTypeChange={updatePinType}
                onStartPlacement={startPinPlacement}
              />
            }
            trackingSection={walkTrackingSection}
            offlineSection={
              <OfflineMapsPanel
                supported={offlineSupported}
                layerLabel={selectedMapLayer.label}
                packs={offlinePacks}
                status={
                  offlineOrigin === "panel"
                    ? offlineStatus
                    : { phase: "idle" }
                }
                onSaveView={saveCurrentViewOffline}
                onConfirm={confirmOfflineDownload}
                onCancel={cancelOfflineDownload}
                onDelete={removeOfflinePack}
              />
            }
            ownerNamesDisabled={isMobileMapPerformanceMode}
            showOwnerNames={ownerNamesEnabled}
            visibleAssetLayers={visibleAssetLayers}
            onToggleLayer={toggleAssetLayer}
            onToggleMapTool={toggleMapTool}
            onToggleOwnerNames={toggleOwnerNames}
          />

          {mapOverlayMessages.length > 0 ? (
            <div className="di-map-notice" style={propertyLinesNoticeStyle}>
              {mapOverlayMessages.join(" ")}
            </div>
          ) : null}

          {isPlacingPin && !isDrawingArea ? (
            <div className="di-area-pill" style={drawActionBarStyle}>
              <span style={drawActionStatusStyle}>
                Tap map to place {pinType}
              </span>
              <div style={drawActionButtonRowStyle}>
                <button
                  type="button"
                  style={drawSecondaryButtonStyle}
                  onClick={cancelPinPlacement}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {isDrawingArea ? (
            <div className="di-area-pill" style={drawActionBarStyle}>
              <span style={drawActionStatusStyle}>
                {draftAreaPoints.length < 3
                  ? `Tap the map · ${draftAreaPoints.length}/3`
                  : `${draftAreaPoints.length} points${
                      draftAreaAcresLabel ? ` · ${draftAreaAcresLabel}` : ""
                    }`}
              </span>
              <div style={drawActionButtonRowStyle}>
                <button
                  type="button"
                  style={drawSecondaryButtonStyle}
                  onClick={undoAreaPoint}
                  disabled={draftAreaPoints.length === 0}
                >
                  Undo
                </button>
                <button
                  type="button"
                  style={drawSecondaryButtonStyle}
                  onClick={cancelAreaDraw}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={
                    draftAreaPoints.length < 3
                      ? { ...drawPrimaryButtonStyle, ...drawDisabledButtonStyle }
                      : drawPrimaryButtonStyle
                  }
                  onClick={finishAreaDraw}
                  disabled={draftAreaPoints.length < 3}
                >
                  Save Area
                </button>
              </div>
            </div>
          ) : null}

          {isTracking ? (
            <div className="di-area-pill" style={drawActionBarStyle}>
              <span style={drawActionStatusStyle}>
                <span style={walkRecordingDotStyle} />
                {formatWalkDistance(activeDistanceMeters)} ·{" "}
                {activeTrackPoints.length} pt
              </span>
              <div style={drawActionButtonRowStyle}>
                <button
                  type="button"
                  style={drawPrimaryButtonStyle}
                  onClick={stopTracking}
                >
                  Stop
                </button>
              </div>
            </div>
          ) : null}

          <MapAssetSelectorPanel
            assets={visibleAssets}
            isMobileOpen={isMobileAssetSheetOpen}
            selectedAssetId={selectedAssetId}
            onCloseMobile={() => setIsMobileAssetSheetOpen(false)}
            onOpenMobile={() => setIsMobileAssetSheetOpen(true)}
            onSelectAsset={selectAssetAndCenter}
          />

          {selectedAsset && selectedProperty ? (
            <MapAssetInfoCard
              key={selectedAsset.id}
              asset={selectedAsset}
              detailRoute={getAssetDetailHref(
                selectedAsset,
                selectedPropertyId,
              )}
              editRoute={getAssetEditHref(selectedAsset, selectedPropertyId)}
              propertyName={selectedProperty.name}
              onCenter={centerOnAsset}
              onClose={() => setSelectedAssetId(null)}
              onDelete={deleteSelectedAsset}
            />
          ) : null}

          {parcelOwnerLookupState.status === "found" &&
          parcelOwnerLookupState.parcel ? (
            <ParcelOwnerInfoCard
              ownerName={parcelOwnerLookupState.parcel.ownerName}
              lines={[
                {
                  label: "County",
                  value: `${parcelOwnerLookupState.parcel.countyName} County`,
                },
                {
                  label: "Parcel ID",
                  value: parcelOwnerLookupState.parcel.parcelId ?? "Not listed",
                },
                {
                  label: "Address",
                  value: parcelOwnerLookupState.parcel.address ?? "Not listed",
                },
                {
                  label: "Acres",
                  value: parcelOwnerLookupState.parcel.acreage ?? "Not listed",
                },
                {
                  label: "Source",
                  value: parcelOwnerLookupState.parcel.providerName,
                },
              ]}
              onClose={() =>
                setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE)
              }
            />
          ) : null}

          {tileOwnerPick ? (
            <ParcelOwnerInfoCard
              ownerName={tileOwnerPick.ownerName}
              lines={[
                {
                  label: "Acres",
                  value: ownerAcresText(tileOwnerPick.acres) || "Not listed",
                },
                {
                  label: "Land",
                  value: tileOwnerPick.isPublic
                    ? "Public / government"
                    : "Private",
                },
              ]}
              onClose={() => setTileOwnerPick(null)}
            />
          ) : null}
        </div>
      </div>

    </div>
  );
}

const mapLayoutStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "1rem",
};

const mapStageStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "0.75rem",
  order: 1,
};

// "Scout the Property" is now a floating panel anchored to the bottom-left of
// the map itself, so the map can fill the whole page with nothing above or
// below it. The property picker stays visible in the header; the hunt-area
// tools live behind the toggle.
const scoutOverlayStyle: CSSProperties = {
  position: "absolute",
  left: "1rem",
  bottom: "1.25rem",
  zIndex: 1100,
  width: "min(300px, calc(100% - 2rem))",
  maxHeight: "calc(100% - 2.5rem)",
  display: "grid",
  gap: "0.5rem",
  padding: "0.4rem",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "10px",
  background: "rgba(255, 255, 255, 0.96)",
  color: "var(--text)",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
  overflow: "hidden",
};

const scoutHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

const scoutSelectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: "34px",
  padding: "0.3rem 0.45rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const scoutToggleStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "34px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 0.65rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const scoutToggleActiveStyle: CSSProperties = {
  borderColor: "#265c30",
  background: "#2f6d3a",
  color: "#f2f9f2",
};

const scoutBodyStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
  maxHeight: "min(52vh, 420px)",
  overflowY: "auto",
  paddingTop: "0.6rem",
  borderTop: "1px solid var(--border)",
};

const labelTextStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "1rem",
  lineHeight: 1.5,
};

const mapFrameStyle: CSSProperties = {
  position: "relative",
  height: "clamp(520px, 80vh, 960px)",
  overflow: "hidden",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
};

const yearStepperStyle: CSSProperties = {
  position: "absolute",
  top: "5.1rem",
  left: "1rem",
  zIndex: 1000,
  display: "grid",
  justifyItems: "center",
  gap: "0.25rem",
  padding: "0.4rem 0.45rem",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: "12px",
  background: "rgba(17, 23, 17, 0.55)",
  backdropFilter: "blur(4px)",
  color: "#f3f1e6",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.3)",
};

const yearStepButtonStyle: CSSProperties = {
  width: "42px",
  minHeight: "28px",
  padding: 0,
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.1)",
  color: "#f3f1e6",
  fontSize: "0.72rem",
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
};

const yearStepDisabledStyle: CSSProperties = {
  opacity: 0.3,
  cursor: "not-allowed",
};

const yearStepValueStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.05rem",
  padding: "0.1rem 0",
};

const yearStepLabelStyle: CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "rgba(243, 241, 230, 0.75)",
};

const yearStepYearStyle: CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 900,
  lineHeight: 1,
};

const mapControlsStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  right: "1rem",
  zIndex: 1000,
  display: "grid",
  gap: "0.45rem",
};

const mapControlButtonStyle: CSSProperties = {
  width: "46px",
  minHeight: "46px",
  border: "1px solid rgba(25, 34, 25, 0.38)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.94)",
  color: "#111711",
  fontSize: "1.25rem",
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
};

const gpsButtonStyle: CSSProperties = {
  width: "58px",
  fontSize: "0.78rem",
};

// While the map is locked onto the live location, the GPS button lights up in
// the app's hunter-green so it reads clearly as an active "following" state.
const gpsButtonActiveStyle: CSSProperties = {
  background: "#2f6d3a",
  color: "#f2f9f2",
  borderColor: "#265c30",
};

const compassButtonStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 0,
  cursor: "default",
  lineHeight: 1,
};

const compassNeedleStyle: CSSProperties = {
  marginBottom: "-0.18rem",
  color: "#2f6d3a",
  fontSize: "0.82rem",
  fontWeight: 900,
};

const compassTextStyle: CSSProperties = {
  color: "#111711",
  fontSize: "0.88rem",
  fontWeight: 900,
};

// Live-heading arrow: points the way you're facing on the north-up map, so it
// rotates by the device heading. A short transition keeps the spin smooth.
const compassArrowStyle: CSSProperties = {
  color: "#c2410c",
  fontSize: "1.15rem",
  lineHeight: 1,
  transformOrigin: "center",
  transition: "transform 0.12s ease-out",
};

const compassFacingStyle: CSSProperties = {
  marginTop: "-0.05rem",
  color: "#111711",
  fontSize: "0.72rem",
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const compassActiveStyle: CSSProperties = {
  borderColor: "#c2410c",
  background: "#fff4ec",
};

const propertyLinesNoticeStyle: CSSProperties = {
  position: "absolute",
  left: "1rem",
  top: "5rem",
  zIndex: 1000,
  maxWidth: "min(360px, calc(100% - 2rem))",
  padding: "0.7rem 0.85rem",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.94)",
  color: "#111711",
  fontSize: "0.92rem",
  fontWeight: 800,
  lineHeight: 1.35,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
  // Informational only — never intercept map taps.
  pointerEvents: "none",
};

const huntAreaControlStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  padding: "0.85rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface-2)",
};

const huntAreaHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  flexWrap: "wrap",
};

const huntAreaBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.25rem 0.6rem",
  borderRadius: "999px",
  border: "1px solid var(--accent-tint-border)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const huntAreaButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
};

const huntAreaOfflineStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  marginTop: "0.6rem",
};

const walkRecordingBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.25rem 0.6rem",
  borderRadius: "999px",
  border: "1px solid var(--accent-2-tint-border)",
  background: "var(--accent-2-tint)",
  color: "var(--accent-2-text)",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const walkRecordingDotStyle: CSSProperties = {
  display: "inline-block",
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: "var(--accent-2)",
  boxShadow: "0 0 0 3px rgba(224, 100, 42, 0.25)",
};

const walkStatRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.5rem",
};

const walkStatValueStyle: CSSProperties = {
  fontSize: "1.4rem",
  fontWeight: 800,
  color: "var(--text)",
};

const walkStatLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const walkTrackListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.35rem",
  maxHeight: "180px",
  overflowY: "auto",
};

const walkTrackRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.6rem",
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
};

const walkTrackInfoStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  minWidth: 0,
};

const walkTrackNameStyle: CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 700,
  color: "var(--text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const walkTrackMetaStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--text-muted)",
  fontWeight: 600,
};

const areaPointListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.35rem",
  maxHeight: "180px",
  overflowY: "auto",
};

const areaPointRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.35rem 0.5rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const areaPointNumberStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "22px",
  height: "22px",
  borderRadius: "999px",
  background: "var(--accent)",
  color: "#ffffff",
  fontSize: "0.8rem",
  fontWeight: 800,
};

const areaPointCoordStyle: CSSProperties = {
  flex: 1,
  color: "var(--text)",
  fontSize: "0.9rem",
  fontVariantNumeric: "tabular-nums",
};

const areaPointRemoveStyle: CSSProperties = {
  minWidth: "30px",
  height: "30px",
  borderRadius: "8px",
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  fontSize: "1.1rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};

const areaEmptyHintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.9rem",
};

const areaAddRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
  alignItems: "center",
};

const areaCoordInputStyle: CSSProperties = {
  flex: 1,
  minWidth: "180px",
  minHeight: "44px",
  padding: "0.6rem 0.7rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.95rem",
};

const areaPointMessageStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.85rem",
};

const coordToggleStyle: CSSProperties = {
  justifySelf: "start",
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
};

// Floating control at the bottom of the map while drawing an area: shows the
// point/acre status and puts Save/Undo/Cancel right where the hunter is
// tapping, so a finished area can be saved without scrolling to the side panel.
const drawActionBarStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "0.6rem",
  transform: "translateX(-50%)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.4rem",
  width: "fit-content",
  maxWidth: "calc(100% - 1.5rem)",
  padding: "0.5rem 0.7rem",
  border: "1px solid rgba(122, 194, 255, 0.55)",
  borderRadius: "12px",
  background: "rgba(9, 24, 40, 0.92)",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
};

const drawActionStatusStyle: CSSProperties = {
  color: "#dcefff",
  fontSize: "0.82rem",
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const drawActionButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

const drawSecondaryButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.4rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid #35506e",
  background: "#12233a",
  color: "#cfe2f5",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const drawPrimaryButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.4rem 1.1rem",
  borderRadius: "8px",
  border: "1px solid #2f8f4a",
  background: "#1f7a37",
  color: "#ffffff",
  fontSize: "0.95rem",
  fontWeight: 800,
  cursor: "pointer",
};

const drawDisabledButtonStyle: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

