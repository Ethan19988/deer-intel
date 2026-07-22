"use client";

import type { CSSProperties } from "react";
import { useMoonPhase } from "@/lib/useMoonPhase";
import MoonPhaseIcon from "@/components/weather/MoonPhaseIcon";

// The night's moon on the Today's Brief: phase, illumination, and the
// whitetail-movement cue the app already keeps for each phase. Reads from
// useMoonPhase (null until mounted, so no hydration flash) and reuses the shared
// MoonPhaseIcon so the drawn disc always matches the numbers.
export default function MoonPhaseCard() {
  const moon = useMoonPhase();

  return (
    <section style={cardStyle}>
      <div style={topRowStyle}>
        <p style={eyebrowStyle}>Moon</p>
        {moon ? (
          <span style={readStyle}>
            {moon.illumination}
            <span style={pctStyle}>%</span>
          </span>
        ) : null}
      </div>

      <div style={faceRowStyle}>
        <span style={faceWrapStyle}>
          {moon ? (
            <MoonPhaseIcon
              illumination={moon.illumination}
              waxing={moon.waxing}
              phase={moon.phase}
              size={46}
            />
          ) : (
            <span style={facePlaceholderStyle} aria-hidden="true" />
          )}
        </span>
        <p style={phaseStyle}>{moon ? moon.phase : "Reading the sky…"}</p>
      </div>

      {moon ? <p style={hintStyle}>{moon.movement}</p> : null}
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const readStyle: CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 850,
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
};

const pctStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const faceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
};

const faceWrapStyle: CSSProperties = {
  display: "inline-flex",
  flexShrink: 0,
};

const facePlaceholderStyle: CSSProperties = {
  display: "inline-block",
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
};

const phaseStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.2,
  color: "var(--text)",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};
