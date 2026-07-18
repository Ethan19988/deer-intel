"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ASSET_LAYERS, type AssetLayerId } from "@/lib/propertyMap";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

export type MapToolId = "gps" | "compass" | "scaleBar";
export type MapToolState = Record<MapToolId, boolean>;

type MapLayerManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapTools: MapToolState;
  pinBoxSection?: ReactNode;
  offlineSection?: ReactNode;
  trackingSection?: ReactNode;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onToggleMapTool: (toolId: MapToolId) => void;
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
  open,
  onOpenChange,
  mapTools,
  pinBoxSection,
  offlineSection,
  trackingSection,
  visibleAssetLayers,
  onToggleLayer,
  onToggleMapTool,
}: MapLayerManagerProps) {
  const isOpen = open;
  const visibleCount = Object.values(visibleAssetLayers).filter(
    Boolean,
  ).length;
  const hasFieldTools = Boolean(
    pinBoxSection || trackingSection || offlineSection,
  );

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onOpenChange]);

  return (
    <>
      <button
        type="button"
        className="di-layer-manager-button"
        style={layersButtonStyle}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(true);
        }}
      >
        Layers
      </button>

      <div
        className={`di-layer-manager-backdrop${
          isOpen ? " di-layer-manager-backdrop-open" : ""
        }`}
        style={backdropStyle}
        onClick={() => onOpenChange(false)}
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
            onClick={() => onOpenChange(false)}
          >
            X
          </button>
        </header>

        <div style={contentStyle}>
          {hasFieldTools ? (
            <>
              <GroupHeader icon={<TentIcon />} label="In the field" />

              {pinBoxSection ? (
                <section style={cardStyle}>{pinBoxSection}</section>
              ) : null}

              {trackingSection ? (
                <section style={cardStyle}>
                  <h4 style={cardTitleStyle}>Walk tracking</h4>
                  {trackingSection}
                </section>
              ) : null}

              {offlineSection ? (
                <section style={cardStyle}>
                  <h4 style={cardTitleStyle}>Offline maps</h4>
                  {offlineSection}
                </section>
              ) : null}
            </>
          ) : null}

          <GroupHeader icon={<LayersIcon />} label="On the map" />

          <CollapsibleSection
            title="Pin visibility"
            description={`${visibleCount} of ${ASSET_LAYERS.length} shown`}
            style={collapsibleCardStyle}
          >
            <div style={toggleListStyle}>
              {ASSET_LAYERS.map((layer, index) => (
                <ToggleRow
                  key={layer.id}
                  divider={index > 0}
                  checked={visibleAssetLayers[layer.id]}
                  label={VISIBILITY_LABELS[layer.id]}
                  onToggle={() => onToggleLayer(layer.id)}
                />
              ))}
            </div>
          </CollapsibleSection>

          <section style={cardStyle}>
            <h4 style={cardTitleStyle}>Map tools</h4>
            <div style={toggleListStyle}>
              {MAP_TOOL_LABELS.map((tool, index) => (
                <ToggleRow
                  key={tool.id}
                  divider={index > 0}
                  checked={mapTools[tool.id]}
                  label={tool.label}
                  onToggle={() => onToggleMapTool(tool.id)}
                />
              ))}
            </div>
          </section>

          <GroupHeader icon={<ClockIcon />} label="Coming soon" />

          <section style={{ ...cardStyle, opacity: 0.72 }}>
            <h4 style={cardTitleStyle}>Future layers</h4>
            <div style={toggleListStyle}>
              {FUTURE_LAYER_LABELS.map((label, index) => (
                <ToggleRow
                  key={label}
                  divider={index > 0}
                  checked={false}
                  disabled
                  label={label}
                  onToggle={() => undefined}
                />
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function GroupHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div style={groupHeaderStyle}>
      <span style={groupIconStyle} aria-hidden="true">
        {icon}
      </span>
      <span style={groupLabelStyle}>{label}</span>
      <span style={groupLineStyle} aria-hidden="true" />
    </div>
  );
}

function ToggleRow({
  checked,
  disabled = false,
  divider = false,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  divider?: boolean;
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
        ...(divider ? dividerStyle : null),
        ...(disabled ? disabledToggleRowStyle : null),
      }}
      onClick={onToggle}
    >
      <span
        style={{
          ...toggleLabelStyle,
          ...(checked ? activeToggleLabelStyle : null),
        }}
      >
        {label}
      </span>
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

function TentIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 3 20h18L12 3z" />
      <path d="M12 9v11" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
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
  gap: "0.55rem",
  minHeight: 0,
  overflow: "auto",
  padding: "0.85rem",
};

// Group divider: a small icon + green label + a rule that fills the row, with
// extra top space so the three groups read as distinct bands, not one list.
const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  marginTop: "0.6rem",
  padding: "0 0.15rem",
};

const groupIconStyle: CSSProperties = {
  display: "inline-flex",
  color: "#2f6d3a",
};

const groupLabelStyle: CSSProperties = {
  color: "#2f6d3a",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

const groupLineStyle: CSSProperties = {
  flex: 1,
  height: "1px",
  background: "rgba(47, 109, 58, 0.2)",
};

// Each section is a white card so it reads as a distinct block on the panel.
const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.75rem 0.8rem",
  border: "1px solid rgba(17, 23, 17, 0.12)",
  borderRadius: "12px",
  background: "white",
};

// Round the collapsible to match the plain cards (its border/fill already do).
const collapsibleCardStyle: CSSProperties = {
  borderRadius: "12px",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#1b241b",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const toggleListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

// Rows inside a card are borderless and separated by a hairline divider, so a
// section reads as one grouped list instead of a stack of little boxes.
const toggleRowStyle: CSSProperties = {
  display: "flex",
  minHeight: "44px",
  width: "100%",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.5rem 0.15rem",
  border: 0,
  background: "transparent",
  color: "#172017",
  cursor: "pointer",
  textAlign: "left",
};

const dividerStyle: CSSProperties = {
  borderTop: "1px solid rgba(17, 23, 17, 0.08)",
};

const disabledToggleRowStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.55,
};

const toggleLabelStyle: CSSProperties = {
  overflow: "hidden",
  fontSize: "0.94rem",
  fontWeight: 750,
  lineHeight: 1.2,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const activeToggleLabelStyle: CSSProperties = {
  color: "#1f5a2a",
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
