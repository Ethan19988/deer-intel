"use client";

import type { CSSProperties } from "react";
import {
  movementPeriodLabel,
  type MovementForecast,
  type MovementRating,
} from "@/lib/movementPrediction";

export type MovementBadgeStatus = "loading" | "error" | "ok";

type MovementBadgeProps = {
  status: MovementBadgeStatus;
  forecast: MovementForecast | null;
  corridorCount: number;
  direction: "to-resource" | "to-bedding" | "two-way";
  hasBedding: boolean;
  hasResources: boolean;
  personalized: boolean;
  sampleSize: number;
  hotCorridorCount: number;
  phaseLabel: string;
  phaseScoped: boolean;
  regionLabel: string;
  rutShiftDays: number;
};

// Reads out the movement outlook driving the corridors: the period, a scored
// rating with the factors behind it, and where deer are most likely headed now.
export default function MovementBadge({
  status,
  forecast,
  corridorCount,
  direction,
  hasBedding,
  hasResources,
  personalized,
  sampleSize,
  hotCorridorCount,
  phaseLabel,
  phaseScoped,
  regionLabel,
  rutShiftDays,
}: MovementBadgeProps) {
  return (
    <div style={badgeStyle} onDoubleClick={(event) => event.stopPropagation()}>
      <div style={headerRowStyle}>
        <span style={eyebrowStyle}>Movement outlook</span>
        {status === "ok" ? (
          <span
            style={{
              ...tuneChipStyle,
              ...(personalized ? tuneChipOnStyle : null),
            }}
            title={
              personalized
                ? phaseScoped
                  ? `Tuned to ${sampleSize} ${phaseLabel.toLowerCase()} deer photos on this property`
                  : `Tuned to ${sampleSize} timestamped deer photos (not enough ${phaseLabel.toLowerCase()} photos yet, so all seasons are used)`
                : "Not enough timestamped photos yet — using general patterns"
            }
          >
            {personalized
              ? phaseScoped
                ? `Tuned · ${sampleSize}`
                : `All-season · ${sampleSize}`
              : "General"}
          </span>
        ) : null}
      </div>

      {status === "loading" ? (
        <p style={noteStyle}>Reading conditions…</p>
      ) : status === "error" ? (
        <p style={noteStyle}>
          Movement outlook needs live weather. Add a property location or a
          camera/pin to anchor it.
        </p>
      ) : forecast ? (
        <>
          <div style={ratingRowStyle}>
            <span
              style={{
                ...ratingChipStyle,
                ...ratingChipColor(forecast.rating),
              }}
            >
              {forecast.rating}
            </span>
            <span style={periodStyle}>
              {movementPeriodLabel(forecast.period)} movement
            </span>
          </div>

          <p
            style={phaseRegionStyle}
            title={
              rutShiftDays > 0
                ? `${regionLabel} region — rut runs about ${rutShiftDays} days later than the northern baseline.`
                : `${regionLabel} region — rut is on the northern (photoperiod) calendar.`
            }
          >
            <span style={phaseNameStyle}>{phaseLabel}</span>
            {" · "}
            {regionLabel} region
            {rutShiftDays > 0 ? ` (rut ~${rutShiftDays}d later)` : ""}
          </p>

          {forecast.factors.length > 0 ? (
            <ul style={factorListStyle}>
              {forecast.factors.slice(0, 4).map((factor) => (
                <li key={factor} style={factorItemStyle}>
                  <span aria-hidden="true" style={factorDotStyle}>
                    •
                  </span>
                  {factor}
                </li>
              ))}
            </ul>
          ) : null}

          <p style={corridorNoteStyle}>{corridorNote(corridorCount, direction, hasBedding, hasResources)}</p>

          {hotCorridorCount > 0 ? (
            <p style={hotNoteStyle}>
              {hotCorridorCount} corridor{hotCorridorCount === 1 ? "" : "s"} glowing
              — backed by camera hits at {movementPeriodLabel(forecast.period).toLowerCase()}.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function corridorNote(
  count: number,
  direction: MovementBadgeProps["direction"],
  hasBedding: boolean,
  hasResources: boolean,
): string {
  if (count === 0) {
    if (!hasBedding && !hasResources) {
      return "Drop Bedding and Food/Water pins to predict travel corridors.";
    }
    if (!hasBedding) return "Add Bedding pins to predict travel corridors.";
    if (!hasResources) return "Add Food or Water pins to predict travel corridors.";
    return "No bedding sits close enough to food/water for a corridor.";
  }

  const heading =
    direction === "to-resource"
      ? "→ heading to food/water now"
      : direction === "to-bedding"
        ? "→ heading back to bedding now"
        : "→ two-way (no strong pull this hour)";

  return `${count} corridor${count === 1 ? "" : "s"} ${heading}.`;
}

function ratingChipColor(rating: MovementRating): CSSProperties {
  if (rating === "Prime") {
    return {
      border: "1px solid rgba(63, 185, 80, 0.6)",
      background: "rgba(63, 185, 80, 0.2)",
      color: "#a6e6ad",
    };
  }
  if (rating === "Good") {
    return {
      border: "1px solid rgba(149, 210, 122, 0.55)",
      background: "rgba(149, 210, 122, 0.16)",
      color: "#cfe8bc",
    };
  }
  if (rating === "Fair") {
    return {
      border: "1px solid rgba(245, 179, 1, 0.5)",
      background: "rgba(245, 179, 1, 0.16)",
      color: "#f2d288",
    };
  }
  return {
    border: "1px solid rgba(159, 170, 157, 0.45)",
    background: "rgba(159, 170, 157, 0.14)",
    color: "#c4cfc0",
  };
}

const badgeStyle: CSSProperties = {
  position: "absolute",
  bottom: "1.4rem",
  right: "1rem",
  zIndex: 1050,
  width: "min(268px, calc(100% - 2rem))",
  display: "grid",
  gap: "0.5rem",
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
  gap: "0.5rem",
};

const eyebrowStyle: CSSProperties = {
  color: "#c9d6c6",
  fontSize: "0.72rem",
  fontWeight: 900,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const tuneChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.15rem 0.45rem",
  borderRadius: "999px",
  border: "1px solid rgba(159, 170, 157, 0.4)",
  background: "rgba(159, 170, 157, 0.14)",
  color: "#c4cfc0",
  fontSize: "0.68rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tuneChipOnStyle: CSSProperties = {
  borderColor: "rgba(168, 85, 247, 0.55)",
  background: "rgba(168, 85, 247, 0.2)",
  color: "#d9c2f7",
};

const noteStyle: CSSProperties = {
  margin: 0,
  color: "#d7e0d4",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const ratingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const ratingChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.82rem",
  fontWeight: 900,
};

const periodStyle: CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 800,
};

const phaseRegionStyle: CSSProperties = {
  margin: 0,
  color: "#c4cfc0",
  fontSize: "0.78rem",
  fontWeight: 700,
  lineHeight: 1.3,
};

const phaseNameStyle: CSSProperties = {
  color: "#e0c8ff",
  fontWeight: 900,
};

const factorListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.2rem",
  listStyle: "none",
};

const factorItemStyle: CSSProperties = {
  display: "flex",
  gap: "0.4rem",
  color: "#d4ddd0",
  fontSize: "0.78rem",
  lineHeight: 1.3,
};

const factorDotStyle: CSSProperties = {
  color: "#a855f7",
  fontWeight: 900,
};

const corridorNoteStyle: CSSProperties = {
  margin: 0,
  color: "#c6b6e8",
  fontSize: "0.76rem",
  fontWeight: 700,
  lineHeight: 1.3,
};

const hotNoteStyle: CSSProperties = {
  margin: 0,
  color: "#e0c8ff",
  fontSize: "0.76rem",
  fontWeight: 800,
  lineHeight: 1.3,
};
