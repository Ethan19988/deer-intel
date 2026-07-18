"use client";

import type { CSSProperties } from "react";
import { PERIOD_HEAT_LINE } from "@/lib/deerHeat";
import type { MovementPeriod } from "@/lib/movementPrediction";

// Key for the Deer Heat surface: the ramp plus WHY the map looks the way it
// does right now (the current movement period). Shares the bottom-left slot
// with the terrain and Food & Cover legends, so `lift` steps it above however
// many of those are showing.
const LIFT_REM = ["1.5rem", "9.5rem", "17.5rem"];

export default function DeerHeatLegend({
  period,
  lift = 0,
}: {
  period: MovementPeriod;
  lift?: number;
}) {
  return (
    <div
      style={{ ...wrapStyle, bottom: LIFT_REM[Math.min(lift, LIFT_REM.length - 1)] }}
      aria-label="Deer heat key"
    >
      <p style={titleStyle}>Deer Heat</p>
      <div style={rowStyle}>
        <span style={rampStyle} aria-hidden="true" />
        <span style={labelStyle}>hotter odds</span>
      </div>
      <p style={periodStyle}>{PERIOD_HEAT_LINE[period]}</p>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  left: "1rem",
  zIndex: 1000,
  maxWidth: "min(280px, calc(100% - 2rem))",
  padding: "0.5rem 0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "10px",
  background: "rgba(17, 23, 17, 0.82)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  pointerEvents: "none",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.3rem",
  color: "#f1f5ef",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
};

const rampStyle: CSSProperties = {
  width: "72px",
  height: "10px",
  borderRadius: "5px",
  // Matches the layer's amber → orange → red ramp.
  background: "linear-gradient(90deg, #f2c14e, #ef7a24, #d1352b)",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
  flex: "0 0 auto",
};

const labelStyle: CSSProperties = {
  color: "#d9e2d4",
  fontSize: "0.74rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const periodStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "#f2c98a",
  fontSize: "0.74rem",
  fontWeight: 700,
};
