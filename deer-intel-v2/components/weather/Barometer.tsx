import type { CSSProperties } from "react";
import type { PressureReading } from "@/lib/liveWeather";

// Barometric pressure as a sparkline — the trend that actually moves deer.
// Draws the recent hourly series (already in inHg) as an area + line, tinted by
// direction: green rising / blaze falling / muted steady. Renders nothing when
// no pressure reading is available.

type BarometerProps = {
  pressure?: PressureReading;
};

const W = 150;
const H = 46;

function trendColor(trend: PressureReading["trend"]): string {
  if (trend === "falling") return "var(--accent-2)";
  if (trend === "rising") return "var(--accent)";
  return "var(--text-faint)";
}

function trendArrow(trend: PressureReading["trend"]): string {
  if (trend === "falling") return "▼";
  if (trend === "rising") return "▲";
  return "▬";
}

export default function Barometer({ pressure }: BarometerProps) {
  if (!pressure) return null;

  const color = trendColor(pressure.trend);
  const series = pressure.series ?? [];
  const path = buildPath(series);

  return (
    <section style={cardStyle}>
      <div style={topRowStyle}>
        <p style={eyebrowStyle}>Barometer</p>
        <span style={{ ...trendStyle, color }}>
          {trendArrow(pressure.trend)} {pressure.trend}
        </span>
      </div>

      <div style={valueStyle}>{pressure.value}</div>

      {path ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={sparkStyle}
        >
          <path d={path.area} fill={color} fillOpacity={0.16} />
          <path
            d={path.line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={path.lastX} cy={path.lastY} r={3.2} fill={color} />
        </svg>
      ) : null}

      <p style={hintStyle}>{pressure.hint}</p>
    </section>
  );
}

function buildPath(series: number[]): {
  line: string;
  area: string;
  lastX: number;
  lastY: number;
} | null {
  if (series.length < 3) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = W / (series.length - 1);
  const pad = 6;

  const points = series.map((value, index) => {
    const x = index * stepX;
    const y = pad + (1 - (value - min) / span) * (H - pad * 2);
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return { line, area, lastX: last.x, lastY: last.y };
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
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
  gap: "0.5rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const trendStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const valueStyle: CSSProperties = {
  fontSize: "1.35rem",
  fontWeight: 850,
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
};

const sparkStyle: CSSProperties = {
  display: "block",
  marginTop: "0.15rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  lineHeight: 1.4,
};
