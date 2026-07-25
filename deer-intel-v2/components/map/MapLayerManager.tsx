"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ASSET_LAYERS, type AssetLayerId } from "@/lib/propertyMap";
import { pinMarkerSvg } from "@/lib/mapPinIcon";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

export type MapToolId = "gps" | "compass" | "scaleBar";
export type MapToolState = Record<MapToolId, boolean>;

type MapLayerManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapTools: MapToolState;
  // Number of map overlays currently lit (from the top overlay bar), surfaced as
  // a badge on the button so you can tell what's on without scrolling the bar.
  activeOverlayCount?: number;
  pinBoxSection?: ReactNode;
  offlineSection?: ReactNode;
  trackingSection?: ReactNode;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onSetAllLayers: (visible: boolean) => void;
  onToggleMapTool: (toolId: MapToolId) => void;
};

const MAP_TOOL_LABELS: Array<{ id: MapToolId; label: string }> = [
  { id: "gps", label: "GPS" },
  { id: "compass", label: "Compass" },
  { id: "scaleBar", label: "Scale Bar" },
];

export default function MapLayerManager({
  open,
  onOpenChange,
  mapTools,
  activeOverlayCount = 0,
  pinBoxSection,
  offlineSection,
  trackingSection,
  visibleAssetLayers,
  onToggleLayer,
  onSetAllLayers,
  onToggleMapTool,
}: MapLayerManagerProps) {
  const isOpen = open;
  const visibleCount = Object.values(visibleAssetLayers).filter(
    Boolean,
  ).length;
  const anyVisible = visibleCount > 0;
  const hasFieldTools = Boolean(trackingSection || offlineSection);

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
        {activeOverlayCount > 0 ? (
          <span
            className="di-layer-manager-count"
            style={layersCountStyle}
            aria-label={`${activeOverlayCount} overlay${
              activeOverlayCount === 1 ? "" : "s"
            } on`}
          >
            {activeOverlayCount}
          </span>
        ) : null}
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
          {pinBoxSection ? (
            <>
              <GroupHeader icon={<PinPlusIcon />} label="Place a pin" />
              <section style={cardStyle}>{pinBoxSection}</section>
            </>
          ) : null}

          <GroupHeader icon={<LayersIcon />} label="On the map" />

          <CollapsibleSection
            title="Show on map"
            description={`${visibleCount} of ${ASSET_LAYERS.length} shown`}
            style={collapsibleCardStyle}
          >
            <div style={visActionRowStyle}>
              <button
                type="button"
                style={visAllButtonStyle}
                onClick={() => onSetAllLayers(!anyVisible)}
              >
                {anyVisible ? "Hide all" : "Show all"}
              </button>
            </div>
            <div style={chipGridStyle}>
              {ASSET_LAYERS.map((layer) => (
                <VisibilityChip
                  key={layer.id}
                  layerId={layer.id}
                  label={layer.label}
                  color={layer.color}
                  background={layer.background}
                  visible={visibleAssetLayers[layer.id]}
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

          {hasFieldTools ? (
            <>
              <GroupHeader icon={<TentIcon />} label="In the field" />

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

// A show/hide chip that carries the pin's real teardrop marker, so the same
// pin identity you tap to place is the one you toggle on the map. Dimmed and
// desaturated when hidden.
function VisibilityChip({
  layerId,
  label,
  color,
  background,
  visible,
  onToggle,
}: {
  layerId: AssetLayerId;
  label: string;
  color: string;
  background: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={`${visible ? "Hide" : "Show"} ${label}`}
      style={{
        ...chipStyle,
        ...(visible ? null : hiddenChipStyle),
      }}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        style={{
          ...chipPinStyle,
          filter: visible ? "none" : "grayscale(1)",
        }}
        dangerouslySetInnerHTML={{
          __html: pinMarkerSvg({
            color,
            background,
            glyphKey: layerId,
            width: 17,
          }),
        }}
      />
      <span>{label}</span>
    </button>
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

function PinPlusIcon() {
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
      <path d="M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10Z" />
      <path d="M12 8v5M9.5 10.5h5" />
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

// Blaze-orange count pill (matches the unified overlay "on" color) so the
// button reads "Layers 2" when two overlays are lit.
const layersCountStyle: CSSProperties = {
  display: "inline-flex",
  minWidth: "20px",
  height: "20px",
  marginLeft: "0.45rem",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 0.3rem",
  borderRadius: "999px",
  background: "#c2571c",
  color: "white",
  fontSize: "0.74rem",
  fontWeight: 900,
  lineHeight: 1,
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

const visActionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "0.55rem",
};

const visAllButtonStyle: CSSProperties = {
  padding: "0.15rem 0.3rem",
  border: 0,
  background: "transparent",
  color: "#2f6d3a",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const chipGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.45rem",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "34px",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.28rem 0.6rem 0.28rem 0.32rem",
  border: "1px solid rgba(47, 109, 58, 0.35)",
  borderRadius: "999px",
  background: "#f4f7f2",
  color: "#1b241b",
  cursor: "pointer",
  fontSize: "0.84rem",
  fontWeight: 750,
};

const hiddenChipStyle: CSSProperties = {
  borderColor: "rgba(17, 23, 17, 0.12)",
  background: "#eef0ec",
  color: "#9a9f97",
  opacity: 0.7,
};

const chipPinStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "24px",
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
