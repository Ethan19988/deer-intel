"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type CSSProperties } from "react";
import { insightLabelStyle } from "@/components/insights/StatPrimitives";
import EmptyState from "@/components/ui/EmptyState";
import { MapIcon } from "@/components/ui/FieldIcons";
import { rutPhaseLabel } from "@/lib/seasonCalendar";
import {
  buildSightingHeat,
  heatExtentPoints,
  heatSpotLine,
  HEAT_TIME_OPTIONS,
  type HeatInput,
  type HeatPhaseFilter,
  type HeatTimeFilter,
  type HeatWeight,
} from "@/lib/sightingHeat";
import { RUT_PHASE_ORDER, type StatsContext } from "@/lib/standStats";

// Leaflet touches `window`, so the map loads client-side only.
const SightingHeatMap = dynamic(() => import("@/components/insights/SightingHeatMap"), {
  ssr: false,
  loading: () => <div style={loadingStyle}>Loading map…</div>,
});

type SightingHeatPanelProps = {
  input: HeatInput;
  ctx: StatsContext;
};

export default function SightingHeatPanel({ input, ctx }: SightingHeatPanelProps) {
  const [time, setTime] = useState<HeatTimeFilter>("all");
  const [phase, setPhase] = useState<HeatPhaseFilter>("all");
  const [weight, setWeight] = useState<HeatWeight>("deer");

  const extent = useMemo(() => heatExtentPoints(input), [input]);
  const spots = useMemo(
    () => buildSightingHeat(input, { time, phase, weight }, ctx),
    [input, time, phase, weight, ctx],
  );

  if (extent.length === 0) {
    return (
      <EmptyState
        illustration={<MapIcon size={22} />}
        title="Nothing on the map yet"
        description="Sighting heat shows where your sits and camera hits cluster. It appears once a stand has a map pin or a camera has a location."
      />
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={filterRowStyle}>
        <div role="group" aria-label="Time of day" style={segmentStyle}>
          {HEAT_TIME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={time === option.id}
              onClick={() => setTime(option.id)}
              style={{ ...segmentButtonStyle, ...(time === option.id ? segmentActiveStyle : null) }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Weight" style={segmentStyle}>
          {(["deer", "bucks"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={weight === id}
              onClick={() => setWeight(id)}
              style={{ ...segmentButtonStyle, ...(weight === id ? segmentActiveStyle : null) }}
            >
              {id === "deer" ? "All deer" : "Bucks"}
            </button>
          ))}
        </div>
        <label style={selectWrapStyle}>
          <span style={insightLabelStyle}>Rut phase</span>
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value as HeatPhaseFilter)}
            style={selectStyle}
          >
            <option value="all">Whole season</option>
            {RUT_PHASE_ORDER.map((id) => (
              <option key={id} value={id}>
                {rutPhaseLabel(id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={mapFrameStyle}>
        <SightingHeatMap spots={spots} extent={extent} />
        {spots.length === 0 ? (
          <p style={mapNoteStyle}>No sightings match these filters.</p>
        ) : null}
      </div>

      <p style={legendStyle}>
        <span style={{ ...legendDotStyle, background: "#e8e6df" }} /> Stand (sits, by deer seen)
        <span style={{ ...legendDotStyle, background: "#ff6a1a", marginLeft: "0.75rem" }} /> Camera (photo hits)
        {time !== "all" ? " · camera checks without photo times are left out" : ""}
      </p>

      {spots.length > 0 ? (
        <ol style={listStyle}>
          {spots.slice(0, 5).map((spot) => (
            <li key={spot.id} style={listItemStyle}>
              <span style={listNameStyle}>{spot.name}</span>
              <span style={listDetailStyle}>{heatSpotLine(spot)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  minWidth: 0,
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "0.5rem",
};

const segmentStyle: CSSProperties = {
  display: "inline-flex",
  maxWidth: "100%",
  overflowX: "auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  padding: "0.2rem",
  gap: "0.2rem",
};

const segmentButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.3rem 0.7rem",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text-muted)",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const segmentActiveStyle: CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "inset 0 -2px 0 var(--accent-2)",
};

const selectWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
};

const selectStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0.3rem 0.6rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.95rem",
};

const mapFrameStyle: CSSProperties = {
  position: "relative",
  height: "clamp(260px, 55vw, 380px)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  background: "#0b0d0b",
};

const loadingStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  height: "100%",
  color: "#a3a89c",
  fontSize: "0.85rem",
};

const mapNoteStyle: CSSProperties = {
  position: "absolute",
  left: "0.5rem",
  bottom: "0.5rem",
  zIndex: 500,
  margin: 0,
  padding: "0.35rem 0.6rem",
  borderRadius: "var(--radius-sm)",
  background: "rgba(11, 13, 11, 0.85)",
  color: "#e8e6df",
  fontSize: "0.8rem",
};

const legendStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  lineHeight: 1.6,
};

const legendDotStyle: CSSProperties = {
  display: "inline-block",
  width: "0.6rem",
  height: "0.6rem",
  marginRight: "0.3rem",
  borderRadius: "50%",
  border: "1px solid var(--border-strong)",
  verticalAlign: "middle",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  margin: 0,
  paddingLeft: "1.2rem",
};

const listItemStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.88rem",
};

const listNameStyle: CSSProperties = {
  fontWeight: 700,
  marginRight: "0.5rem",
};

const listDetailStyle: CSSProperties = {
  color: "var(--text-muted)",
};
