"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchWeatherHistory,
  type ForecastDay,
  type PressureTrend,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { useUnitPreferences } from "@/lib/units";

type WeatherHistoryPanelProps = {
  point: WeatherPoint | null;
  emptyHint?: string;
};

// The settled result of one fetch, tagged with the request key it was for, so a
// stale response for an old location/unit is ignored during render.
type Loaded =
  | { key: string; status: "ok"; days: ForecastDay[] }
  | { key: string; status: "error"; message: string };

// A backward-looking companion to LiveWeatherPanel: the last week of daily
// conditions for a property so a hunter can read the trend leading into a sit
// (a cold front two days ago, a warm stretch all week). It reuses the same free
// Open-Meteo layer (lib/liveWeather) and mirrors the forecast day-cell styling,
// so the two panels read as one continuous timeline: recent days here, the
// 3-day forecast in the live panel.
export default function WeatherHistoryPanel({
  point,
  emptyHint = "Add a saved location, map pins, or a camera to this property to load weather history.",
}: WeatherHistoryPanelProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const units = useUnitPreferences();
  // One key per (location, units) request; also used to discard stale responses.
  const key = point
    ? `${point.lat},${point.lng}|${units.temperature}|${units.wind}`
    : "";

  useEffect(() => {
    if (!point) return;

    let active = true;

    fetchWeatherHistory(point, units).then((result) => {
      if (!active) return;
      setLoaded(
        result.status === "ok"
          ? { key, status: "ok", days: result.days }
          : { key, status: "error", message: result.message },
      );
    });

    return () => {
      active = false;
    };
    // Refetch when the point or the unit preference changes (both fold into key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Derive idle/loading during render so the effect's only setState is the async
  // callback above — a synchronous setState in the effect body is a cascading
  // render (react-hooks/set-state-in-effect).
  const settled = loaded && loaded.key === key ? loaded : null;
  const hasDays = settled?.status === "ok" && settled.days.length > 0;

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle}>
        <p style={eyebrowStyle}>Recent Weather</p>
        <span style={badgeStyle}>
          {point && !settled
            ? "Checking…"
            : hasDays
              ? "Past 7 days"
              : "History"}
        </span>
      </div>

      {settled?.status === "ok" && hasDays ? (
        <div style={historyRowStyle}>
          {settled.days.map((day) => (
            <div key={day.date} style={dayCellStyle}>
              <span style={dayLabelStyle}>{day.label}</span>
              <span style={dayTempStyle}>
                {day.high ? `${day.high}°` : "—"}
                {day.low ? <span style={dayLowStyle}> / {day.low}°</span> : null}
              </span>
              {day.conditions ? (
                <span style={dayMetaStyle}>{day.conditions}</span>
              ) : null}
              {day.wind ? <span style={dayMetaStyle}>{day.wind}</span> : null}
              {day.pressureTrend ? (
                <span style={{ ...trendChipStyle, ...trendToneStyle(day.pressureTrend) }}>
                  {trendArrow(day.pressureTrend)} {day.pressureTrend}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p style={messageStyle}>
          {!point
            ? emptyHint
            : !settled
              ? "Loading recent conditions…"
              : settled.status === "error"
                ? settled.message
                : "No recent weather history for this location yet."}
        </p>
      )}
    </div>
  );
}

function trendArrow(trend: PressureTrend): string {
  if (trend === "falling") return "↓";
  if (trend === "rising") return "↑";
  return "→";
}

function trendToneStyle(trend: PressureTrend): CSSProperties {
  if (trend === "falling") {
    return {
      border: "1px solid var(--accent-2-tint-border)",
      background: "var(--accent-2-tint)",
      color: "var(--accent-2-text)",
    };
  }
  if (trend === "rising") {
    return {
      border: "1px solid var(--success-border)",
      background: "var(--success-bg)",
      color: "var(--success-text)",
    };
  }
  return {
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text-muted)",
  };
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.5rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
};

// A horizontally scrollable strip so seven day-cells stay legible on a phone
// without wrapping into a ragged grid.
const historyRowStyle: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(104px, 1fr)",
  gap: "0.6rem",
  overflowX: "auto",
  paddingBottom: "0.15rem",
};

const dayCellStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  alignContent: "start",
  padding: "0.6rem 0.55rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const dayLabelStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.74rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const dayTempStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 850,
};

const dayLowStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontWeight: 700,
};

const dayMetaStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.3,
};

const trendChipStyle: CSSProperties = {
  marginTop: "0.15rem",
  justifySelf: "start",
  padding: "0.1rem 0.4rem",
  borderRadius: "999px",
  fontSize: "0.68rem",
  fontWeight: 800,
  textTransform: "capitalize",
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};
