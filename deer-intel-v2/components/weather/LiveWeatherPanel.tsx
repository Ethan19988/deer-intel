"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchLiveForecast,
  type LiveForecast,
  type PressureTrend,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { TEMPERATURE_UNIT_LABEL, useUnitPreferences } from "@/lib/units";

type LiveWeatherPanelProps = {
  point: WeatherPoint | null;
  emptyHint?: string;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; forecast: LiveForecast }
  | { status: "error"; message: string };

// A live-conditions panel for the dashboard. It reuses the app's existing
// Open-Meteo layer (lib/liveWeather) rather than adding a second weather stack,
// and renders as a light "HUD" tile that sits on the camo hero: current
// conditions, today's shooting light (sunrise/sunset), and a short forecast.
export default function LiveWeatherPanel({
  point,
  emptyHint = "Add map pins or a camera location to this property to load live weather.",
}: LiveWeatherPanelProps) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const units = useUnitPreferences();
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
      if (result.status === "ok") {
        setState({ status: "ok", forecast: result.forecast });
      } else {
        setState({ status: "error", message: result.message });
      }
    });

    return () => {
      active = false;
    };
    // Refetch when the point or the unit preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, units.temperature, units.wind]);

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle}>
        <p style={eyebrowStyle}>Live Weather</p>
        <span
          style={{
            ...badgeStyle,
            ...(state.status === "ok" ? liveBadgeStyle : null),
          }}
        >
          {state.status === "ok"
            ? "Live"
            : state.status === "loading"
              ? "Checking…"
              : "Weather"}
        </span>
      </div>

      {state.status === "ok" ? (
        <div style={bodyStyle}>
          <div style={primaryRowStyle}>
            <span style={tempStyle}>
              {state.forecast.current.temperature
                ? `${state.forecast.current.temperature}${TEMPERATURE_UNIT_LABEL[units.temperature]}`
                : "—"}
            </span>
            <span style={conditionStyle}>
              {state.forecast.current.weather || "Current conditions"}
            </span>
          </div>

          <div style={statRowStyle}>
            <WeatherStat
              label="Wind"
              value={
                [
                  state.forecast.current.windDirection,
                  state.forecast.current.windSpeed,
                ]
                  .filter(Boolean)
                  .join(" ") || "—"
              }
            />
            <WeatherStat
              label="Moon"
              value={state.forecast.current.moonPhase || "—"}
            />
            <WeatherStat label="Sunrise" value={state.forecast.sunrise || "—"} />
            <WeatherStat label="Sunset" value={state.forecast.sunset || "—"} />
            {state.forecast.pressure ? (
              <WeatherStat
                label="Pressure"
                value={`${state.forecast.pressure.value} ${trendArrow(
                  state.forecast.pressure.trend,
                )}`}
              />
            ) : null}
          </div>

          {state.forecast.pressure ? (
            <p
              style={{
                ...cueStyle,
                ...cueToneStyle(state.forecast.pressure.trend),
              }}
            >
              Barometer {state.forecast.pressure.trend} — {state.forecast.pressure.hint}
            </p>
          ) : null}

          {state.forecast.days.length > 0 ? (
            <div style={forecastRowStyle}>
              {state.forecast.days.map((day) => (
                <div key={day.date} style={forecastDayStyle}>
                  <span style={forecastLabelStyle}>{day.label}</span>
                  <span style={forecastTempStyle}>
                    {day.high ? `${day.high}°` : "—"}
                    {day.low ? (
                      <span style={forecastLowStyle}> / {day.low}°</span>
                    ) : null}
                  </span>
                  <span style={forecastMetaStyle}>{day.conditions}</span>
                  {day.wind ? (
                    <span style={forecastMetaStyle}>{day.wind}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p style={messageStyle}>
          {state.status === "loading"
            ? "Checking current conditions…"
            : state.status === "error"
              ? state.message
              : emptyHint}
        </p>
      )}
    </div>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </div>
  );
}

function trendArrow(trend: PressureTrend): string {
  if (trend === "falling") return "↓";
  if (trend === "rising") return "↑";
  return "→";
}

function cueToneStyle(trend: PressureTrend): CSSProperties {
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

const cueStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.7rem",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.86rem",
  fontWeight: 700,
};

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

const liveBadgeStyle: CSSProperties = {
  border: "1px solid var(--success-border)",
  background: "var(--success-bg)",
  color: "var(--success-text)",
};

const bodyStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const primaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.6rem",
  flexWrap: "wrap",
};

const tempStyle: CSSProperties = {
  color: "var(--accent-2)",
  fontSize: "2.1rem",
  fontWeight: 900,
  lineHeight: 1,
};

const conditionStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 700,
};

const statRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.6rem",
};

const statStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  padding: "0.55rem 0.7rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const statLabelStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const statValueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: 800,
};

const forecastRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.6rem",
};

const forecastDayStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  padding: "0.6rem 0.55rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const forecastLabelStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontSize: "0.74rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const forecastTempStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 850,
};

const forecastLowStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontWeight: 700,
};

const forecastMetaStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.3,
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};
