"use client";

import type { CSSProperties } from "react";
import type { MapLayerId } from "@/lib/propertyMap";

// Base map + overlay choices, shown on the Layers panel's "Map" tab. (These
// used to live in a "Satellite ▾" chip on the map's top row.)

export type OverlayKey =
  | "contours"
  | "slope"
  | "landcover"
  | "cameraHeat"
  | "deerHeat"
  | "wind"
  | "movement"
  | "terrain";

export type MapStylePickerProps = {
  selectedLayer: MapLayerId;
  overlays: Record<OverlayKey, boolean>;
  contourNeedsZoomIn: boolean;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleOverlay: (key: OverlayKey) => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  /** The base map has dated imagery to step through. */
  canBrowseImagery: boolean;
  showImageryYears: boolean;
  onToggleImageryYears: () => void;
};

const BASE_MAP_CHOICES: Array<{ id: MapLayerId; label: string }> = [
  { id: "hybrid", label: "Satellite" },
  { id: "topographic", label: "Aerial" },
  { id: "terrain", label: "Topo" },
  { id: "lidar", label: "LiDAR" },
  { id: "roads", label: "Roads" },
];

// Grouped so the list reads as "what deer are doing" vs "what the land is".
const OVERLAY_GROUPS: Array<{
  label: string;
  items: Array<{ key: OverlayKey; label: string }>;
}> = [
  {
    label: "Deer & wind",
    items: [
      { key: "wind", label: "Wind" },
      { key: "movement", label: "Movement" },
      { key: "deerHeat", label: "Deer Heat" },
      { key: "cameraHeat", label: "Camera Heat" },
    ],
  },
  {
    label: "The land",
    items: [
      { key: "terrain", label: "Terrain" },
      { key: "contours", label: "Contours" },
      { key: "slope", label: "Slope Angle" },
      { key: "landcover", label: "Food & Cover" },
    ],
  },
];

export default function MapStylePicker({
  selectedLayer,
  overlays,
  contourNeedsZoomIn,
  onSelectLayer,
  onToggleOverlay,
  showTrails,
  onToggleTrails,
  canBrowseImagery,
  showImageryYears,
  onToggleImageryYears,
}: MapStylePickerProps) {
  return (
    <div style={wrapStyle}>
      <div style={segmentGridStyle} role="radiogroup" aria-label="Map style">
        {BASE_MAP_CHOICES.map((choice) => {
          const isActive = choice.id === selectedLayer;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              style={{ ...segmentStyle, ...(isActive ? activeSegmentStyle : null) }}
              onClick={() => onSelectLayer(choice.id)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {canBrowseImagery ? (
        <button
          type="button"
          role="switch"
          aria-checked={showImageryYears}
          style={linkButtonStyle}
          onClick={onToggleImageryYears}
        >
          {showImageryYears ? "Hide older imagery" : "Browse older imagery →"}
        </button>
      ) : null}

      {OVERLAY_GROUPS.map((group) => (
        <div key={group.label} style={groupStyle}>
          <p style={groupLabelStyle}>{group.label}</p>
          <div style={pillWrapStyle}>
            {group.items.map((item) => (
              <OverlayPill
                key={item.key}
                label={item.label}
                on={overlays[item.key]}
                onToggle={() => onToggleOverlay(item.key)}
              />
            ))}
            {group.label === "The land" ? (
              <OverlayPill label="Trails & Logging Roads" on={showTrails} onToggle={onToggleTrails} />
            ) : null}
          </div>
        </div>
      ))}
      {overlays.contours && contourNeedsZoomIn ? (
        <p style={hintStyle}>Zoom in to see contours.</p>
      ) : null}
    </div>
  );
}

function OverlayPill({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      style={{ ...pillStyle, ...(on ? activePillStyle : null) }}
      onClick={onToggle}
    >
      {on ? <span aria-hidden="true">✓</span> : null}
      {label}
    </button>
  );
}

const wrapStyle: CSSProperties = { display: "grid", gap: "0.65rem" };

const segmentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "0.25rem",
  padding: "0.2rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-3)",
};

const segmentStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 0.2rem",
  border: 0,
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const activeSegmentStyle: CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-fg)",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
};

const linkButtonStyle: CSSProperties = {
  justifySelf: "start",
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--accent-text)",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 800,
};

const groupStyle: CSSProperties = { display: "grid", gap: "0.35rem" };

const groupLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const pillWrapStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.35rem" };

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  minHeight: "36px",
  padding: "0 0.7rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: "0.83rem",
  fontWeight: 750,
};

// Overlay "on" is blaze orange; the base-map choice stays green.
const activePillStyle: CSSProperties = {
  borderColor: "var(--accent-2)",
  background: "var(--accent-2)",
  color: "var(--accent-fg)",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--warning-text)",
  fontSize: "0.78rem",
  fontWeight: 700,
};
