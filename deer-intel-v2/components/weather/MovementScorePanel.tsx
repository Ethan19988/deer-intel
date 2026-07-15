"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchLiveForecast,
  type LiveForecast,
  type WeatherPoint,
} from "@/lib/liveWeather";
import {
  getMovementScore,
  type MovementScore,
  type MovementTone,
} from "@/lib/movementScore";
import { getMoonPhaseInfo } from "@/lib/moonPhase";
import { useUnitPreferences } from "@/lib/units";
import { useMoonPhase } from "@/lib/useMoonPhase";

type MovementScorePanelProps = {
  point: WeatherPoint | null;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; forecast: LiveForecast }
  | { status: "error" };

// A compact "deer movement" HUD for the Today hero. It reuses the same
// Open-Meteo forecast the weather panel already loads (fetchLiveForecast is
// cached by location + units, so this adds no extra network call) and turns the
// barometric trend, wind, and moon into a single glanceable 1–5 rating.
export default function MovementScorePanel({ point }: MovementScorePanelProps) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const units = useUnitPreferences();
  const moon = useMoonPhase();
  const pointKey = point ? `${point.lat},${point.lng}` : "";

  useEffect(() => {
    if (!point) {
      setState({ status: "idle" });
      return;
    }

    let active = true;
    setState({ status: "loading" });

    fetchLiveForecast(point, units).then((result) => {
      if (!active) return;
      setState(
        result.status === "ok"
          ? { status: "ok", forecast: result.forecast }
          : { status: "error" },
      );
    });

    return () => {
      active = false;
    };
    // Refetch when the point or the unit preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, units.temperature, units.wind]);

  if (state.status !== "ok") return null;

  const windSpeedMph = parseWindMph(
    state.forecast.current.windSpeed,
    units.wind,
  );
  const movement = getMovementScore({
    pressureTrend: state.forecast.pressure?.trend,
    windSpeedMph,
    moonIllumination: moon ? moon.illumination : null,
  });

  const accent = toneAccent(movement.tone);

  // The next-days outlook so a hunter can pick the best day to sit. Day 0 reuses
  // the headline score (identical inputs); later days fall back to the per-day
  // forecast signals, since live current conditions only exist for today.
  const outlook: Array<{ label: string; score: MovementScore }> =
    state.forecast.days.map((day, index) => {
      if (index === 0) return { label: day.label, score: movement };

      const dayMs = Date.parse(`${day.date}T12:00:00`);
      const illumination = Number.isNaN(dayMs)
        ? null
        : getMoonPhaseInfo(dayMs).illumination;

      return {
        label: day.label,
        score: getMovementScore({
          pressureTrend: day.pressureTrend,
          windSpeedMph: parseWindMph(day.wind, units.wind),
          moonIllumination: illumination,
        }),
      };
    });

  return (
    <div style={{ ...cardStyle, border: `1px solid ${accent.border}` }}>
      <div style={topRowStyle}>
        <span style={{ ...iconBadgeStyle, background: accent.tint }}>🦌</span>
        <div style={headingWrapStyle}>
          <p style={eyebrowStyle}>Deer Movement</p>
          <p style={labelStyle}>{movement.label}</p>
        </div>
        <span style={scoreBadgeStyle}>
          <span style={{ ...scoreNumberStyle, color: accent.solid }}>
            {movement.score}
          </span>
          <span style={scoreOutOfStyle}>/5</span>
        </span>
      </div>

      <div
        style={meterStyle}
        role="meter"
        aria-valuenow={movement.score}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label={`Deer movement ${movement.score} out of 5: ${movement.label}`}
      >
        {[1, 2, 3, 4, 5].map((segment) => (
          <span
            key={segment}
            style={{
              ...segmentStyle,
              background:
                segment <= movement.score ? accent.solid : "var(--surface-3)",
            }}
          />
        ))}
      </div>

      <p style={reasonStyle}>{movement.reason}</p>

      {outlook.length > 1 ? (
        <div style={outlookWrapStyle}>
          <p style={outlookEyebrowStyle}>Next-days outlook</p>
          <div style={outlookRowStyle}>
            {outlook.map((day, index) => {
              const dayAccent = toneAccent(day.score.tone);
              return (
                <div
                  key={`${day.label}-${index}`}
                  style={{
                    ...outlookTileStyle,
                    ...(index === 0 ? outlookTodayTileStyle : null),
                  }}
                >
                  <span style={outlookLabelStyle}>{day.label}</span>
                  <span style={outlookScoreStyle}>
                    <span style={{ color: dayAccent.solid }}>
                      {day.score.score}
                    </span>
                    <span style={outlookOutOfStyle}>/5</span>
                  </span>
                  <div style={outlookDotsStyle} aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((segment) => (
                      <span
                        key={segment}
                        style={{
                          ...outlookDotStyle,
                          background:
                            segment <= day.score.score
                              ? dayAccent.solid
                              : "var(--surface-3)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseWindMph(
  windSpeed: string,
  unit: "mph" | "kmh",
): number | null {
  const match = windSpeed.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;

  return unit === "kmh" ? value * 0.621371 : value;
}

function toneAccent(tone: MovementTone): {
  solid: string;
  border: string;
  tint: string;
} {
  if (tone === "good") {
    return {
      solid: "var(--accent)",
      border: "var(--accent-tint-border)",
      tint: "var(--accent-tint)",
    };
  }
  if (tone === "fair") {
    return {
      solid: "var(--accent-2)",
      border: "var(--accent-2-tint-border)",
      tint: "var(--accent-2-tint)",
    };
  }
  return {
    solid: "var(--text-faint)",
    border: "var(--border)",
    tint: "var(--surface-2)",
  };
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  padding: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "12px",
  fontSize: "1.35rem",
  flexShrink: 0,
};

const headingWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  marginRight: "auto",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "1.05rem",
  fontWeight: 850,
  lineHeight: 1.2,
};

const scoreBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.1rem",
  flexShrink: 0,
};

const scoreNumberStyle: CSSProperties = {
  fontSize: "2.1rem",
  fontWeight: 900,
  lineHeight: 1,
};

const scoreOutOfStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "1rem",
  fontWeight: 800,
};

const meterStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "0.35rem",
};

const segmentStyle: CSSProperties = {
  height: "8px",
  borderRadius: "999px",
};

const reasonStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const outlookWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  paddingTop: "0.8rem",
  borderTop: "1px solid var(--border)",
};

const outlookEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const outlookRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.5rem",
};

const outlookTileStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.3rem",
  padding: "0.6rem 0.4rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const outlookTodayTileStyle: CSSProperties = {
  border: "1px solid var(--accent-2-tint-border)",
  background: "var(--accent-2-tint)",
};

const outlookLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const outlookScoreStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.05rem",
  fontSize: "1.5rem",
  fontWeight: 900,
  lineHeight: 1,
};

const outlookOutOfStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.8rem",
  fontWeight: 800,
};

const outlookDotsStyle: CSSProperties = {
  display: "flex",
  gap: "0.2rem",
};

const outlookDotStyle: CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
};
