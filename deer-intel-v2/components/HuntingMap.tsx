"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MapLayerControl from "@/components/map/MapLayerControl";
import MapModeSelector from "@/components/map/MapModeSelector";
import MapSearchBar from "@/components/map/MapSearchBar";
import PropertyMapAssetMarker from "@/components/map/PropertyMapAssetMarker";
import {
  createDeerIntelId,
  PIN_TYPES,
  type PinType,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import {
  cameraToMapAsset,
  createVisibleAssetLayerState,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  formatCoordinate,
  geocodeAddressOrPlace,
  MAP_LAYER_BY_ID,
  pinToMapAsset,
  type AssetLayerId,
  type MapCenter,
  type MapLayerId,
} from "@/lib/propertyMap";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

type ClickToAddPinProps = {
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

function ClickToAddPin({
  pinType,
  propertyId,
  onAddPin,
}: ClickToAddPinProps) {
  useMapEvents({
    click(event: MapClickEvent) {
      if (!propertyId) return;

      onAddPin(pinType, event.latlng.lat, event.latlng.lng);
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

    map.setView(target.center, target.zoom);
  }, [map, target]);

  return null;
}

export default function HuntingMap() {
  const state = useDeerIntelStore();
  const [pinType, setPinType] = useState<PinType>(PIN_TYPES[0]);
  const [mapCenter, setMapCenter] =
    useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [selectedLayer, setSelectedLayer] = useState<MapLayerId>("hybrid");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState("");
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

  async function searchAddressOrPlace(query: string) {
    const result = await geocodeAddressOrPlace(query);

    if (result.status !== "found") {
      setSearchMessage(result.message);
      return;
    }

    const nextZoom = result.zoom ?? Math.max(mapZoom, 15);

    setSearchMessage(`Showing ${result.label}`);
    setSearchTarget({
      center: result.center,
      id: Date.now(),
      zoom: nextZoom,
    });
  }

  function addPin(type: PinType, lat: number, lng: number) {
    if (!selectedPropertyId) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      pins: [
        ...currentState.pins,
        {
          id: createDeerIntelId("pin"),
          propertyId: selectedPropertyId,
          type,
          lat,
          lng,
          createdAt: new Date().toISOString(),
          notes: "",
        },
      ],
    }));
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

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Add Pin</span>
            <select
              style={selectStyle}
              value={pinType}
              onChange={(event) => setPinType(event.target.value as PinType)}
            >
              {PIN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <MapModeSelector
          selectedLayer={selectedLayer}
          onSelectLayer={setSelectedLayer}
        />

        <MapLayerControl
          visibleAssetLayers={visibleAssetLayers}
          onToggleLayer={toggleAssetLayer}
        />

        <p style={helpTextStyle}>
          Tap the map to add a {pinType.toLowerCase()} pin to{" "}
          {selectedProperty?.name ?? "this property"}.
        </p>
      </Card>

      <div style={mapFrameStyle}>
        <MapSearchBar
          message={searchMessage}
          onSearch={searchAddressOrPlace}
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

          <MapSearchTargetController target={searchTarget} />
          <MapStateTracker onMapStateChange={saveMapState} />
          <MapControlButtons />

          <ClickToAddPin
            pinType={pinType}
            propertyId={selectedPropertyId}
            onAddPin={addPin}
          />

          {visibleAssets.map((asset) => (
            <PropertyMapAssetMarker
              key={asset.id}
              asset={asset}
              isSelected={asset.id === selectedAssetId}
              onSelect={() => setSelectedAssetId(asset.id)}
            />
          ))}
        </MapContainer>

        <div style={mapStatusStyle}>
          <span style={mapStatusPillStyle}>{selectedMapLayer.label}</span>
          {selectedMapLayer.isPlaceholder ? (
            <span style={mapStatusPillStyle}>Topo provider placeholder</span>
          ) : null}
          <span style={mapStatusPillStyle}>
            {selectedAsset ? selectedAsset.label : "No asset selected"}
          </span>
        </div>
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
  bottom: "1rem",
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
