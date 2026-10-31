"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import {
  fetchHistoricalWeather,
  fetchLiveWeather,
  weatherFillMode,
  type LiveWeatherFields,
  type WeatherFillMode,
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

/** Where a fill's numbers came from, for a "Forecast for 5:30 PM" style tag. */
export type WeatherFillInfo = {
  mode: WeatherFillMode;
  /** True for an automatic fill, false when the hunter tapped the button. */
  auto: boolean;
  /** Short human label, e.g. "Live now · 2:14 PM" or "History · Oct 30, 6 AM". */
  label: string;
};

type LiveWeatherFillProps = {
  // A known point for this record (property center or a camera site). When null
  // the button falls back to the device's GPS location so it still works before
  // any assets are placed on the map.
  location: WeatherPoint | null;
  // The date and time this record is for. A time already past (earlier today
  // or any earlier day) fills the hourly actuals for that hour; a time still
  // ahead fills the hourly forecast; within half an hour of now (or omitted)
  // fills current live conditions.
  when?: Date | null;
  onApply: (
    fields: LiveWeatherFields,
    source: WeatherSource,
    info: WeatherFillInfo,
  ) => void;
  // Fill on its own when a location is known (no GPS prompt), and again each
  // time `when` changes, so the weather follows the sit's date and start time.
  // The parent decides what an automatic fill may overwrite (`info.auto`).
  autoFetch?: boolean;
};

// Wait for typing in the date/time inputs to settle before refetching.
const AUTO_FETCH_DEBOUNCE_MS = 600;

export default function LiveWeatherFill({
  location,
  when = null,
  onApply,
  autoFetch = false,
}: LiveWeatherFillProps) {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [message, setMessage] = useState("");
  const units = useUnitPreferences();
  const whenTime = when && !Number.isNaN(when.getTime()) ? when.getTime() : null;
  // Mode for the button label; recomputed each render against the clock.
  const mode = weatherFillMode(whenTime === null ? null : new Date(whenTime), new Date());

  // Only the newest request may apply: a slow answer for an old date/time must
  // not land on top of the one the hunter just picked.
  const requestId = useRef(0);
  const locationKey = location ? `${location.lat},${location.lng}` : "";

  useEffect(() => {
    if (!autoFetch || !locationKey) return;

    const timer = setTimeout(() => {
      void handleFetch(true);
    }, AUTO_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // handleFetch reads the latest props each call; this re-runs only when the
    // record's time, the location, or the units change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, locationKey, whenTime, units.temperature, units.wind]);

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

  async function handleFetch(auto = false) {
    const id = ++requestId.current;
    const target = whenTime === null ? null : new Date(whenTime);
    const fetchMode = weatherFillMode(target, new Date());

    setStatus("loading");
    setMessage("");

    const point = await resolvePoint();

    if (id !== requestId.current) return;

    if (!point) {
      setStatus("error");
      setMessage(
        "Add a camera or map pin to this property, or allow location access, so Deer Intel knows where to pull weather.",
      );
      return;
    }

    if (fetchMode !== "current" && target) {
      const hourly = await fetchHistoricalWeather(point, target, units);

      if (id !== requestId.current) return;

      if (!hourly) {
        setStatus("error");
        setMessage(
          fetchMode === "forecast"
            ? "No hourly forecast for that time yet (forecasts run about two weeks out)."
            : "Weather history isn't available for that date and location yet.",
        );
        return;
      }

      // Open-Meteo has no moon, so derive it for the record's time locally,
      // exactly like the live path does for today.
      const fields: LiveWeatherFields = {
        temperature: hourly.temperature,
        windDirection: hourly.windDirection,
        windSpeed: hourly.windSpeed,
        weather: hourly.weather,
        moonPhase: describeMoonPhase(target.getTime()),
      };
      const label = `${fetchMode === "forecast" ? "Forecast" : "History"} · ${hourLabel(target)}`;

      onApply(fields, fetchMode === "forecast" ? "live" : "historical", {
        mode: fetchMode,
        auto,
        label,
      });
      setStatus("success");
      setMessage(
        `${fetchMode === "forecast" ? "Hourly forecast" : "Weather history"} for ${hourLabel(target)}: ${summarize(fields, units)}`,
      );
      return;
    }

    const result = await fetchLiveWeather(point, units);

    if (id !== requestId.current) return;

    if (result.status === "error") {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    const fetchedAt = new Date();
    onApply(result.fields, "live", {
      mode: "current",
      auto,
      label: `Live now · ${fetchedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
    });
    setStatus("success");
    setMessage(`Live weather right now: ${result.summary}`);
  }

  return (
    <div style={containerStyle}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => void handleFetch(false)}
        disabled={status === "loading"}
        style={buttonStyle}
      >
        {status === "loading"
          ? "Getting weather..."
          : mode === "history"
            ? "Use weather from that time"
            : mode === "forecast"
              ? "Use forecast for that time"
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
          {mode === "history"
            ? "Fills the actual temperature, wind, sky, and moon for that hour from weather history."
            : mode === "forecast"
              ? "Fills the hourly forecast temperature, wind, sky, and moon for that hour."
              : "Fills temperature, wind, sky, and moon phase from your property location."}
        </p>
      )}
    </div>
  );
}

// "Oct 30, 6 AM" (or "6 AM" for today): the hour the hourly data is for.
function hourLabel(date: Date): string {
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric" });

  return sameDay
    ? time
    : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
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
