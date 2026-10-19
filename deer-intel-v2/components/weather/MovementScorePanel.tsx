"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  coldFrontStatus,
  fetchLiveForecast,
  fetchWeatherHistory,
  type LiveForecast,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { buildMovementOutlook } from "@/lib/movementModel";
import {
  toMovementScore,
  type MovementScore,
  type MovementTone,
} from "@/lib/movementScore";
import { getMoonPhaseInfo } from "@/lib/moonPhase";
import { getSeasonContext, useSeasonCalendar } from "@/lib/seasonCalendar";
import { useUnitPreferences } from "@/lib/units";
import ScoreGauge from "@/components/weather/ScoreGauge";

type MovementScorePanelProps = {
  point: WeatherPoint | null;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; forecast: LiveForecast; recentHighs: string[] }
  | { status: "error" };

// A compact "deer movement" gauge plus a next-days outlook. Reuses the cached
// forecast and adds a few days of history so temperature can be judged against
// recent days (the strongest signal). Scoring lives in lib/movementModel.ts.
export default function MovementScorePanel({ point }: MovementScorePanelProps) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const units = useUnitPreferences();
  const seasonPrefs = useSeasonCalendar();
  const pointKey = point ? `${point.lat},${point.lng}` : "";

  useEffect(() => {
    if (!point) {
      setState({ status: "idle" });
      return;
    }

    let active = true;
    setState({ status: "loading" });

    // The last few days' highs are the baseline for "warm" vs "cold snap".
    Promise.all([fetchLiveForecast(point, units), fetchWeatherHistory(point, units, 4)]).then(
      ([result, history]) => {
        if (!active) return;
        if (result.status !== "ok") {
          setState({ status: "error" });
          return;
        }
        const today = result.forecast.days[0]?.date ?? "";
        const recentHighs =
          history.status === "ok"
            ? history.days.filter((day) => day.date < today).map((day) => day.high)
            : [];
        setState({ status: "ok", forecast: result.forecast, recentHighs });
      },
    );

    return () => {
      active = false;
    };
    // Refetch when the point or the unit preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, units.temperature, units.wind]);

  if (state.status !== "ok") return null;

  const outlookDays = buildMovementOutlook({
    days: state.forecast.days,
    recentHighs: state.recentHighs,
    tempUnit: units.temperature,
    todayPressureDropInHg: coldFrontStatus(state.forecast.pressure).dropInHg,
    rutPhaseFor: (date) =>
      getSeasonContext(new Date(`${date}T12:00:00`), seasonPrefs, point?.lat).phase,
    moonFor: (date) => {
      const ms = Date.parse(`${date}T12:00:00`);
      return Number.isNaN(ms) ? null : getMoonPhaseInfo(ms).illumination;
    },
  });
  if (outlookDays.length === 0) return null;

  const movement = toMovementScore(outlookDays[0].result);
  const accent = toneAccent(movement.tone);

  // The next-days outlook so a hunter can pick the best day to sit, scored
  // with exactly the same model as today.
  const outlook: Array<{ label: string; score: MovementScore }> = outlookDays.map((day) => ({
    label: day.label,
    score: toMovementScore(day.result),
  }));

  return (
    <div style={{ ...cardStyle, border: `1px solid ${accent.border}` }}>
      <div style={gaugeRowStyle}>
        <ScoreGauge
          value={movement.score}
          max={5}
          color={accent.solid}
          caption="Movement"
          ariaLabel={`Deer movement ${movement.score} out of 5: ${movement.label}`}
        />
        <div style={gaugeTextStyle}>
          <p style={eyebrowStyle}>Deer Movement</p>
          <p style={labelStyle}>{movement.label}</p>
          <p style={reasonStyle}>{movement.reason}</p>
        </div>
      </div>

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

const gaugeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const gaugeTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
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
