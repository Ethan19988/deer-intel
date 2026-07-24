"use client";

import { useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import {
  fetchHistoricalWeather,
  fetchLiveWeather,
  type LiveWeatherFields,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { describeMoonPhase } from "@/lib/moonPhase";
import {
  TEMPERATURE_UNIT_LABEL,
  useUnitPreferences,
  type UnitPreferences,
} from "@/lib/units";
import type { WeatherSource } from "@/types/weather";

type FetchStatus = "idle" | "loading" | "success" | "error";

type LiveWeatherFillProps = {
  // A known point for this record (property center or a camera site). When null
  // the button falls back to the device's GPS location so it still works before
  // any assets are placed on the map.
  location: WeatherPoint | null;
  // The day this record is for. When it is a past date (e.g. logging a sit from
  // last week), the button fills the ACTUAL conditions for that date from
  // weather history instead of right-now live weather. Omit/null for "now".
  when?: Date | null;
  onApply: (fields: LiveWeatherFields, source: WeatherSource) => void;
};

export default function LiveWeatherFill({
  location,
  when = null,
  onApply,
}: LiveWeatherFillProps) {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [message, setMessage] = useState("");
  const units = useUnitPreferences();
  // Pull from history only for a genuinely past day; today or a future planned
  // sit falls through to current live conditions (the old behavior).
  const usesHistory = Boolean(when && isBeforeToday(when));

  async function resolvePoint(): Promise<WeatherPoint | null> {
    if (location) return location;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  async function handleFetch() {
    setStatus("loading");
    setMessage("");

    const point = await resolvePoint();

    if (!point) {
      setStatus("error");
      setMessage(
        "Add a camera or map pin to this property, or allow location access, so Deer Intel knows where to pull weather.",
      );
      return;
    }

    if (usesHistory && when) {
      const historical = await fetchHistoricalWeather(point, when, units);

      if (!historical) {
        setStatus("error");
        setMessage(
          "Weather history isn't available for that date and location yet.",
        );
        return;
      }

      // History has no moon (Open-Meteo doesn't report it), so derive it for the
      // hunt date locally, exactly like the live path does for today.
      const fields: LiveWeatherFields = {
        temperature: historical.temperature,
        windDirection: historical.windDirection,
        windSpeed: historical.windSpeed,
        weather: historical.weather,
        moonPhase: describeMoonPhase(when.getTime()),
      };

      onApply(fields, "historical");
      setStatus("success");
      setMessage(`Filled from weather history: ${summarize(fields, units)}`);
      return;
    }

    const result = await fetchLiveWeather(point, units);

    if (result.status === "error") {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    onApply(result.fields, "live");
    setStatus("success");
    setMessage(`Filled from live weather: ${result.summary}`);
  }

  return (
    <div style={containerStyle}>
      <Button
        type="button"
        variant="secondary"
        onClick={handleFetch}
        disabled={status === "loading"}
        style={buttonStyle}
      >
        {status === "loading"
          ? usesHistory
            ? "Getting that day's weather..."
            : "Getting live weather..."
          : usesHistory
            ? "Use weather from that day"
            : "Use live weather"}
      </Button>
      {message ? (
        <p
          style={{
            ...messageStyle,
            color:
              status === "error"
                ? "var(--danger-text)"
                : "var(--success-text)",
          }}
        >
          {message}
        </p>
      ) : (
        <p style={{ ...messageStyle, color: "var(--accent-text)" }}>
          {usesHistory
            ? "Auto-fills the actual temperature, wind, sky, and moon for the hunt date from weather history."
            : "Auto-fills temperature, wind, sky, and moon phase from your property location."}
        </p>
      )}
    </div>
  );
}

// True when a date falls on a day before today (local), i.e. weather history
// applies rather than current conditions.
function isBeforeToday(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return date.getTime() < todayStart.getTime();
}

// A short "temp / wind / sky / moon" recap for the success message, mirroring
// the summary the live-weather path returns.
function summarize(fields: LiveWeatherFields, units: UnitPreferences): string {
  const parts = [
    fields.temperature
      ? `${fields.temperature}${TEMPERATURE_UNIT_LABEL[units.temperature]}`
      : "",
    [fields.windDirection, fields.windSpeed].filter(Boolean).join(" "),
    fields.weather,
    fields.moonPhase ? `${fields.moonPhase} moon` : "",
  ].filter(Boolean);

  return parts.join(" / ") || "saved";
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  marginBottom: "1rem",
};

// The shared Button carries the themed colors, radius, and hover/press; we only
// keep it left-aligned within the grid container.
const buttonStyle: CSSProperties = {
  justifySelf: "start",
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  lineHeight: 1.4,
};
