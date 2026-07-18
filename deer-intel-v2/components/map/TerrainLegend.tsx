"use client";

import type { CSSProperties } from "react";
import { TERRAIN_STYLE, type TerrainKind } from "@/lib/terrainMovement";

// Key for the terrain-prediction overlay. Reads its colors + labels straight
// from TERRAIN_STYLE so the map and the legend can never drift apart. Sits
// bottom-left so it clears the centered slope-angle key when both are on.
const ORDER: TerrainKind[] = ["bedding", "travel", "pinch", "refuge"];

export default function TerrainLegend() {
  return (
    <div className="di-terrain-legend" style={wrapStyle} aria-label="Terrain prediction key">
      <span style={titleStyle}>Terrain Prediction</span>
      <div style={rowsStyle}>
        {ORDER.map((kind) => (
          <div key={kind} style={rowStyle}>
            <span style={{ ...swatchStyle, background: TERRAIN_STYLE[kind].color }} />
            <span style={labelStyle}>{TERRAIN_STYLE[kind].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  // Bottom-RIGHT. The bottom-left corner belongs to the Scout the Property
  // panel, which is anchored there at a higher z-index and simply covered these
  // keys. Bottom-right is the one free corner; the offset clears Leaflet's
  // attribution strip, which sits under it.
  bottom: "2.25rem",
  right: "1rem",
  zIndex: 1000,
  display: "grid",
  gap: "0.35rem",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#1c2417",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
  pointerEvents: "none",
};

const titleStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#3a4432",
};

const rowsStyle: CSSProperties = {
  display: "grid",
  gap: "0.28rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
};

const swatchStyle: CSSProperties = {
  width: "14px",
  height: "14px",
  borderRadius: "4px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.18)",
  flex: "0 0 auto",
};

const labelStyle: CSSProperties = {
  fontSize: "0.76rem",
  fontWeight: 700,
  color: "#3a4432",
  whiteSpace: "nowrap",
};
