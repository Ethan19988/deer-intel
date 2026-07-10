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
  useMap,
  useMapEvents,
} from "react-leaflet";
import CachedTileLayer from "@/components/map/CachedTileLayer";
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
import LandOwnerLayer from "@/components/map/LandOwnerLayer";
import ParcelTilesLayer from "@/components/map/ParcelTilesLayer";
import MapSearchBar from "@/components/map/MapSearchBar";
import MapSearchResultMarker from "@/components/map/MapSearchResultMarker";
import OfflineDownloadStatus from "@/components/map/OfflineDownloadStatus";
import OfflineMapsPanel, {
  type OfflineStatus,
} from "@/components/map/OfflineMapsPanel";
import PropertyMapAssetMarker from "@/components/map/PropertyMapAssetMarker";
import {
  createDeerIntelId,
  PROPERTY_ASSET_PIN_TYPES,
  type PinType,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { formatHuntAreaAcres, huntAreaIsValid } from "@/lib/huntArea";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
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
  formatCoordinate,
  getAssetDetailHref,
  getAssetEditHref,
  geocodeAddressOrPlace,
  MAP_LAYER_BY_ID,
  pinToMapAsset,
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
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

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
}: {
  showCompass: boolean;
  showGps: boolean;
}) {
  const map = useMap();

  function locateUser() {
    if (!navigator.geolocation) {
      alert("GPS is not supported on this device.");
      return;
    }

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
  }

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
          aria-label="Compass north indicator"
          className="di-map-control-button di-map-compass"
          role="img"
          style={{ ...mapControlButtonStyle, ...compassButtonStyle }}
          title="Compass"
        >
          <span style={compassNeedleStyle}>^</span>
          <span style={compassTextStyle}>N</span>
        </div>
      ) : null}
      {showGps ? (
        <button
          type="button"
          aria-label="Locate me"
          className="di-map-control-button di-map-gps-button"
          style={{ ...mapControlButtonStyle, ...gpsButtonStyle }}
          onClick={locateUser}
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
  const [selectedLayer, setSelectedLayer] = useState<MapLayerId>(
    requestedLayerId ?? "hybrid",
  );

  // The layer param drives the base map whenever it changes (LiDAR shortcut in,
  // plain Map out). Manual Layers-panel picks don't touch the URL, so this only
  // fires on navigation and never fights the user's own choice.
  useEffect(() => {
    setSelectedLayer(requestedLayerId ?? "hybrid");
  }, [requestedLayerId]);
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
  const [showPropertyLines, setShowPropertyLines] = useState(false);
  const [showOwnerNames, setShowOwnerNames] = useState(false);
  const [showLandOwners, setShowLandOwners] = useState(false);
  const [showParcelTiles, setShowParcelTiles] = useState(false);
  const [landOwnerMessage, setLandOwnerMessage] = useState("");
  const [parcelLayerState, setParcelLayerState] =
    useState<ParcelBoundaryLoadState | null>(null);
  const [ownerLabelState, setOwnerLabelState] =
    useState<ParcelOwnerLabelLoadState | null>(null);
  const [parcelOwnerLookupState, setParcelOwnerLookupState] =
    useState<ParcelOwnerLookupState>(IDLE_PARCEL_OWNER_LOOKUP_STATE);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isMobileAssetSheetOpen, setIsMobileAssetSheetOpen] = useState(false);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
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
  const mapAssets = useMemo(() => {
    const cameraAssets = propertyCameras
      .map(cameraToMapAsset)
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null);

    return [...cameraAssets, ...pins.map(pinToMapAsset)];
  }, [pins, propertyCameras]);
  const visibleAssets = mapAssets.filter((asset) =>
    asset.layerId === "other" ? true : visibleAssetLayers[asset.layerId],
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
    showLandOwners ? landOwnerMessage : "",
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
  const focusInputsRef = useRef({ selectedProperty, propertyCameras, pins });

  useEffect(() => {
    focusInputsRef.current = { selectedProperty, propertyCameras, pins };
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

  function toggleLandOwners() {
    setShowLandOwners((isVisible) => {
      const shouldShow = !isVisible;

      if (!shouldShow) setLandOwnerMessage("");

      return shouldShow;
    });
  }

  function toggleParcelTiles() {
    setShowParcelTiles((isVisible) => !isVisible);
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

  return (
    <div className="di-map-layout" style={mapLayoutStyle}>
      <Card
        as="section"
        className="di-map-control-panel"
        variant="elevated"
        style={controlPanelStyle}
      >
        <div style={panelHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Property Map</p>
            <h2 style={panelTitleStyle}>Scout the Property</h2>
          </div>
          <div style={statusPillRowStyle}>
            <span style={statusPillStyle}>{visibleAssets.length} shown</span>
            <span style={statusPillStyle}>Zoom {mapZoom}</span>
          </div>
        </div>

        <div style={topControlGridStyle}>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Property</span>
            <select
              style={selectStyle}
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
          </label>

        </div>

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
      </Card>

      <div className="di-map-stage" style={mapStageStyle}>
        <div className="di-map-frame" style={mapFrameStyle}>
          <MapSearchBar
            canCreateAsset={selectedSearchResult !== null}
            isSearching={isSearching}
            message={searchMessage}
            results={searchResults}
            selectedAssetType={pinType}
            selectedResultId={selectedSearchResult?.id ?? null}
            onCreateAssetHere={createAssetFromSearchResult}
            onSearch={searchAddressOrPlace}
            onSelectResult={selectSearchResult}
          />

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
            <LandOwnerLayer
              enabled={showLandOwners}
              onStatusChange={setLandOwnerMessage}
            />
            <ParcelTilesLayer enabled={showParcelTiles} />

            <MapSearchTargetController target={searchTarget} />
            <MapStateTracker onMapStateChange={saveMapState} />
            <MapControlButtons
              showCompass={mapTools.compass}
              showGps={mapTools.gps}
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

          <MapLayerManager
            mapTools={mapTools}
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
            selectedLayer={selectedLayer}
            showLandOwners={showLandOwners}
            showParcelTiles={showParcelTiles}
            showOwnerNames={ownerNamesEnabled}
            showPropertyLines={showPropertyLines}
            visibleAssetLayers={visibleAssetLayers}
            onSelectLayer={setSelectedLayer}
            onToggleLandOwners={toggleLandOwners}
            onToggleParcelTiles={toggleParcelTiles}
            onToggleLayer={toggleAssetLayer}
            onToggleMapTool={toggleMapTool}
            onToggleOwnerNames={toggleOwnerNames}
            onTogglePropertyLines={togglePropertyLines}
          />

          <div className="di-map-status" style={mapStatusStyle}>
            <span style={mapStatusPillStyle}>{selectedMapLayer.label}</span>
            {selectedMapLayer.isPlaceholder ? (
              <span style={mapStatusPillStyle}>Topo provider placeholder</span>
            ) : null}
            {showPropertyLines ? (
              <span style={mapStatusPillStyle}>Property Lines</span>
            ) : null}
            {ownerNamesEnabled ? (
              <span style={mapStatusPillStyle}>Owner Names</span>
            ) : null}
            {showLandOwners ? (
              <span style={mapStatusPillStyle}>Land Owners</span>
            ) : null}
            {offlinePacks.length > 0 ? (
              <span style={mapStatusPillStyle}>
                {offlinePacks.length} offline
                {offlinePacks.length === 1 ? " map" : " maps"}
              </span>
            ) : null}
            <span style={mapStatusPillStyle}>
              {selectedAsset ? selectedAsset.label : "No asset selected"}
            </span>
          </div>

          {mapOverlayMessages.length > 0 ? (
            <div className="di-map-notice" style={propertyLinesNoticeStyle}>
              {mapOverlayMessages.join(" ")}
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
              parcel={parcelOwnerLookupState.parcel}
              onClose={() =>
                setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE)
              }
            />
          ) : null}
        </div>

        <MapPinBox
          disabled={pinBoxDisabled}
          isPlacing={isPlacingPin}
          message={currentPinBoxMessage}
          pinType={pinType}
          onCancelPlacement={cancelPinPlacement}
          onPinTypeChange={updatePinType}
          onStartPlacement={startPinPlacement}
        />
      </div>

      <div style={belowMapGridStyle}>
        <Card as="section">
          <h2 style={sectionTitleStyle}>Mapped Locations</h2>
          <p style={helpTextStyle}>
            Camera sites with GPS are shown with saved pins for this property.
          </p>

          <div style={assetListStyle}>
            {mapAssets.length === 0 ? (
              <EmptyState description="No map locations yet. Use the Pin Box to save the first one." />
            ) : (
              mapAssets.map((asset) => {
                const isSelected = asset.id === selectedAssetId;
                const isHidden =
                  asset.layerId !== "other" &&
                  !visibleAssetLayers[asset.layerId];

                return (
                  <div
                    className="di-map-row"
                    key={asset.id}
                    style={{
                      ...assetRowStyle,
                      ...(isSelected ? selectedAssetRowStyle : null),
                      ...(isHidden ? hiddenAssetRowStyle : null),
                    }}
                  >
                    <div style={assetRowContentStyle}>
                      <span
                        style={{
                          ...assetMiniIconStyle,
                          background: asset.background,
                          borderColor: asset.color,
                          color: asset.color,
                        }}
                      >
                        {asset.shortLabel}
                      </span>
                      <div>
                        <p style={assetTitleStyle}>{asset.label}</p>
                        <p style={assetMetaStyle}>
                          {asset.typeLabel} - {formatCoordinate(asset.lat)},{" "}
                          {formatCoordinate(asset.lng)}
                        </p>
                      </div>
                    </div>

                    {asset.pinId ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => deletePin(asset.pinId ?? "")}
                        style={deleteButtonStyle}
                      >
                        Delete
                      </Button>
                    ) : (
                      <span style={cameraSourceStyle}>Camera Site</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const mapLayoutStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const mapStageStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "0.75rem",
};

const controlPanelStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const panelTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.45rem",
  lineHeight: 1.2,
};

const statusPillRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  padding: "0.45rem 0.7rem",
  border: "1px solid var(--border)",
  borderRadius: "999px",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const topControlGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const labelTextStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
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

const mapStatusStyle: CSSProperties = {
  position: "absolute",
  left: "1rem",
  bottom: "7rem",
  zIndex: 1000,
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const mapStatusPillStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  padding: "0.45rem 0.7rem",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#111711",
  fontSize: "0.86rem",
  fontWeight: 800,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
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

const belowMapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.45rem",
  lineHeight: 1.2,
};

const assetListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  marginTop: "1rem",
};

const assetRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  padding: "0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "#f1f5ef",
};

const selectedAssetRowStyle: CSSProperties = {
  borderColor: "#4d7d55",
  background: "#101b10",
};

const hiddenAssetRowStyle: CSSProperties = {
  opacity: 0.58,
};

const assetRowContentStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  minWidth: 0,
};

const assetMiniIconStyle: CSSProperties = {
  display: "inline-flex",
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 900,
};

const assetTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontWeight: 800,
  lineHeight: 1.25,
};

const assetMetaStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "#b8c2b6",
  fontSize: "0.92rem",
  lineHeight: 1.4,
};

const cameraSourceStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "38px",
  alignItems: "center",
  padding: "0.45rem 0.7rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#101710",
  color: "#dce9da",
  fontSize: "0.86rem",
  fontWeight: 800,
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.55rem 0.75rem",
  fontSize: "0.9rem",
};
