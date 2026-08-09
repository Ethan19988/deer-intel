"use client";

import type { CSSProperties } from "react";
import type { MapLayerId } from "@/lib/propertyMap";

type MapTopBarProps = {
  selectedLayer: MapLayerId;
  showContours: boolean;
  contourNeedsZoomIn: boolean;
  showSlope: boolean;
  showLandcover: boolean;
  showTrails: boolean;
  showCameraHeat: boolean;
  showDeerHeat: boolean;
  showWind: boolean;
  showMovement: boolean;
  showTerrain: boolean;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleContours: () => void;
  onToggleSlope: () => void;
  onToggleLandcover: () => void;
  onToggleTrails: () => void;
  onToggleCameraHeat: () => void;
  onToggleDeerHeat: () => void;
  onToggleWind: () => void;
  onToggleMovement: () => void;
  onToggleTerrain: () => void;
};

// A curated, one-tap subset of the base maps kept short for the top bar; the
// full set (and every other layer toggle) still lives in the Layers drawer.
const BASE_MAP_CHOICES: Array<{ id: MapLayerId; label: string }> = [
  { id: "hybrid", label: "Satellite" },
  { id: "topographic", label: "Aerial" },
  { id: "terrain", label: "Topo" },
  { id: "lidar", label: "LiDAR" },
  { id: "roads", label: "Roads" },
];

export default function MapTopBar({
  selectedLayer,
  showContours,
  contourNeedsZoomIn,
  showSlope,
  showLandcover,
  showTrails,
  showCameraHeat,
  showDeerHeat,
  showWind,
  showMovement,
  showTerrain,
  onSelectLayer,
  onToggleContours,
  onToggleSlope,
  onToggleLandcover,
  onToggleTrails,
  onToggleCameraHeat,
  onToggleDeerHeat,
  onToggleWind,
  onToggleMovement,
  onToggleTerrain,
}: MapTopBarProps) {
  return (
    <div
      className="di-map-topbar"
      style={barStyle}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={groupStyle} role="radiogroup" aria-label="Base map">
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

      <span style={dividerStyle} aria-hidden="true" />

      <button
        type="button"
        role="switch"
        aria-checked={showContours}
        style={{ ...pillStyle, ...(showContours ? activeOverlayPillStyle : null) }}
        onClick={onToggleContours}
      >
        Contours
      </button>
      {contourNeedsZoomIn ? (
        <span style={contourHintStyle} role="status">
          Zoom in to see
        </span>
      ) : null}

      <button
        type="button"
        role="switch"
        aria-checked={showSlope}
        style={{ ...pillStyle, ...(showSlope ? activeOverlayPillStyle : null) }}
        onClick={onToggleSlope}
      >
        Slope Angle
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showLandcover}
        style={{ ...pillStyle, ...(showLandcover ? activeOverlayPillStyle : null) }}
        onClick={onToggleLandcover}
      >
        Food &amp; Cover
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showTrails}
        style={{ ...pillStyle, ...(showTrails ? activeOverlayPillStyle : null) }}
        onClick={onToggleTrails}
      >
        Trails
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showCameraHeat}
        style={{ ...pillStyle, ...(showCameraHeat ? activeOverlayPillStyle : null) }}
        onClick={onToggleCameraHeat}
      >
        Camera Heat
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showDeerHeat}
        style={{ ...pillStyle, ...(showDeerHeat ? activeOverlayPillStyle : null) }}
        onClick={onToggleDeerHeat}
      >
        Deer Heat
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showWind}
        style={{ ...pillStyle, ...(showWind ? activeOverlayPillStyle : null) }}
        onClick={onToggleWind}
      >
        Wind
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showMovement}
        style={{ ...pillStyle, ...(showMovement ? activeOverlayPillStyle : null) }}
        onClick={onToggleMovement}
      >
        Movement
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showTerrain}
        style={{ ...pillStyle, ...(showTerrain ? activeOverlayPillStyle : null) }}
        onClick={onToggleTerrain}
      >
        Terrain
      </button>
    </div>
  );
}

const barStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  // Now that search moved to the top-right by the Layers gear, the bar owns the
  // freed top-left and runs the full width up to the search + gear + zoom
  // cluster. Content stays centered when it fits and scrolls (from the start)
  // when it doesn't — "safe center" keeps the leading base-map buttons reachable.
  left: "1rem",
  right: "16.5rem",
  zIndex: 1050,
  display: "flex",
  alignItems: "center",
  justifyContent: "safe center",
  gap: "0.5rem",
  padding: "0.35rem",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: "12px",
  background: "rgba(17, 23, 17, 0.62)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  overflowX: "auto",
};

const groupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.2rem",
};

const contourHintStyle: CSSProperties = {
  color: "#f2c98a",
  fontSize: "0.72rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const segmentStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "34px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.4rem 0.72rem",
  border: "1px solid transparent",
  borderRadius: "8px",
  background: "transparent",
  color: "#e7efe4",
  cursor: "pointer",
  fontSize: "0.86rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const activeSegmentStyle: CSSProperties = {
  borderColor: "rgba(149, 210, 122, 0.55)",
  background: "#2f6d3a",
  color: "white",
};

const pillStyle: CSSProperties = {
  ...segmentStyle,
  border: "1px solid rgba(255, 255, 255, 0.2)",
};

// Every overlay toggle shares ONE "on" treatment — a photo-safe blaze-orange
// (the app's --accent-2 accent, kept as a fixed value so it stays legible over
// imagery in every theme). Base-map selection stays green (activeSegmentStyle),
// so the bar reads as two clear states: which base map, and which overlays are on
// — instead of eight competing colors.
const activeOverlayPillStyle: CSSProperties = {
  borderColor: "rgba(240, 150, 70, 0.6)",
  background: "#c2571c",
  color: "white",
};

const dividerStyle: CSSProperties = {
  width: "1px",
  alignSelf: "stretch",
  margin: "0.1rem 0",
  background: "rgba(255, 255, 255, 0.16)",
};
