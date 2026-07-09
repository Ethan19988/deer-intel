"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchLiveWeather,
  type LiveWeatherFields,
  type WeatherPoint,
} from "@/lib/liveWeather";

type LiveWeatherPanelProps = {
  point: WeatherPoint | null;
  emptyHint?: string;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; fields: LiveWeatherFields }
  | { status: "error"; message: string };

// A live-conditions panel for the dashboard. It reuses the app's existing
// Open-Meteo layer (lib/liveWeather) rather than adding a second weather stack,
// and renders as a light "HUD" tile that sits on the camo hero.
export default function LiveWeatherPanel({
  point,
  emptyHint = "Add map pins or a camera location to this property to load live weather.",
}: LiveWeatherPanelProps) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const pointKey = point ? `${point.lat},${point.lng}` : "";

  useEffect(() => {
    if (!point) {
      setState({ status: "idle" });
      return;
    }

    let active = true;
    setState({ status: "loading" });

    fetchLiveWeather(point).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setState({ status: "ok", fields: result.fields });
      } else {
        setState({ status: "error", message: result.message });
      }
    });

    return () => {
      active = false;
    };
  }, [pointKey, point]);

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
              {state.fields.temperature ? `${state.fields.temperature}°` : "—"}
            </span>
            <span style={conditionStyle}>
              {state.fields.weather || "Current conditions"}
            </span>
          </div>
          <div style={statRowStyle}>
            <WeatherStat
              label="Wind"
              value={
                [state.fields.windDirection, state.fields.windSpeed]
                  .filter(Boolean)
                  .join(" ") || "—"
              }
            />
            <WeatherStat label="Moon" value={state.fields.moonPhase || "—"} />
          </div>
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

const messageStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};
