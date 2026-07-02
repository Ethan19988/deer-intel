"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MapAssetInfoCard from "@/components/map/MapAssetInfoCard";
import MapAssetSelectorPanel from "@/components/map/MapAssetSelectorPanel";
import MapDrawingInfoCard from "@/components/map/MapDrawingInfoCard";
import MapDrawingShape from "@/components/map/MapDrawingShape";
import MapDrawingToolbar from "@/components/map/MapDrawingToolbar";
import MapLayerControl from "@/components/map/MapLayerControl";
import MapModeSelector from "@/components/map/MapModeSelector";
import ParcelBoundaryLayer from "@/components/map/ParcelBoundaryLayer";
import ParcelOwnerLabelLayer from "@/components/map/ParcelOwnerLabelLayer";
import ParcelOwnerInfoCard from "@/components/map/ParcelOwnerInfoCard";
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
import {
  IDLE_PARCEL_OWNER_LOOKUP_STATE,
  lookupPaParcelOwnerAtPoint,
} from "@/lib/parcelLookup";
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
  MapDrawing,
  MapDrawingGeometry,
  MapDrawingPoint,
  MapDrawingType,
} from "@/types/mapDrawing";
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

type ActiveDrawing = {
  geometry: MapDrawingGeometry;
  type: MapDrawingType;
};

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

function ClickToDraw({
  isDrawing,
  onAddPoint,
}: {
  isDrawing: boolean;
  onAddPoint: (point: MapDrawingPoint) => void;
}) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!isDrawing) return;

      onAddPoint({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
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

function MapControlButtons() {
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
      style={mapControlsStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Zoom in"
        style={mapControlButtonStyle}
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        style={mapControlButtonStyle}
        onClick={() => map.zoomOut()}
      >
        -
      </button>
      <button
        type="button"
        aria-label="Locate me"
        style={{ ...mapControlButtonStyle, ...gpsButtonStyle }}
        onClick={locateUser}
      >
        GPS
      </button>
    </div>
  );
}

function MapStateTracker({
  onMapStateChange,
}: {
  onMapStateChange: (center: MapCenter, zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend() {
      syncMapState();
    },
    zoomend() {
      syncMapState();
    },
  });

  function syncMapState() {
    const center = map.getCenter();

    onMapStateChange([center.lat, center.lng], map.getZoom());
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
  const [selectedLayer, setSelectedLayer] = useState<MapLayerId>("hybrid");
  const [showPropertyLines, setShowPropertyLines] = useState(false);
  const [showOwnerNames, setShowOwnerNames] = useState(false);
  const [parcelLayerState, setParcelLayerState] =
    useState<ParcelBoundaryLoadState | null>(null);
  const [ownerLabelState, setOwnerLabelState] =
    useState<ParcelOwnerLabelLoadState | null>(null);
  const [parcelOwnerLookupState, setParcelOwnerLookupState] =
    useState<ParcelOwnerLookupState>(IDLE_PARCEL_OWNER_LOOKUP_STATE);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [activeDrawing, setActiveDrawing] = useState<ActiveDrawing | null>(
    null,
  );
  const [drawingPoints, setDrawingPoints] = useState<MapDrawingPoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchResults, setSearchResults] = useState<AddressSearchPlace[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<AddressSearchPlace | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [visibleAssetLayers, setVisibleAssetLayers] = useState<
    Record<AssetLayerId, boolean>
  >(createVisibleAssetLayerState);

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
  const propertyDrawings = useMemo(
    () =>
      state.mapDrawings.filter(
        (drawing) => drawing.propertyId === selectedPropertyId,
      ),
    [selectedPropertyId, state.mapDrawings],
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
  const selectedDrawing = propertyDrawings.find(
    (drawing) => drawing.id === selectedDrawingId,
  );
  const drawingCanFinish =
    activeDrawing !== null &&
    drawingPoints.length >= (activeDrawing.geometry === "polygon" ? 3 : 2);
  const mapOverlayMessages = [
    showPropertyLines ? parcelLayerState?.message : "",
    showOwnerNames && parcelOwnerLookupState.status === "idle"
      ? ownerLabelState?.message
      : "",
    parcelOwnerLookupState.status !== "idle" &&
    parcelOwnerLookupState.status !== "found"
      ? parcelOwnerLookupState.message
      : "",
  ].filter((message): message is string => Boolean(message));

  function saveMapState(center: MapCenter, zoom: number) {
    setMapCenter((currentCenter) =>
      currentCenter[0] === center[0] && currentCenter[1] === center[1]
        ? currentCenter
        : center,
    );
    setMapZoom((currentZoom) => (currentZoom === zoom ? currentZoom : zoom));
  }

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
    if (!showPropertyLines) return;

    setShowOwnerNames((isVisible) => {
      const shouldShowOwnerNames = !isVisible;

      if (!shouldShowOwnerNames) {
        setParcelOwnerLookupState(IDLE_PARCEL_OWNER_LOOKUP_STATE);
      }

      return shouldShowOwnerNames;
    });
  }

  async function lookupParcelOwner(lat: number, lng: number) {
    setSelectedAssetId(null);
    setSelectedDrawingId(null);
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

  function selectAsset(assetId: string) {
    setSelectedAssetId(assetId);
    setSelectedDrawingId(null);
  }

  function selectAssetAndCenter(asset: MapAsset) {
    setSelectedAssetId(asset.id);
    setSelectedDrawingId(null);
    setSearchTarget({
      center: [asset.lat, asset.lng],
      id: Date.now(),
      zoom: Math.max(mapZoom, 17),
    });
  }

  function startDrawing(type: MapDrawingType, geometry: MapDrawingGeometry) {
    setActiveDrawing({
      geometry,
      type,
    });
    setDrawingPoints([]);
    setSelectedAssetId(null);
    setSelectedDrawingId(null);
  }

  function addDrawingPoint(point: MapDrawingPoint) {
    setDrawingPoints((currentPoints) => [...currentPoints, point]);
  }

  function cancelDrawing() {
    setActiveDrawing(null);
    setDrawingPoints([]);
  }

  function finishDrawing() {
    if (!activeDrawing || !drawingCanFinish || !selectedPropertyId) return;

    const drawingName = window.prompt(
      `Name this ${activeDrawing.type}`,
      activeDrawing.type,
    );
    const trimmedName = drawingName?.trim();

    if (!trimmedName) return;

    const drawingId = createDeerIntelId("drawing");
    const newDrawing: MapDrawing = {
      id: drawingId,
      propertyId: selectedPropertyId,
      type: activeDrawing.type,
      geometry: activeDrawing.geometry,
      name: trimmedName,
      points: drawingPoints,
      createdAt: new Date().toISOString(),
    };

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      mapDrawings: [...currentState.mapDrawings, newDrawing],
    }));
    setSelectedDrawingId(drawingId);
    cancelDrawing();
  }

  function selectDrawing(drawingId: string) {
    setSelectedDrawingId(drawingId);
    setSelectedAssetId(null);
  }

  function deleteSelectedDrawing() {
    if (!selectedDrawing) return;

    if (!window.confirm(`Delete ${selectedDrawing.name}?`)) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      mapDrawings: currentState.mapDrawings.filter(
        (drawing) => drawing.id !== selectedDrawing.id,
      ),
    }));
    setSelectedDrawingId(null);
  }

  function centerOnAsset() {
    if (!selectedAsset) return;

    setSearchTarget({
      center: [selectedAsset.lat, selectedAsset.lng],
      id: Date.now(),
      zoom: Math.max(mapZoom, 17),
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

  function addPin(type: PinType, lat: number, lng: number) {
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
          notes: "",
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
    <div style={mapLayoutStyle}>
      <Card as="section" variant="elevated" style={controlPanelStyle}>
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

        <div>
          <div style={assetPickerHeaderStyle}>
            <p style={controlLabelStyle}>Add Asset</p>
            <span style={selectedAssetTypePillStyle}>
              Next click: {pinType}
            </span>
          </div>
          <div style={assetTypeGridStyle}>
            {PROPERTY_ASSET_PIN_TYPES.map((type) => {
              const isSelected = type === pinType;

              return (
                <button
                  key={type}
                  type="button"
                  style={{
                    ...assetTypeButtonStyle,
                    ...(isSelected ? selectedAssetTypeButtonStyle : null),
                  }}
                  onClick={() => setPinType(type)}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <MapModeSelector
          selectedLayer={selectedLayer}
          onSelectLayer={setSelectedLayer}
        />

        <MapLayerControl
          ownerNamesDisabled={!showPropertyLines}
          showOwnerNames={showOwnerNames}
          showPropertyLines={showPropertyLines}
          visibleAssetLayers={visibleAssetLayers}
          onToggleLayer={toggleAssetLayer}
          onToggleOwnerNames={toggleOwnerNames}
          onTogglePropertyLines={togglePropertyLines}
        />

        <p style={helpTextStyle}>
          Tap the map to add a {pinType.toLowerCase()} pin to{" "}
          {selectedProperty?.name ?? "this property"}.
        </p>
      </Card>

      <div style={mapFrameStyle}>
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
            enabled={showPropertyLines && showOwnerNames}
            propertyId={selectedPropertyId}
            onStateChange={setOwnerLabelState}
          />

          <MapSearchTargetController target={searchTarget} />
          <MapStateTracker onMapStateChange={saveMapState} />
          <MapControlButtons />

          <ClickToAddPin
            enabled={activeDrawing === null && !showOwnerNames}
            pinType={pinType}
            propertyId={selectedPropertyId}
            onAddPin={addPin}
          />
          <ClickToLookupParcelOwner
            enabled={
              activeDrawing === null && showPropertyLines && showOwnerNames
            }
            onLookup={lookupParcelOwner}
          />
          <ClickToDraw
            isDrawing={activeDrawing !== null}
            onAddPoint={addDrawingPoint}
          />

          {propertyDrawings.map((drawing) => (
            <MapDrawingShape
              key={drawing.id}
              drawing={drawing}
              isSelected={drawing.id === selectedDrawingId}
              onSelect={() => selectDrawing(drawing.id)}
            />
          ))}

          {activeDrawing && drawingPoints.length >= 2 ? (
            activeDrawing.geometry === "polygon" && drawingPoints.length >= 3 ? (
              <Polygon
                positions={drawingPoints.map((point) => [point.lat, point.lng])}
                pathOptions={activeDrawingPreviewStyle}
              />
            ) : (
              <Polyline
                positions={drawingPoints.map((point) => [point.lat, point.lng])}
                pathOptions={activeDrawingPreviewStyle}
              />
            )
          ) : null}

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

        <MapDrawingToolbar
          activeDrawingType={activeDrawing?.type ?? null}
          canFinish={drawingCanFinish}
          pointCount={drawingPoints.length}
          onCancel={cancelDrawing}
          onFinish={finishDrawing}
          onStartDrawing={startDrawing}
        />

        <div style={mapStatusStyle}>
          <span style={mapStatusPillStyle}>{selectedMapLayer.label}</span>
          {selectedMapLayer.isPlaceholder ? (
            <span style={mapStatusPillStyle}>Topo provider placeholder</span>
          ) : null}
          {showPropertyLines ? (
            <span style={mapStatusPillStyle}>Property Lines</span>
          ) : null}
          {showOwnerNames ? (
            <span style={mapStatusPillStyle}>Owner Names</span>
          ) : null}
          <span style={mapStatusPillStyle}>
            {selectedDrawing
              ? selectedDrawing.name
              : selectedAsset
                ? selectedAsset.label
                : "No asset selected"}
          </span>
        </div>

        {mapOverlayMessages.length > 0 ? (
          <div style={propertyLinesNoticeStyle}>
            {mapOverlayMessages.join(" ")}
          </div>
        ) : null}

        <MapAssetSelectorPanel
          assets={visibleAssets}
          selectedAssetId={selectedAssetId}
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

        {selectedDrawing && selectedProperty ? (
          <MapDrawingInfoCard
            key={selectedDrawing.id}
            drawing={selectedDrawing}
            propertyName={selectedProperty.name}
            onClose={() => setSelectedDrawingId(null)}
            onDelete={deleteSelectedDrawing}
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

      <div style={belowMapGridStyle}>
        <Card as="section">
          <h2 style={sectionTitleStyle}>Mapped Locations</h2>
          <p style={helpTextStyle}>
            Camera sites with GPS are shown with saved pins for this property.
          </p>

          <div style={assetListStyle}>
            {mapAssets.length === 0 ? (
              <EmptyState description="No map locations yet. Tap the map to save the first one." />
            ) : (
              mapAssets.map((asset) => {
                const isSelected = asset.id === selectedAssetId;
                const isHidden =
                  asset.layerId !== "other" &&
                  !visibleAssetLayers[asset.layerId];

                return (
                  <div
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

const activeDrawingPreviewStyle = {
  color: "#74a86f",
  fillColor: "#74a86f",
  fillOpacity: 0.16,
  opacity: 0.95,
  weight: 4,
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

const controlLabelStyle: CSSProperties = {
  margin: "0 0 0.55rem",
  color: "#c6d5c5",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const assetPickerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginBottom: "0.55rem",
};

const selectedAssetTypePillStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "34px",
  alignItems: "center",
  padding: "0.4rem 0.65rem",
  border: "1px solid #3b6843",
  borderRadius: "999px",
  background: "#102111",
  color: "#f1f5ef",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const assetTypeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
  gap: "0.6rem",
};

const assetTypeButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "48px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.65rem 0.75rem",
  border: "1px solid #253425",
  borderRadius: "8px",
  background: "#070a07",
  color: "#c8d2c6",
  fontSize: "0.94rem",
  fontWeight: 800,
  cursor: "pointer",
};

const selectedAssetTypeButtonStyle: CSSProperties = {
  borderColor: "#4c8d56",
  background: "#17331b",
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
