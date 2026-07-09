"use client";

import type { CSSProperties } from "react";
import { coordinateOriginLabel } from "@/lib/propertyLocation";
import { useLiveWeather } from "@/lib/useLiveWeather";
import type { LiveWeather, LiveWeatherDay, WeatherCoordinate } from "@/types/weather";

type LiveWeatherPanelProps = {
  coordinate: WeatherCoordinate | null;
  /** Message shown when there is no coordinate to look up. */
  emptyHint?: string;
  /** Number of forecast days to render (after today). */
  forecastDays?: number;
};

export default function LiveWeatherPanel({
  coordinate,
  emptyHint = "Add map pins or a camera location to this property to load live weather.",
  forecastDays = 3,
}: LiveWeatherPanelProps) {
  const state = useLiveWeather(coordinate);

  if (!coordinate) {
    return <p style={mutedStyle}>{emptyHint}</p>;
  }

  if (state.status === "loading" || state.status === "idle") {
    return <p style={mutedStyle}>Loading live weather...</p>;
  }

  if (state.status === "error") {
    return <p style={errorStyle}>{state.message}</p>;
  }

  return (
    <Report weather={state.weather} forecastDays={forecastDays} />
  );
}

function Report({
  weather,
  forecastDays,
}: {
  weather: LiveWeather;
  forecastDays: number;
}) {
  const { current, coordinate } = weather;
  // The forecast's first entry is today; the extra days follow it.
  const upcoming = weather.forecast.slice(1, 1 + forecastDays);
  const today = weather.forecast[0];

  return (
    <div style={panelStyle}>
      <div style={currentRowStyle}>
        <div>
          <span style={tempStyle}>{Math.round(current.temperature)}&deg;</span>
          <span style={conditionsStyle}>{current.conditions}</span>
        </div>
        <div style={metaStyle}>
          <Metric label="Wind" value={formatWind(current.windDirection, current.windSpeed)} />
          <Metric label="Humidity" value={`${Math.round(current.humidity)}%`} />
          <Metric label="Pressure" value={`${Math.round(current.pressure)} hPa`} />
          <Metric label="Moon" value={current.moonPhase} />
        </div>
      </div>

      {today ? (
        <p style={sunStyle}>
          High {Math.round(today.high)}&deg; / Low {Math.round(today.low)}&deg;
          {today.sunrise && today.sunset
            ? ` / Sunrise ${formatTime(today.sunrise)} / Sunset ${formatTime(today.sunset)}`
            : ""}
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <div style={forecastRowStyle}>
          {upcoming.map((day) => (
            <ForecastChip key={day.date} day={day} />
          ))}
        </div>
      ) : null}

      <p style={sourceStyle}>
        {weather.provider} / from {coordinateOriginLabel(coordinate)}
      </p>
    </div>
  );
}

function ForecastChip({ day }: { day: LiveWeatherDay }) {
  return (
    <div style={chipStyle}>
      <span style={chipDayStyle}>{formatWeekday(day.date)}</span>
      <span style={chipConditionsStyle}>{day.conditions}</span>
      <span style={chipTempStyle}>
        {Math.round(day.high)}&deg; / {Math.round(day.low)}&deg;
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value || "--"}</span>
    </div>
  );
}

function formatWind(direction: string, speed: number): string {
  const rounded = Math.round(speed);

  if (direction && rounded) return `${direction} ${rounded} mph`;
  if (rounded) return `${rounded} mph`;

  return direction || "Calm";
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatWeekday(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const currentRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const tempStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "2.4rem",
  fontWeight: 900,
  lineHeight: 1,
};

const conditionsStyle: CSSProperties = {
  marginLeft: "0.6rem",
  color: "#c6d5c5",
  fontSize: "1rem",
  fontWeight: 700,
};

const metaStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.4rem 1rem",
};

const metricStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
};

const metricLabelStyle: CSSProperties = {
  color: "#85a984",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
};

const metricValueStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const sunStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  fontSize: "0.86rem",
};

const forecastRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
  gap: "0.5rem",
};

const chipStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  padding: "0.55rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const chipDayStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "0.82rem",
  fontWeight: 850,
};

const chipConditionsStyle: CSSProperties = {
  color: "#b8c2b6",
  fontSize: "0.76rem",
};

const chipTempStyle: CSSProperties = {
  color: "#c6d5c5",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const sourceStyle: CSSProperties = {
  margin: 0,
  color: "#6f7d6e",
  fontSize: "0.72rem",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  lineHeight: 1.45,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#ffd5d5",
  lineHeight: 1.45,
};
