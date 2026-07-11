"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ASSET_LAYERS, type AssetLayerId } from "@/lib/propertyMap";

export type MapToolId = "gps" | "compass" | "scaleBar";
export type MapToolState = Record<MapToolId, boolean>;

type MapLayerManagerProps = {
  mapTools: MapToolState;
  offlineSection?: ReactNode;
  ownerNamesDisabled?: boolean;
  showParcelTiles: boolean;
  showOwnerNames: boolean;
  showPropertyLines: boolean;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onToggleParcelTiles: () => void;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onToggleMapTool: (toolId: MapToolId) => void;
  onToggleOwnerNames: () => void;
  onTogglePropertyLines: () => void;
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
  "Sun Exposure",
  "Historical Wind",
  "Deer Movement",
  "Heat Map",
];

export default function MapLayerManager({
  mapTools,
  offlineSection,
  ownerNamesDisabled = false,
  showParcelTiles,
  showOwnerNames,
  showPropertyLines,
  visibleAssetLayers,
  onToggleParcelTiles,
  onToggleLayer,
  onToggleMapTool,
  onToggleOwnerNames,
  onTogglePropertyLines,
}: MapLayerManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

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
        aria-label="Layers"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Map</p>
            <h3 style={titleStyle}>Layers</h3>
          </div>
          <button
            type="button"
            className="di-layer-manager-close"
            style={closeButtonStyle}
            aria-label="Close layers"
            onClick={() => setIsOpen(false)}
          >
            X
          </button>
        </header>

        <div style={contentStyle}>
          {offlineSection ? (
            <section style={sectionStyle}>
              <h4 style={sectionTitleStyle}>Offline Maps</h4>
              {offlineSection}
            </section>
          ) : null}

          <LayerSection title="Visibility">
            {ASSET_LAYERS.map((layer) => (
              <ToggleRow
                key={layer.id}
                checked={visibleAssetLayers[layer.id]}
                label={VISIBILITY_LABELS[layer.id]}
                onToggle={() => onToggleLayer(layer.id)}
              />
            ))}
          </LayerSection>

          <LayerSection title="Property">
            <ToggleRow
              checked={showPropertyLines}
              label="Property Lines"
              onToggle={onTogglePropertyLines}
            />
            <ToggleRow
              checked={showOwnerNames}
              disabled={ownerNamesDisabled}
              label="Owner Names"
              onToggle={onToggleOwnerNames}
            />
            <ToggleRow
              checked={showParcelTiles}
              label="Land Owners"
              onToggle={onToggleParcelTiles}
            />
          </LayerSection>

          <LayerSection title="Map Tools">
            {MAP_TOOL_LABELS.map((tool) => (
              <ToggleRow
                key={tool.id}
                checked={mapTools[tool.id]}
                label={tool.label}
                onToggle={() => onToggleMapTool(tool.id)}
              />
            ))}
          </LayerSection>

          <LayerSection title="Future Layers">
            {FUTURE_LAYER_LABELS.map((label) => (
              <ToggleRow
                key={label}
                checked={false}
                disabled
                label={label}
                onToggle={() => undefined}
              />
            ))}
          </LayerSection>
        </div>
      </aside>
    </>
  );
}

function LayerSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionTitleStyle}>{title}</h4>
      <div style={toggleListStyle}>{children}</div>
    </section>
  );
}

function ToggleRow({
  checked,
  disabled = false,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      style={{
        ...toggleRowStyle,
        ...(checked ? activeToggleRowStyle : null),
        ...(disabled ? disabledToggleRowStyle : null),
      }}
      onClick={onToggle}
    >
      <span style={toggleLabelStyle}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          ...switchTrackStyle,
          ...(checked ? activeSwitchTrackStyle : null),
        }}
      >
        <span
          style={{
            ...switchKnobStyle,
            ...(checked ? activeSwitchKnobStyle : null),
          }}
        />
      </span>
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
  borderRadius: "8px",
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
  background: "rgba(5, 8, 6, 0.24)",
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 1610,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  width: "min(390px, calc(100% - 1rem))",
  borderLeft: "1px solid rgba(17, 23, 17, 0.14)",
  background: "rgba(248, 250, 246, 0.98)",
  color: "#111711",
  boxShadow: "-18px 0 42px rgba(0, 0, 0, 0.24)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1rem",
  borderBottom: "1px solid rgba(17, 23, 17, 0.1)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#56705a",
  fontSize: "0.75rem",
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.1rem 0 0",
  color: "#111711",
  fontSize: "1.2rem",
  lineHeight: 1.2,
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  width: "42px",
  minHeight: "42px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(17, 23, 17, 0.12)",
  borderRadius: "8px",
  background: "white",
  color: "#111711",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 900,
};

const contentStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "0.85rem",
  minHeight: 0,
  overflow: "auto",
  padding: "0.85rem",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#566157",
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const toggleListStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  minHeight: "48px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.5rem 0.55rem 0.5rem 0.75rem",
  border: "1px solid rgba(17, 23, 17, 0.1)",
  borderRadius: "8px",
  background: "white",
  color: "#172017",
  cursor: "pointer",
  textAlign: "left",
};

const activeToggleRowStyle: CSSProperties = {
  borderColor: "rgba(47, 109, 58, 0.42)",
  background: "#f0f7ee",
};

const disabledToggleRowStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.52,
};

const toggleLabelStyle: CSSProperties = {
  overflow: "hidden",
  fontSize: "0.94rem",
  fontWeight: 850,
  lineHeight: 1.2,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const switchTrackStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  width: "42px",
  height: "26px",
  flex: "0 0 auto",
  alignItems: "center",
  border: "1px solid rgba(17, 23, 17, 0.18)",
  borderRadius: "999px",
  background: "#d9ded8",
};

const activeSwitchTrackStyle: CSSProperties = {
  borderColor: "#2f6d3a",
  background: "#2f6d3a",
};

const switchKnobStyle: CSSProperties = {
  position: "absolute",
  left: "3px",
  width: "20px",
  height: "20px",
  borderRadius: "999px",
  background: "white",
  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25)",
  transition: "transform 160ms ease",
};

const activeSwitchKnobStyle: CSSProperties = {
  transform: "translateX(16px)",
};
