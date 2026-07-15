"use client";

import { useState, type CSSProperties } from "react";
import { TERRAIN_STYLE, type LatLng, type TerrainMovementSet } from "@/lib/terrainMovement";
import { getScoutPicks } from "@/lib/terrainMovementData";

type ScoutPicksPanelProps = {
  set: TerrainMovementSet | null;
  onSelect: (point: LatLng) => void;
};

// A ranked "go scout these" list for the terrain overlay. Reads the same
// TerrainMovementSet the map draws, so the list and the map never disagree.
// Tapping a pick flies the map to that spot. Dark card for legibility over the
// satellite imagery; collapsible so it stays out of the way on a phone.
export default function ScoutPicksPanel({ set, onSelect }: ScoutPicksPanelProps) {
  const [open, setOpen] = useState(true);

  if (!set) {
    return (
      <div style={wrapStyle}>
        <p style={hintStyle}>
          No terrain prediction for this view yet — pan to a covered property.
        </p>
      </div>
    );
  }

  const picks = getScoutPicks(set);

  return (
    <div style={wrapStyle} onDoubleClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        style={headerStyle}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span style={titleStyle}>Scout Picks · {set.areaName}</span>
        <span style={countStyle}>{open ? "▾" : `${picks.length} ▸`}</span>
      </button>

      {open ? (
        <div style={listStyle}>
          {picks.map((pick) => (
            <button
              key={pick.id}
              type="button"
              style={rowStyle}
              onClick={() => onSelect(pick.point)}
            >
              <span style={rankStyle}>{pick.rank}</span>
              <span
                style={{ ...dotStyle, background: TERRAIN_STYLE[pick.kind].color }}
                aria-hidden="true"
              />
              <span style={rowBodyStyle}>
                <span style={rowTitleStyle}>{pick.title}</span>
                {pick.windNote ? (
                  <span style={rowWindStyle}>🌬️ {pick.windNote}</span>
                ) : null}
              </span>
            </button>
          ))}
          <p style={footStyle}>{set.source}</p>
        </div>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  bottom: "1.4rem",
  right: "1rem",
  zIndex: 1050,
  width: "min(280px, calc(100% - 2rem))",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: "12px",
  background: "rgba(17, 23, 17, 0.82)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  width: "100%",
  padding: "0.6rem 0.75rem",
  border: "none",
  background: "transparent",
  color: "#f1f5ef",
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const countStyle: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 800,
  color: "#c6d5c5",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  maxHeight: "min(46vh, 320px)",
  overflowY: "auto",
  padding: "0 0.5rem 0.5rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  width: "100%",
  padding: "0.5rem 0.5rem",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#eaf0e6",
  cursor: "pointer",
  textAlign: "left",
};

const rankStyle: CSSProperties = {
  flex: "0 0 auto",
  minWidth: "1.1rem",
  color: "#c6d5c5",
  fontSize: "0.82rem",
  fontWeight: 900,
};

const dotStyle: CSSProperties = {
  flex: "0 0 auto",
  width: "12px",
  height: "12px",
  marginTop: "0.15rem",
  borderRadius: "3px",
  boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.25)",
};

const rowBodyStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
};

const rowTitleStyle: CSSProperties = {
  fontSize: "0.86rem",
  fontWeight: 800,
  lineHeight: 1.2,
};

const rowWindStyle: CSSProperties = {
  fontSize: "0.74rem",
  color: "#b9c8b6",
  lineHeight: 1.3,
};

const footStyle: CSSProperties = {
  margin: "0.2rem 0.25rem 0",
  color: "#8ea08b",
  fontSize: "0.66rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  padding: "0.7rem 0.8rem",
  color: "#d6e0d3",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};
