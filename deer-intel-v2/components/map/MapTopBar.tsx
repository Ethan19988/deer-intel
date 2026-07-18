"use client";

import type { CSSProperties } from "react";
import type { MapLayerId } from "@/lib/propertyMap";

type MapTopBarProps = {
  selectedLayer: MapLayerId;
  showContours: boolean;
  contourNeedsZoomIn: boolean;
  showSlope: boolean;
  showLandcover: boolean;
  showCameraHeat: boolean;
  showDeerHeat: boolean;
  showWind: boolean;
  showMovement: boolean;
  showTerrain: boolean;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleContours: () => void;
  onToggleSlope: () => void;
  onToggleLandcover: () => void;
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
  showCameraHeat,
  showDeerHeat,
  showWind,
  showMovement,
  showTerrain,
  onSelectLayer,
  onToggleContours,
  onToggleSlope,
  onToggleLandcover,
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
        style={{ ...pillStyle, ...(showContours ? activeSegmentStyle : null) }}
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
        style={{ ...pillStyle, ...(showSlope ? activePillStyle : null) }}
        onClick={onToggleSlope}
      >
        Slope Angle
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showLandcover}
        style={{ ...pillStyle, ...(showLandcover ? activeLandcoverPillStyle : null) }}
        onClick={onToggleLandcover}
      >
        Food &amp; Cover
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showCameraHeat}
        style={{ ...pillStyle, ...(showCameraHeat ? activeCameraHeatPillStyle : null) }}
        onClick={onToggleCameraHeat}
      >
        Camera Heat
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showDeerHeat}
        style={{ ...pillStyle, ...(showDeerHeat ? activeDeerHeatPillStyle : null) }}
        onClick={onToggleDeerHeat}
      >
        Deer Heat
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showWind}
        style={{ ...pillStyle, ...(showWind ? activeWindPillStyle : null) }}
        onClick={onToggleWind}
      >
        Wind
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showMovement}
        style={{ ...pillStyle, ...(showMovement ? activeMovementPillStyle : null) }}
        onClick={onToggleMovement}
      >
        Movement
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showTerrain}
        style={{ ...pillStyle, ...(showTerrain ? activeTerrainPillStyle : null) }}
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
  // Anchored in the band between the top-left search icon and the top-right
  // Layers button + zoom/GPS cluster, so a wide bar can't slide under them.
  // Content stays centered when it fits and scrolls (from the start) when it
  // doesn't — "safe center" keeps the leading base-map buttons reachable.
  left: "4.75rem",
  right: "11rem",
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

const activePillStyle: CSSProperties = {
  borderColor: "rgba(245, 168, 66, 0.6)",
  background: "#b45309",
  color: "white",
};

const activeCameraHeatPillStyle: CSSProperties = {
  borderColor: "rgba(239, 122, 36, 0.7)",
  background: "#b4471b",
  color: "white",
};

const activeDeerHeatPillStyle: CSSProperties = {
  borderColor: "rgba(209, 53, 43, 0.7)",
  background: "#9c231c",
  color: "white",
};

const activeLandcoverPillStyle: CSSProperties = {
  borderColor: "rgba(220, 217, 57, 0.65)",
  background: "#5c6d1e",
  color: "white",
};

const activeWindPillStyle: CSSProperties = {
  borderColor: "rgba(149, 210, 122, 0.6)",
  background: "#2f6d3a",
  color: "white",
};

const activeMovementPillStyle: CSSProperties = {
  borderColor: "rgba(168, 85, 247, 0.6)",
  background: "#6d28d9",
  color: "white",
};

const activeTerrainPillStyle: CSSProperties = {
  borderColor: "rgba(224, 100, 42, 0.6)",
  background: "#8a4b1e",
  color: "white",
};

const dividerStyle: CSSProperties = {
  width: "1px",
  alignSelf: "stretch",
  margin: "0.1rem 0",
  background: "rgba(255, 255, 255, 0.16)",
};
