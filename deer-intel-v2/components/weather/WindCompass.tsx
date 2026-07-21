import type { CSSProperties } from "react";
import type { Stand } from "@/types/stand";
import {
  getStandWindCheck,
  parseWindDirections,
  type StandWindStatus,
} from "@/lib/standWind";

// A compass dial for the Today's Brief: an arrow showing where today's wind is
// blowing FROM, with a dot per stand at its best-wind bearing coloured by
// whether that wind favours the sit. Reuses the same getStandWindCheck the rest
// of the app trusts, so the dial and the tagline never disagree.

type WindCompassProps = {
  /** Current wind direction as a 16-point compass label, e.g. "NW". */
  wind?: string;
  /** Current wind speed with its unit, e.g. "8 mph". */
  windSpeed?: string;
  stands: Stand[];
};

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function bearingOf(direction: string): number | null {
  const index = COMPASS_16.indexOf(direction.toUpperCase());
  return index < 0 ? null : index * 22.5;
}

const CENTER = 60;
const RING = 50;

// Place a point on the dial for a compass bearing (0° = North = up).
function pointOnDial(bearing: number, radius: number): { x: number; y: number } {
  const radians = (bearing * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  };
}

function statusColor(status: StandWindStatus): string {
  if (status === "good") return "var(--accent)";
  if (status === "avoid") return "var(--danger-text)";
  if (status === "marginal") return "var(--warning-text)";
  return "var(--text-faint)";
}

export default function WindCompass({
  wind,
  windSpeed,
  stands,
}: WindCompassProps) {
  const windBearing = wind ? bearingOf(wind) : null;
  const hasWind = Boolean(wind) && windBearing !== null;

  const checks = stands.map((stand) => ({
    stand,
    check: getStandWindCheck(stand, wind),
    bearing: bearingOf(parseWindDirections(stand.bestWinds)[0] ?? ""),
  }));
  const goodCount = checks.filter((entry) => entry.check.status === "good").length;
  const bustedCount = checks.filter((entry) => entry.check.status === "avoid").length;

  const speedLabel = windSpeed ? windSpeed.replace(/\s*mph/i, "") : "";

  return (
    <section style={cardStyle}>
      <div style={topRowStyle}>
        <p style={eyebrowStyle}>Wind</p>
        <span style={readStyle}>
          {hasWind ? wind : "—"}
          {hasWind && speedLabel ? (
            <span style={speedStyle}> {speedLabel}</span>
          ) : null}
        </span>
      </div>

      <div style={dialWrapStyle}>
        <svg viewBox="0 0 120 120" width="118" height="118" aria-hidden="true">
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING + 2}
            fill="var(--surface-2)"
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
          {/* cardinal labels */}
          <g
            fill="var(--text-faint)"
            fontSize="9"
            fontWeight={800}
            fontFamily="system-ui, sans-serif"
            textAnchor="middle"
          >
            <text x={CENTER} y={18}>N</text>
            <text x={108} y={63}>E</text>
            <text x={CENTER} y={109}>S</text>
            <text x={12} y={63}>W</text>
          </g>
          {/* ticks */}
          <g stroke="var(--border-strong)" strokeWidth={1}>
            <line x1={CENTER} y1={10} x2={CENTER} y2={17} />
            <line x1={110} y1={CENTER} x2={103} y2={CENTER} />
            <line x1={CENTER} y1={110} x2={CENTER} y2={103} />
            <line x1={10} y1={CENTER} x2={17} y2={CENTER} />
          </g>

          {/* wind arrow — points to the direction the wind blows FROM */}
          {hasWind ? (
            <g transform={`rotate(${windBearing} ${CENTER} ${CENTER})`}>
              <line
                x1={CENTER}
                y1={CENTER + 26}
                x2={CENTER}
                y2={CENTER - 30}
                stroke="var(--accent-2)"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <path
                d={`M ${CENTER} ${CENTER - 36} L ${CENTER - 6} ${CENTER - 24} L ${CENTER + 6} ${CENTER - 24} Z`}
                fill="var(--accent-2)"
              />
            </g>
          ) : null}

          {/* per-stand markers at their best-wind bearing */}
          {checks.map((entry, index) => {
            if (entry.bearing === null) return null;
            const { x, y } = pointOnDial(entry.bearing, RING - 8);
            return (
              <circle
                key={`${entry.stand.id ?? index}`}
                cx={x}
                cy={y}
                r={4.5}
                fill={statusColor(entry.check.status)}
                stroke="var(--surface)"
                strokeWidth={1.5}
              />
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={3} fill="var(--text-muted)" />
        </svg>
      </div>

      <div style={legendStyle}>
        {stands.length === 0 ? (
          <span style={legendItemStyle}>Add stands to read the wind</span>
        ) : (
          <>
            <span style={legendItemStyle}>
              <span style={{ ...dotStyle, background: "var(--accent)" }} />
              {goodCount} {goodCount === 1 ? "stand" : "stands"} OK
            </span>
            {bustedCount > 0 ? (
              <span style={legendItemStyle}>
                <span style={{ ...dotStyle, background: "var(--danger-text)" }} />
                {bustedCount} busted
              </span>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
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

const speedStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const dialWrapStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: "0.2rem",
};

const legendStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.3rem 0.7rem",
  marginTop: "0.2rem",
};

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  color: "var(--text-muted)",
  fontSize: "0.76rem",
  fontWeight: 600,
};

const dotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
};
