"use client";

import type { CSSProperties } from "react";
import { compassToBearing, type ThermalCue } from "@/lib/windViz";

export type WindBadgeStatus = "loading" | "error" | "ok";

type WindThermalBadgeProps = {
  status: WindBadgeStatus;
  windFromCompass: string;
  speedLabel: string;
  thermal: ThermalCue | null;
  standCount: number;
  goodCount: number;
  avoidCount: number;
  matchedCount: number;
};

// A compact card that reads out the live wind driving the scent cones, with an
// arrow pointing the way scent actually travels (down-wind), plus the thermal
// cue for the current time of day.
export default function WindThermalBadge({
  status,
  windFromCompass,
  speedLabel,
  thermal,
  standCount,
  goodCount,
  avoidCount,
  matchedCount,
}: WindThermalBadgeProps) {
  const fromBearing = compassToBearing(windFromCompass);
  const downwindBearing = fromBearing === null ? null : (fromBearing + 180) % 360;

  return (
    <div style={badgeStyle} onDoubleClick={(event) => event.stopPropagation()}>
      <div style={headerRowStyle}>
        <span style={eyebrowStyle}>Wind &amp; Thermals</span>
      </div>

      {status === "loading" ? (
        <p style={noteStyle}>Reading live wind…</p>
      ) : status === "error" ? (
        <p style={noteStyle}>
          Live wind unavailable. Add a property location or camera/pin to anchor
          the forecast.
        </p>
      ) : (
        <>
          <div style={windRowStyle}>
            <span
              aria-hidden="true"
              style={{
                ...arrowStyle,
                transform:
                  downwindBearing === null
                    ? undefined
                    : `rotate(${downwindBearing}deg)`,
              }}
            >
              ↑
            </span>
            <div style={windTextStyle}>
              <span style={windMainStyle}>
                Wind from {windFromCompass || "—"}
              </span>
              <span style={windSubStyle}>
                {speedLabel || "speed unknown"} · scent blows{" "}
                {downwindArrowLabel(downwindBearing)}
              </span>
            </div>
          </div>

          {thermal ? (
            <div style={thermalRowStyle}>
              <span
                style={{
                  ...thermalDotStyle,
                  background: thermalColor(thermal.phase),
                }}
                aria-hidden="true"
              />
              <div style={windTextStyle}>
                <span style={windMainStyle}>{thermal.label}</span>
                <span style={windSubStyle}>{thermal.hint}</span>
              </div>
            </div>
          ) : null}

          {matchedCount > 0 ? (
            <div style={countRowStyle}>
              <span style={{ ...countChipStyle, ...goodChipStyle }}>
                {goodCount} good
              </span>
              <span style={{ ...countChipStyle, ...avoidChipStyle }}>
                {avoidCount} wrong wind
              </span>
            </div>
          ) : null}

          <p style={coneNoteStyle}>
            {standCount === 0
              ? "Drop stand pins to see their scent cones here."
              : matchedCount > 0
                ? `${standCount} scent cone${standCount === 1 ? "" : "s"} · colored by each stand's saved winds.`
                : `${standCount} scent cone${standCount === 1 ? "" : "s"} shown. Name a stand pin to match a saved stand for good/wrong-wind colors.`}
          </p>
        </>
      )}
    </div>
  );
}

function downwindArrowLabel(bearing: number | null): string {
  if (bearing === null) return "—";
  const points = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];
  const index = Math.round(bearing / 45) % points.length;
  return `to the ${points[index]}`;
}

function thermalColor(phase: ThermalCue["phase"]): string {
  if (phase === "uphill") return "#f5c542";
  if (phase === "downhill") return "#74c7ff";
  return "#9faa9d";
}

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: "4.6rem",
  right: "1rem",
  zIndex: 1050,
  width: "min(260px, calc(100% - 2rem))",
  display: "grid",
  gap: "0.55rem",
  padding: "0.7rem 0.8rem",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: "12px",
  background: "rgba(17, 23, 17, 0.66)",
  backdropFilter: "blur(6px)",
  color: "#f3f1e6",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const eyebrowStyle: CSSProperties = {
  color: "#c9d6c6",
  fontSize: "0.72rem",
  fontWeight: 900,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const noteStyle: CSSProperties = {
  margin: 0,
  color: "#d7e0d4",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const windRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const arrowStyle: CSSProperties = {
  display: "inline-flex",
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  background: "rgba(249, 115, 22, 0.22)",
  color: "#ffd7b0",
  fontSize: "1.15rem",
  fontWeight: 900,
};

const windTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  minWidth: 0,
};

const windMainStyle: CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 800,
  lineHeight: 1.2,
};

const windSubStyle: CSSProperties = {
  color: "#c4cfc0",
  fontSize: "0.76rem",
  lineHeight: 1.3,
};

const thermalRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  paddingTop: "0.5rem",
  borderTop: "1px solid rgba(255, 255, 255, 0.14)",
};

const thermalDotStyle: CSSProperties = {
  display: "inline-flex",
  width: "14px",
  height: "14px",
  flex: "0 0 auto",
  borderRadius: "999px",
};

const countRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.4rem",
};

const countChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.5rem",
  borderRadius: "999px",
  fontSize: "0.76rem",
  fontWeight: 800,
};

const goodChipStyle: CSSProperties = {
  border: "1px solid rgba(63, 185, 80, 0.5)",
  background: "rgba(63, 185, 80, 0.18)",
  color: "#a6e6ad",
};

const avoidChipStyle: CSSProperties = {
  border: "1px solid rgba(239, 68, 68, 0.5)",
  background: "rgba(239, 68, 68, 0.16)",
  color: "#f4a6a6",
};

const coneNoteStyle: CSSProperties = {
  margin: 0,
  color: "#aeb9ab",
  fontSize: "0.74rem",
  lineHeight: 1.3,
};
