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
  mapTools: MapToolState;
  offlineSection?: ReactNode;
  ownerNamesDisabled?: boolean;
  selectedLayer: MapLayerId;
  showParcelTiles: boolean;
  showOwnerNames: boolean;
  showPropertyLines: boolean;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleParcelTiles: () => void;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onToggleMapTool: (toolId: MapToolId) => void;
  onToggleOwnerNames: () => void;
  onTogglePropertyLines: () => void;
};

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
const BASE_MAP_SWATCH: Record<MapLayerId, string> = {
  hybrid: "linear-gradient(135deg, #4a6a35 0%, #26361c 100%)",
  satellite: "linear-gradient(135deg, #4a6a35 0%, #22311a 100%)",
  roads: "linear-gradient(135deg, #edeae0 0%, #cbc7ba 100%)",
  terrain: "linear-gradient(135deg, #d3bd8c 0%, #8a7748 100%)",
  topographic: "linear-gradient(135deg, #567a3c 0%, #2b401d 100%)",
  lidar: "linear-gradient(135deg, #c0b9ac 0%, #6d6860 100%)",
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
  mapTools,
  offlineSection,
  ownerNamesDisabled = false,
  selectedLayer,
  showParcelTiles,
  showOwnerNames,
  showPropertyLines,
  visibleAssetLayers,
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
  display: "grid",
  placeItems: "center",
  height: "58px",
  borderRadius: "8px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.12)",
};

const baseMapCheckStyle: CSSProperties = {
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
