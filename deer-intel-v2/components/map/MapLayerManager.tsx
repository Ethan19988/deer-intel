"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ASSET_LAYERS,
  MAP_LAYER_BY_ID,
  type AssetLayerId,
  type MapLayerId,
} from "@/lib/propertyMap";

export type MapToolId = "gps" | "compass" | "scaleBar";
export type MapToolState = Record<MapToolId, boolean>;

type MapLayerManagerProps = {
  contourLevel: number;
  mapTools: MapToolState;
  offlineSection?: ReactNode;
  ownerNamesDisabled?: boolean;
  selectedLayer: MapLayerId;
  showParcelTiles: boolean;
  showOwnerNames: boolean;
  showPropertyLines: boolean;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onSelectContourLevel: (level: number) => void;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleParcelTiles: () => void;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onToggleMapTool: (toolId: MapToolId) => void;
  onToggleOwnerNames: () => void;
  onTogglePropertyLines: () => void;
};

// Contour density levels shown in the segmented control. The free USGS service
// exposes line density (index → intermediate → supplemental) rather than a
// literal feet interval, so the options name that honestly. 0 turns it off.
const CONTOUR_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Off" },
  { value: 1, label: "Coarse" },
  { value: 2, label: "Standard" },
  { value: 3, label: "Detailed" },
];

const BASE_MAP_ORDER: MapLayerId[] = [
  "hybrid",
  "satellite",
  "roads",
  "terrain",
  "topographic",
  "lidar",
];

// A representative swatch for each base map so the picker reads like the field
// app's tile thumbnails — imagery greens, road paper, terrain tan, LiDAR grey.
// Shown while the real preview tile loads, and as the fallback if it can't.
const BASE_MAP_SWATCH: Record<MapLayerId, string> = {
  hybrid: "linear-gradient(135deg, #4a6a35 0%, #26361c 100%)",
  satellite: "linear-gradient(135deg, #4a6a35 0%, #22311a 100%)",
  roads: "linear-gradient(135deg, #edeae0 0%, #cbc7ba 100%)",
  terrain: "linear-gradient(135deg, #d3bd8c 0%, #8a7748 100%)",
  topographic: "linear-gradient(135deg, #567a3c 0%, #2b401d 100%)",
  lidar: "linear-gradient(135deg, #c0b9ac 0%, #6d6860 100%)",
};

// One real map tile per source (a wooded sample area in central PA, z13) so each
// picker tile previews the actual imagery/terrain the base map draws — the way
// the reference app shows UAV/Sat/Lidar thumbnails. Note the differing axis
// order: the ArcGIS/USDA services template as {z}/{y}/{x}, OSM/OpenTopo as
// {z}/{x}/{y}.
const BASE_MAP_THUMBNAIL: Record<MapLayerId, string> = {
  hybrid:
    "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/32246/13/3074/2325",
  satellite:
    "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/32246/13/3074/2325",
  roads: "https://a.tile.openstreetmap.org/13/2325/3074.png",
  terrain: "https://a.tile.opentopomap.org/13/2325/3074.png",
  topographic:
    "https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer/tile/13/3074/2325",
  lidar:
    "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/13/3074/2325",
};

const VISIBILITY_LABELS: Record<AssetLayerId, string> = {
  cameras: "Cameras",
  stands: "Stands",
  bedding: "Bedding",
  food: "Food",
  water: "Water",
  scrapes: "Scrapes",
  rubs: "Rubs",
  trails: "Trails",
  parking: "Parking",
  gates: "Gates",
};

const MAP_TOOL_LABELS: Array<{ id: MapToolId; label: string }> = [
  { id: "gps", label: "GPS" },
  { id: "compass", label: "Compass" },
  { id: "scaleBar", label: "Scale Bar" },
];

const FUTURE_LAYER_LABELS = [
  "Slope",
  "Sun Exposure",
  "Historical Wind",
  "Deer Movement",
  "Heat Map",
];

export default function MapLayerManager({
  contourLevel,
  mapTools,
  offlineSection,
  ownerNamesDisabled = false,
  selectedLayer,
  showParcelTiles,
  showOwnerNames,
  showPropertyLines,
  visibleAssetLayers,
  onSelectContourLevel,
  onSelectLayer,
  onToggleParcelTiles,
  onToggleLayer,
  onToggleMapTool,
  onToggleOwnerNames,
  onTogglePropertyLines,
}: MapLayerManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const baseMapLayers = useMemo(
    () => BASE_MAP_ORDER.map((layerId) => MAP_LAYER_BY_ID[layerId]),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="di-layer-manager-button"
        style={layersButtonStyle}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        Layers
      </button>

      <div
        className={`di-layer-manager-backdrop${
          isOpen ? " di-layer-manager-backdrop-open" : ""
        }`}
        style={backdropStyle}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`di-layer-manager-panel${
          isOpen ? " di-layer-manager-panel-open" : ""
        }`}
        style={panelStyle}
        aria-label="Maps"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <div className="di-layer-manager-grabber" style={grabberStyle} aria-hidden="true" />

        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Map</p>
            <h3 style={titleStyle}>Maps &amp; Layers</h3>
          </div>
          <button
            type="button"
            className="di-layer-manager-close"
            style={closeButtonStyle}
            aria-label="Close layers"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </header>

        <div style={contentStyle}>
          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Base Map</h4>
            <div style={baseMapRowStyle} role="radiogroup">
              {baseMapLayers.map((layer) => {
                const isSelected = layer.id === selectedLayer;

                return (
                  <button
                    key={layer.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    style={{
                      ...baseMapTileStyle,
                      ...(isSelected ? selectedBaseMapTileStyle : null),
                    }}
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        ...baseMapSwatchStyle,
                        backgroundImage: BASE_MAP_SWATCH[layer.id],
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={BASE_MAP_THUMBNAIL[layer.id]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={baseMapThumbImageStyle}
                        onError={(event) => {
                          // Fall back to the gradient swatch if the tile fails.
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      {isSelected ? (
                        <span style={baseMapCheckStyle}>✓</span>
                      ) : null}
                    </span>
                    <span style={baseMapLabelStyle}>{layer.label}</span>
                    {layer.isPlaceholder ? (
                      <span style={placeholderStyle}>Placeholder</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Contours</h4>
            <div style={segmentedStyle} role="radiogroup" aria-label="Contours">
              {CONTOUR_OPTIONS.map((option) => {
                const isSelected = contourLevel === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    style={{
                      ...segmentStyle,
                      ...(isSelected ? selectedSegmentStyle : null),
                    }}
                    onClick={() => onSelectContourLevel(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <ChipSection title="Map Features">
            {ASSET_LAYERS.map((layer) => (
              <Chip
                key={layer.id}
                checked={visibleAssetLayers[layer.id]}
                label={VISIBILITY_LABELS[layer.id]}
                swatch={layer.color}
                onToggle={() => onToggleLayer(layer.id)}
              />
            ))}
          </ChipSection>

          <ChipSection title="Property">
            <Chip
              checked={showPropertyLines}
              label="Property Lines"
              onToggle={onTogglePropertyLines}
            />
            <Chip
              checked={showOwnerNames}
              disabled={ownerNamesDisabled}
              label="Owner Names"
              onToggle={onToggleOwnerNames}
            />
            <Chip
              checked={showParcelTiles}
              label="Land Owners"
              onToggle={onToggleParcelTiles}
            />
          </ChipSection>

          <ChipSection title="Map Tools">
            {MAP_TOOL_LABELS.map((tool) => (
              <Chip
                key={tool.id}
                checked={mapTools[tool.id]}
                label={tool.label}
                onToggle={() => onToggleMapTool(tool.id)}
              />
            ))}
          </ChipSection>

          <ChipSection title="Coming Soon">
            {FUTURE_LAYER_LABELS.map((label) => (
              <Chip
                key={label}
                checked={false}
                disabled
                label={label}
                onToggle={() => undefined}
              />
            ))}
          </ChipSection>

          {offlineSection ? (
            <section style={sectionStyle}>
              <h4 style={sectionTitleStyle}>Offline Maps</h4>
              {offlineSection}
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function ChipSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionTitleStyle}>{title}</h4>
      <div style={chipWrapStyle}>{children}</div>
    </section>
  );
}

function Chip({
  checked,
  disabled = false,
  label,
  swatch,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  swatch?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      style={{
        ...chipStyle,
        ...(checked ? activeChipStyle : null),
        ...(disabled ? disabledChipStyle : null),
      }}
      onClick={onToggle}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          style={{
            ...chipSwatchStyle,
            background: swatch,
            ...(checked ? null : chipSwatchMutedStyle),
          }}
        />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

const layersButtonStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  right: "5rem",
  zIndex: 1070,
  display: "inline-flex",
  minHeight: "46px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.68rem 0.95rem",
  border: "1px solid rgba(25, 34, 25, 0.28)",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#111711",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 900,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
};

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1600,
  background: "rgba(5, 8, 6, 0.34)",
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 1610,
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr)",
  width: "min(400px, calc(100% - 1rem))",
  borderLeft: "1px solid rgba(17, 23, 17, 0.14)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "-18px 0 42px rgba(0, 0, 0, 0.24)",
};

// Only meaningful as a bottom sheet (mobile); hidden on the desktop side drawer.
const grabberStyle: CSSProperties = {
  justifySelf: "center",
  width: "40px",
  height: "4px",
  margin: "0.5rem 0 0",
  borderRadius: "999px",
  background: "var(--border-strong)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "0.85rem 1rem",
  borderBottom: "1px solid var(--border)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 900,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.12rem 0 0",
  color: "var(--text)",
  fontSize: "1.2rem",
  lineHeight: 1.2,
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  width: "42px",
  minHeight: "42px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface-2)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 900,
};

const contentStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "1.15rem",
  minHeight: 0,
  overflow: "auto",
  padding: "1rem",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.74rem",
  fontWeight: 900,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const baseMapRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  overflowX: "auto",
  paddingBottom: "0.25rem",
  scrollSnapType: "x proximity",
};

const baseMapTileStyle: CSSProperties = {
  display: "grid",
  flex: "0 0 auto",
  width: "94px",
  gap: "0.4rem",
  padding: "0.4rem",
  border: "2px solid var(--border)",
  borderRadius: "12px",
  background: "var(--surface-2)",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "center",
  scrollSnapAlign: "start",
};

const selectedBaseMapTileStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
};

const baseMapSwatchStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  height: "58px",
  overflow: "hidden",
  borderRadius: "8px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.12)",
};

const baseMapThumbImageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const baseMapCheckStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "inline-flex",
  width: "24px",
  height: "24px",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  background: "var(--accent)",
  color: "#ffffff",
  fontSize: "0.85rem",
  fontWeight: 900,
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
};

const baseMapLabelStyle: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 800,
  lineHeight: 1.15,
};

const placeholderStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.68rem",
  fontWeight: 800,
  lineHeight: 1.2,
};

const segmentedStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "0.25rem",
  padding: "0.25rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "12px",
  background: "var(--surface-2)",
};

const segmentStyle: CSSProperties = {
  minHeight: "40px",
  border: "1px solid transparent",
  borderRadius: "9px",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 800,
};

const selectedSegmentStyle: CSSProperties = {
  borderColor: "var(--accent-tint-border)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "40px",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.4rem 0.85rem",
  border: "1.5px solid var(--border-strong)",
  borderRadius: "999px",
  background: "var(--surface)",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 800,
  lineHeight: 1.1,
};

const activeChipStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const disabledChipStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.5,
};

const chipSwatchStyle: CSSProperties = {
  display: "inline-block",
  width: "12px",
  height: "12px",
  flex: "0 0 auto",
  borderRadius: "999px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.2)",
};

const chipSwatchMutedStyle: CSSProperties = {
  opacity: 0.45,
};
