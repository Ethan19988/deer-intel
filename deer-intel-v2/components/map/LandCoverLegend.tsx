"use client";

import type { CSSProperties } from "react";
import { LAND_COVER_LEGEND } from "@/lib/propertyMap";

// Key for the Food & Cover (NLCD) overlay — the colours are baked into the WMS
// render, so this is what makes them mean something. Dark card for legibility on
// the satellite; compact two-column grid so it stays short.
// `raised` lifts it above the terrain legend, which shares the bottom-left slot.
export default function LandCoverLegend({ raised = false }: { raised?: boolean }) {
  return (
    <div style={{ ...wrapStyle, bottom: raised ? "10.25rem" : "2.25rem" }}>
      <p style={titleStyle}>Food &amp; Cover</p>
      <div style={gridStyle}>
        {LAND_COVER_LEGEND.map((item) => (
          <div key={item.label} style={rowStyle}>
            <span
              style={{ ...swatchStyle, background: item.color }}
              aria-hidden="true"
            />
            <span style={labelStyle}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  // Bottom-right; see TerrainLegend for why this corner rather than the left.
  right: "1rem",
  zIndex: 1000,
  maxWidth: "min(340px, calc(100% - 2rem))",
  padding: "0.5rem 0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "10px",
  background: "rgba(17, 23, 17, 0.82)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.35rem",
  color: "#f1f5ef",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.1rem 0.6rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

const swatchStyle: CSSProperties = {
  flex: "0 0 auto",
  width: "12px",
  height: "12px",
  borderRadius: "3px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.35)",
};

const labelStyle: CSSProperties = {
  color: "#dbe6d7",
  fontSize: "0.72rem",
  lineHeight: 1.3,
  whiteSpace: "nowrap",
};
