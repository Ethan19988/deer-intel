"use client";

import type { CSSProperties } from "react";
import { LAND_COVER_LEGEND } from "@/lib/propertyMap";
import { TERRAIN_STYLE, type TerrainKind } from "@/lib/terrainMovement";
import { PERIOD_HEAT_LINE } from "@/lib/deerHeat";
import type { MovementPeriod } from "@/lib/movementPrediction";

// One consolidated key for every active map overlay. Replaces the four separate
// legend cards (slope, terrain, Food & Cover, Deer Heat) that used to stack in
// the bottom-right corner via hand-tuned offset math. Each overlay contributes a
// section only while it's on, so the card stays as short as the map is busy —
// and the corner is empty whenever nothing is overlaid.
const TERRAIN_ORDER: TerrainKind[] = ["bedding", "travel", "pinch", "refuge"];

type MapLegendProps = {
  showSlope: boolean;
  showTerrain: boolean;
  showLandcover: boolean;
  showDeerHeat: boolean;
  period: MovementPeriod;
};

export default function MapLegend({
  showSlope,
  showTerrain,
  showLandcover,
  showDeerHeat,
  period,
}: MapLegendProps) {
  const sections: Array<{ key: string; node: React.ReactNode }> = [];

  if (showSlope) {
    sections.push({
      key: "slope",
      node: (
        <div style={sectionStyle}>
          <p style={titleStyle}>Slope angle</p>
          <div style={slopeBarStyle} aria-hidden="true" />
          <div style={slopeTicksStyle}>
            <span>Flat</span>
            <span>15°</span>
            <span>30°</span>
            <span>45°+</span>
          </div>
        </div>
      ),
    });
  }

  if (showTerrain) {
    sections.push({
      key: "terrain",
      node: (
        <div style={sectionStyle}>
          <p style={titleStyle}>Terrain Prediction</p>
          <div style={swatchRowsStyle}>
            {TERRAIN_ORDER.map((kind) => (
              <div key={kind} style={swatchRowStyle}>
                <span
                  style={{ ...swatchStyle, background: TERRAIN_STYLE[kind].color }}
                  aria-hidden="true"
                />
                <span style={swatchLabelStyle}>{TERRAIN_STYLE[kind].label}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (showLandcover) {
    sections.push({
      key: "landcover",
      node: (
        <div style={sectionStyle}>
          <p style={titleStyle}>Food &amp; Cover</p>
          <div className="di-legend-cover-grid" style={landcoverGridStyle}>
            {LAND_COVER_LEGEND.map((item) => (
              <div key={item.label} style={swatchRowStyle}>
                <span
                  style={{ ...swatchStyle, background: item.color }}
                  aria-hidden="true"
                />
                <span style={swatchLabelStyle}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (showDeerHeat) {
    sections.push({
      key: "deerheat",
      node: (
        <div style={sectionStyle}>
          <p style={titleStyle}>Deer Heat</p>
          <div style={swatchRowStyle}>
            <span style={rampStyle} aria-hidden="true" />
            <span style={swatchLabelStyle}>hotter odds</span>
          </div>
          <p style={periodStyle}>{PERIOD_HEAT_LINE[period]}</p>
        </div>
      ),
    });
  }

  if (sections.length === 0) return null;

  return (
    <div className="di-map-legend" style={wrapStyle} aria-label="Map keys">
      {sections.map((section, index) => (
        <div
          key={section.key}
          style={index > 0 ? dividedSectionStyle : undefined}
        >
          {section.node}
        </div>
      ))}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  // Bottom-right is the one free corner: bottom-left belongs to the Scout the
  // Property panel, and the offset clears Leaflet's attribution strip.
  bottom: "2.25rem",
  right: "1rem",
  zIndex: 1000,
  display: "grid",
  gap: "0.55rem",
  maxWidth: "min(340px, calc(100% - 2rem))",
  padding: "0.6rem 0.7rem",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "12px",
  background: "rgba(17, 23, 17, 0.82)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  pointerEvents: "none",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

// Sections after the first get a hairline separator so several keys read as one
// tidy stack rather than a merged blob.
const dividedSectionStyle: CSSProperties = {
  paddingTop: "0.55rem",
  borderTop: "1px solid rgba(255, 255, 255, 0.14)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const swatchRowsStyle: CSSProperties = {
  display: "grid",
  gap: "0.28rem",
};

const swatchRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
};

const swatchStyle: CSSProperties = {
  flex: "0 0 auto",
  width: "13px",
  height: "13px",
  borderRadius: "4px",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
};

const swatchLabelStyle: CSSProperties = {
  color: "#dbe6d7",
  fontSize: "0.74rem",
  fontWeight: 700,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
};

const landcoverGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.1rem 0.6rem",
};

const slopeBarStyle: CSSProperties = {
  width: "160px",
  maxWidth: "100%",
  height: "10px",
  borderRadius: "999px",
  background:
    "linear-gradient(90deg, #f3edc0 0%, #e8c15a 33%, #e07a3c 66%, #c23b2f 100%)",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
};

const slopeTicksStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  width: "160px",
  maxWidth: "100%",
  color: "#d9e2d4",
  fontSize: "0.68rem",
  fontWeight: 800,
};

const rampStyle: CSSProperties = {
  width: "72px",
  height: "10px",
  borderRadius: "5px",
  background: "linear-gradient(90deg, #f2c14e, #ef7a24, #d1352b)",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
  flex: "0 0 auto",
};

const periodStyle: CSSProperties = {
  margin: 0,
  color: "#f2c98a",
  fontSize: "0.74rem",
  fontWeight: 700,
};
