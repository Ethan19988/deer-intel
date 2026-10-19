import type { CSSProperties } from "react";
import { hourLabel, type HourlyActivity } from "@/lib/hourlyActivity";

type DeerHoursChartProps = {
  activity: HourlyActivity;
  /** Fractional local hours, e.g. 7.47 for 7:28 AM. */
  sunriseHour?: number;
  sunsetHour?: number;
  /** Fractional local hour for the "now" marker. */
  nowHour?: number;
  /** Set when the bars are a regional pool rather than this property's cameras. */
  regional?: { regionLabel: string; contributors: number };
};

const W = 360;
const H = 140;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 10;
const PAD_B = 20;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const SLOT = PLOT_W / 24;
const BAR_W = Math.max(4, SLOT - 4);
// Shooting light runs from 30 min before sunrise to 30 min after sunset.
const LIGHT_PAD_HOURS = 0.5;

const x = (hour: number) => PAD_L + hour * SLOT;

// When deer show up on this property's cameras, by hour of day, with the
// shooting-light window shaded and a marker for right now. Two series: bucks
// (blaze) stacked under all other deer (blue), with a legend for identity.
export default function DeerHoursChart({
  activity,
  sunriseHour,
  sunsetHour,
  nowHour,
  regional,
}: DeerHoursChartProps) {
  if (activity.total === 0) return null;

  const max = Math.max(...activity.counts, 1);
  const scale = (n: number) => (n / max) * PLOT_H;
  const baseline = PAD_T + PLOT_H;
  const peak = activity.peakStartHour;

  return (
    <section style={panelStyle} aria-label="When deer move here">
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          {regional ? `When deer move in ${regional.regionLabel}` : "When deer move here"}
        </h2>
        <span style={subtleStyle}>Last {activity.windowDays} days</span>
      </div>
      <p style={headlineStyle}>
        {peak !== null ? (
          <>
            Busiest <strong>{hourLabel(peak)} to {hourLabel(peak + 2)}</strong>,
            from {activity.total} timed photos
            {regional ? ` shared by ${regional.contributors} hunters` : ""}.
          </>
        ) : (
          `${activity.total} timed photos so far. A pattern shows after a few more.`
        )}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Deer photos by hour of day over the last ${activity.windowDays} days`}
        style={svgStyle}
      >
        {sunriseHour !== undefined && sunsetHour !== undefined ? (
          <rect
            x={x(Math.max(0, sunriseHour - LIGHT_PAD_HOURS))}
            y={PAD_T}
            width={x(Math.min(24, sunsetHour + LIGHT_PAD_HOURS)) - x(Math.max(0, sunriseHour - LIGHT_PAD_HOURS))}
            height={PLOT_H}
            rx={6}
            fill="var(--accent-2)"
            fillOpacity={0.1}
          />
        ) : null}

        <line x1={PAD_L} x2={W - PAD_R} y1={baseline} y2={baseline} stroke="var(--border-strong)" strokeWidth={1} />

        {activity.counts.map((count, hour) => {
          if (count === 0) return null;
          const bucks = activity.bucks[hour];
          const others = count - bucks;
          const left = x(hour) + (SLOT - BAR_W) / 2;
          const buckH = scale(bucks);
          const otherH = scale(others);
          const gap = bucks > 0 && others > 0 ? 2 : 0;
          return (
            <g key={hour}>
              <title>
                {`${hourLabel(hour)}: ${count} deer photo${count === 1 ? "" : "s"}${bucks ? `, ${bucks} buck${bucks === 1 ? "" : "s"}` : ""}`}
              </title>
              {/* Wider invisible hit target than the mark itself. */}
              <rect x={x(hour)} y={PAD_T} width={SLOT} height={PLOT_H} fill="transparent" />
              {bucks > 0 ? (
                <rect x={left} y={baseline - buckH} width={BAR_W} height={buckH} rx={2} fill="var(--chart-buck)" />
              ) : null}
              {others > 0 ? (
                <rect
                  x={left}
                  y={baseline - buckH - gap - otherH}
                  width={BAR_W}
                  height={Math.max(otherH, 2)}
                  rx={2}
                  fill="var(--chart-deer)"
                />
              ) : null}
            </g>
          );
        })}

        {nowHour !== undefined ? (
          <g>
            <line x1={x(nowHour)} x2={x(nowHour)} y1={PAD_T - 4} y2={baseline} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={x(nowHour)} cy={PAD_T - 4} r={3} fill="var(--text)" />
          </g>
        ) : null}

        {[0, 6, 12, 18].map((hour) => (
          <text key={hour} x={x(hour) + 2} y={H - 5} fontSize="10" fill="var(--text-faint)" fontWeight={600}>
            {hourLabel(hour).replace(" ", "").toLowerCase()}
          </text>
        ))}
      </svg>

      <p style={legendStyle}>
        <span style={{ ...swatchStyle, background: "var(--chart-deer)" }} /> Deer
        <span style={{ ...swatchStyle, background: "var(--chart-buck)" }} /> Bucks
        <span style={{ ...swatchStyle, background: "var(--accent-2)", opacity: 0.25 }} /> Shooting light
      </p>
    </section>
  );
}

const panelStyle: CSSProperties = {
  padding: "0.9rem 1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.2rem",
  fontWeight: 800,
};

const subtleStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const headlineStyle: CSSProperties = {
  margin: "0.35rem 0 0.5rem",
  color: "var(--text-muted)",
  fontSize: "0.92rem",
  lineHeight: 1.45,
};

const svgStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  overflow: "visible",
};

const legendStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.35rem 0.5rem",
  margin: "0.5rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
};

const swatchStyle: CSSProperties = {
  display: "inline-block",
  width: "12px",
  height: "12px",
  marginLeft: "0.3rem",
  borderRadius: "3px",
};
