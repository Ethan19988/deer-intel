"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchLiveForecast,
  type LiveForecast,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { TEMPERATURE_UNIT_LABEL, useUnitPreferences } from "@/lib/units";

type MapWeatherCompassProps = {
  point: WeatherPoint | null;
  showCompass: boolean;
  onRecenter?: () => void;
};

// The resolved forecast is tagged with the point it belongs to so a stale
// result (or a cleared point) hides itself during render — no synchronous
// setState in the effect body.
type ForecastResult = { key: string; forecast: LiveForecast };

// A field-app style HUD puck for the map's bottom-right corner: live high/low
// and wind stacked over a compass rose. It reuses the app's Open-Meteo layer
// (lib/liveWeather) rather than adding a second weather stack, and the rose's
// center doubles as a "recenter on this property" button.
export default function MapWeatherCompass({
  point,
  showCompass,
  onRecenter,
}: MapWeatherCompassProps) {
  const [result, setResult] = useState<ForecastResult | null>(null);
  const units = useUnitPreferences();
  const pointKey = point ? `${point.lat},${point.lng}` : "";

  useEffect(() => {
    if (!point) return;

    let active = true;

    fetchLiveForecast(point, units).then((fetched) => {
      if (!active) return;
      setResult(
        fetched.status === "ok"
          ? { key: pointKey, forecast: fetched.forecast }
          : null,
      );
    });

    return () => {
      active = false;
    };
    // Refetch when the point or the unit preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, units.temperature, units.wind]);

  // Only trust the forecast if it matches the point currently in view.
  const forecast =
    result && result.key === pointKey && pointKey ? result.forecast : null;
  const today = forecast ? forecast.days[0] : null;
  const current = forecast ? forecast.current : null;
  const tempUnit = TEMPERATURE_UNIT_LABEL[units.temperature];
  const highLow =
    today && today.high && today.low
      ? `${today.high}° | ${today.low}° ${tempUnit.replace("°", "")}`
      : current?.temperature
        ? `${current.temperature}${tempUnit}`
        : null;
  const wind = current
    ? [current.windDirection, current.windSpeed].filter(Boolean).join(" ")
    : null;
  const hasWeather = Boolean(highLow || wind);

  // Nothing to show: no compass rose requested and no weather to report.
  if (!showCompass && !hasWeather) return null;

  return (
    <div
      className="di-map-weather"
      style={puckStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {hasWeather ? (
        <div style={weatherCardStyle}>
          {highLow ? <span style={weatherTempStyle}>{highLow}</span> : null}
          {wind ? <span style={weatherWindStyle}>{wind}</span> : null}
        </div>
      ) : null}

      {showCompass ? (
        <div style={roseWrapStyle}>
          <CompassRose />
          <button
            type="button"
            aria-label="Recenter map on this property"
            title="Recenter"
            style={roseCenterStyle}
            disabled={!onRecenter}
            onClick={() => onRecenter?.()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="4.2"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              <line x1="12" y1="1.5" x2="12" y2="6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              <line x1="1.5" y1="12" x2="6" y2="12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="12" x2="22.5" y2="12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

// A static north-up compass rose: a four-point star with a blaze-orange north
// point (matching the app's secondary accent) and cream E/S/W points.
function CompassRose() {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="rgba(18, 24, 16, 0.72)"
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth="1.5"
      />
      {/* Diagonal points sit behind the cardinals for a fuller rose. */}
      <g fill="#b7ad92" opacity="0.85">
        <path d="M50 50 L70 30 L54 46 Z" />
        <path d="M50 50 L70 70 L54 54 Z" />
        <path d="M50 50 L30 70 L46 54 Z" />
        <path d="M50 50 L30 30 L46 46 Z" />
      </g>
      {/* Cardinal points; north is blaze orange. */}
      <path d="M50 6 L45 50 L55 50 Z" fill="#e0642a" />
      <path d="M94 50 L50 45 L50 55 Z" fill="#e9e4d5" />
      <path d="M50 94 L45 50 L55 50 Z" fill="#c9c3b2" />
      <path d="M6 50 L50 45 L50 55 Z" fill="#c9c3b2" />
      <text x="50" y="20" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="900" fill="#ffe7d9">N</text>
      <text x="84" y="50" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="800" fill="#e9e4d5">E</text>
      <text x="50" y="82" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="800" fill="#d7d2c2">S</text>
      <text x="16" y="50" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="800" fill="#d7d2c2">W</text>
    </svg>
  );
}

const puckStyle: CSSProperties = {
  position: "absolute",
  right: "1rem",
  bottom: "1rem",
  zIndex: 1000,
  display: "grid",
  justifyItems: "center",
  gap: "0.5rem",
};

const weatherCardStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.1rem",
  padding: "0.4rem 0.75rem",
  borderRadius: "12px",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  background: "rgba(18, 24, 16, 0.82)",
  color: "#f3f1e6",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.28)",
  backdropFilter: "blur(4px)",
  whiteSpace: "nowrap",
};

const weatherTempStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 900,
  letterSpacing: "0.01em",
  fontVariantNumeric: "tabular-nums",
};

const weatherWindStyle: CSSProperties = {
  color: "#cfe0c9",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const roseWrapStyle: CSSProperties = {
  position: "relative",
  width: "88px",
  height: "88px",
  filter: "drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35))",
};

const roseCenterStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  display: "grid",
  width: "40px",
  height: "40px",
  minHeight: "40px",
  placeItems: "center",
  padding: 0,
  border: "2px solid rgba(255, 255, 255, 0.9)",
  borderRadius: "999px",
  background: "#f6f4ec",
  cursor: "pointer",
  transform: "translate(-50%, -50%)",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
};
