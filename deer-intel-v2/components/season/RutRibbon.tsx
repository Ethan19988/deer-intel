import type { CSSProperties } from "react";
import type { RutPhase } from "@/lib/seasonCalendar";

// A season timeline for the whitetail rut: nine phases left→right, with the
// current one lit in blaze, the phases already behind you tinted green, and a
// countdown to peak. Fed straight from getSeasonContext so it never disagrees
// with the app's other rut cues.

type RutRibbonProps = {
  phase: RutPhase;
  phaseLabel: string;
  daysToPeak: number;
};

const PHASES: Array<{ key: RutPhase; short: string }> = [
  { key: "off-season", short: "Off" },
  { key: "early", short: "Early" },
  { key: "pre-rut", short: "Pre" },
  { key: "seeking", short: "Seek" },
  { key: "chasing", short: "Chase" },
  { key: "peak", short: "Peak" },
  { key: "lockdown", short: "Lock" },
  { key: "post-rut", short: "Post" },
  { key: "late", short: "Late" },
];

function peakCaption(phase: RutPhase, daysToPeak: number): string {
  if (phase === "off-season") return "Season's a way out";
  // Key the "on" state off the phase itself so the caption never disagrees with
  // the lit segment (the peak phase spans daysToPeak -2..2).
  if (phase === "peak") return "Peak is on";
  if (daysToPeak > 0) return `Peak in ~${daysToPeak} days`;
  return `Peak was ~${Math.abs(daysToPeak)} days ago`;
}

export default function RutRibbon({
  phase,
  phaseLabel,
  daysToPeak,
}: RutRibbonProps) {
  const activeIndex = PHASES.findIndex((entry) => entry.key === phase);

  return (
    <section style={cardStyle}>
      <div style={topRowStyle}>
        <p style={eyebrowStyle}>Rut phase</p>
        <span style={captionStyle}>
          <b style={phaseNameStyle}>{phaseLabel}</b>
          <span style={dotStyle} aria-hidden="true" />
          {peakCaption(phase, daysToPeak)}
        </span>
      </div>

      <div style={barStyle}>
        {PHASES.map((entry, index) => {
          const isActive = index === activeIndex;
          const isPast = activeIndex >= 0 && index < activeIndex;
          return (
            <div
              key={entry.key}
              style={{
                ...segStyle,
                ...(isPast ? segPastStyle : null),
                ...(isActive ? segActiveStyle : null),
              }}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                style={{
                  ...segTextStyle,
                  ...(isActive ? segTextActiveStyle : null),
                  ...(isPast ? segTextPastStyle : null),
                }}
              >
                {entry.short}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
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
  gap: "0.75rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const captionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  fontWeight: 600,
};

const phaseNameStyle: CSSProperties = {
  color: "var(--accent-2-text)",
  fontWeight: 800,
};

const dotStyle: CSSProperties = {
  width: "4px",
  height: "4px",
  borderRadius: "50%",
  background: "var(--border-strong)",
};

const barStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(9, 1fr)",
  gap: "3px",
};

const segStyle: CSSProperties = {
  minHeight: "34px",
  display: "grid",
  placeContent: "center",
  borderRadius: "7px",
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
};

const segPastStyle: CSSProperties = {
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
};

const segActiveStyle: CSSProperties = {
  background: "var(--accent-2)",
  border: "1px solid var(--accent-2-strong)",
  boxShadow: "0 6px 14px -8px rgba(224, 100, 42, 0.6)",
};

const segTextStyle: CSSProperties = {
  fontSize: "0.56rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
};

const segTextPastStyle: CSSProperties = {
  color: "var(--accent-text)",
};

const segTextActiveStyle: CSSProperties = {
  color: "var(--accent-2-fg)",
};
