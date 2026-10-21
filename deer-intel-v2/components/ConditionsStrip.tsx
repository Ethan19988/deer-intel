import type { CSSProperties, ReactNode } from "react";
import MoonPhaseIcon from "@/components/weather/MoonPhaseIcon";
import type { PressureReading } from "@/lib/liveWeather";
import type { MoonPhaseInfo } from "@/lib/moonPhase";
import { compassToDegrees } from "@/lib/travelDirection";

type ConditionsStripProps = {
  windDirection?: string;
  windSpeed?: string;
  temperature?: string;
  conditions?: string;
  moon: MoonPhaseInfo | null;
  pressure?: PressureReading;
};

const TREND_WORD: Record<PressureReading["trend"], string> = {
  rising: "Rising",
  steady: "Steady",
  falling: "Falling",
};

// Four glanceable readings in one row, replacing the large wind, moon, and
// barometer cards. The full instruments live behind "All conditions".
export default function ConditionsStrip({
  windDirection,
  windSpeed,
  temperature,
  conditions,
  moon,
  pressure,
}: ConditionsStripProps) {
  const windFrom = windDirection ? compassToDegrees(windDirection) : null;
  const speed = windSpeed?.match(/\d+/)?.[0];

  return (
    <div style={stripStyle}>
      <Tile
        label="Wind"
        icon={
          windFrom !== null ? (
            // Arrow points where the wind is blowing TO (where your scent goes).
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <g transform={`rotate(${(windFrom + 180) % 360} 12 12)`}>
                <path d="M12 3 L18 14 L12 11.5 L6 14 Z" fill="var(--accent-2)" />
                <path d="M12 11.5 L12 21" stroke="var(--accent-2)" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </svg>
          ) : null
        }
        value={windDirection ? `${windDirection}${speed ? ` ${speed}` : ""}` : "—"}
      />
      <Tile
        label={conditions || "Temp"}
        value={temperature ? `${temperature.replace(/[^\d-]/g, "")}°` : "—"}
      />
      <Tile
        label={moon ? `Moon ${moon.illumination}%` : "Moon"}
        icon={
          moon ? (
            <MoonPhaseIcon
              illumination={moon.illumination}
              waxing={moon.waxing}
              phase={moon.phase}
              size={22}
            />
          ) : null
        }
        value={moon ? moon.phase.replace(/ moon$/i, "") : "—"}
        compact
      />
      <Tile
        label="Pressure"
        icon={
          pressure ? (
            <span
              aria-hidden="true"
              style={{
                ...trendArrowStyle,
                color:
                  pressure.trend === "falling"
                    ? "var(--accent-2)"
                    : pressure.trend === "rising"
                      ? "var(--accent)"
                      : "var(--text-muted)",
              }}
            >
              {pressure.trend === "falling" ? "↓" : pressure.trend === "rising" ? "↑" : "→"}
            </span>
          ) : null
        }
        value={pressure ? TREND_WORD[pressure.trend] : "—"}
        compact
      />
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div style={tileStyle}>
      <div style={tileTopStyle}>
        {icon}
        <span style={{ ...valueStyle, ...(compact ? compactValueStyle : null) }}>
          {value}
        </span>
      </div>
      <span style={labelStyle}>{label}</span>
    </div>
  );
}

const stripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 45%), 1fr))",
  gap: "0.5rem",
};

const tileStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  padding: "0.7rem 0.8rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  minWidth: 0,
};

const tileTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  minWidth: 0,
};

const valueStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.45rem",
  fontWeight: 800,
  lineHeight: 1.1,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const compactValueStyle: CSSProperties = {
  fontSize: "1.1rem",
};

const labelStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trendArrowStyle: CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 900,
  lineHeight: 1,
};
