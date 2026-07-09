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
import {
  MapContainer,
  ScaleControl,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
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
import MapSearchBar from "@/components/map/MapSearchBar";
import MapSearchResultMarker from "@/components/map/MapSearchResultMarker";
import PropertyMapAssetMarker from "@/components/map/PropertyMapAssetMarker";
import {
  createDeerIntelId,
  PROPERTY_ASSET_PIN_TYPES,
  type PinType,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { resolvePropertyWeatherPoint } from "@/lib/liveWeather";
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
const PROPERTY_FOCUS_ZOOM = 15;

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

export default function HuntingMap() {
  const state = useDeerIntelStore();
  const [pinType, setPinType] = useState<PinType>(
    PROPERTY_ASSET_PIN_TYPES[0],
  );
  const [mapCenter, setMapCenter] =
    useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const latestMapZoomRef = useRef(DEFAULT_MAP_ZOOM);
  const [selectedLayer, setSelectedLayer] = useState<MapLayerId>("hybrid");
  const [mapTools, setMapTools] = useState<MapToolState>({
    gps: true,
    compass: true,
    scaleBar: true,
  });
  const [showPropertyLines, setShowPropertyLines] = useState(false);
  const [showOwnerNames, setShowOwnerNames] = useState(false);
  const [showLandOwners, setShowLandOwners] = useState(false);
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

  const selectedProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const selectedPropertyId = selectedProperty?.id ?? "";
  const selectedMapLayer = MAP_LAYER_BY_ID[selectedLayer];
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
  const pinBoxDisabled = !selectedPropertyId || ownerNamesEnabled;
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
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
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

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            zoomControl={false}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              key={`${selectedMapLayer.id}-base`}
              attribution={selectedMapLayer.attribution}
              url={selectedMapLayer.url}
            />

            {selectedMapLayer.overlayLayers?.map((overlayLayer, index) => (
              <TileLayer
                key={`${selectedMapLayer.id}-${overlayLayer.label}`}
                attribution={overlayLayer.attribution}
                url={overlayLayer.url}
                zIndex={650 + index}
              />
            ))}

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
              enabled={showPropertyLines && ownerNamesEnabled}
              onLookup={lookupParcelOwner}
            />

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
            ownerNamesDisabled={isMobileMapPerformanceMode}
            selectedLayer={selectedLayer}
            showLandOwners={showLandOwners}
            showOwnerNames={ownerNamesEnabled}
            showPropertyLines={showPropertyLines}
            visibleAssetLayers={visibleAssetLayers}
            onSelectLayer={setSelectedLayer}
            onToggleLandOwners={toggleLandOwners}
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
            <span style={mapStatusPillStyle}>
              {selectedAsset ? selectedAsset.label : "No asset selected"}
            </span>
          </div>

          {mapOverlayMessages.length > 0 ? (
            <div className="di-map-notice" style={propertyLinesNoticeStyle}>
              {mapOverlayMessages.join(" ")}
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
  color: "#85a984",
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
  border: "1px solid #2b3a2b",
  borderRadius: "999px",
  background: "#071007",
  color: "#dce9da",
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
  color: "#85a984",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  minHeight: "48px",
  width: "100%",
  padding: "0.75rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#070a07",
  color: "white",
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  fontSize: "1rem",
  lineHeight: 1.5,
};

const mapFrameStyle: CSSProperties = {
  position: "relative",
  height: "clamp(420px, 68vh, 720px)",
  overflow: "hidden",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
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
