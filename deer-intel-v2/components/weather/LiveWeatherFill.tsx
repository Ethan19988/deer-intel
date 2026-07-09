"use client";

import { useState, type CSSProperties } from "react";
import {
  fetchLiveWeather,
  type LiveWeatherFields,
  type WeatherPoint,
} from "@/lib/liveWeather";

type FetchStatus = "idle" | "loading" | "success" | "error";

type LiveWeatherFillProps = {
  // A known point for this record (property center or a camera site). When null
  // the button falls back to the device's GPS location so it still works before
  // any assets are placed on the map.
  location: WeatherPoint | null;
  onApply: (fields: LiveWeatherFields) => void;
};

export default function LiveWeatherFill({
  location,
  onApply,
}: LiveWeatherFillProps) {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [message, setMessage] = useState("");

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

    const result = await fetchLiveWeather(point);

    if (result.status === "error") {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    onApply(result.fields);
    setStatus("success");
    setMessage(`Filled from live weather: ${result.summary}`);
  }

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={handleFetch}
        disabled={status === "loading"}
        style={buttonStyle}
      >
        {status === "loading" ? "Getting live weather..." : "Use live weather"}
      </button>
      {message ? (
        <p
          style={{
            ...messageStyle,
            color: status === "error" ? "#f0a3a3" : "#9fd18a",
          }}
        >
          {message}
        </p>
      ) : (
        <p style={{ ...messageStyle, color: "#85a984" }}>
          Auto-fills temperature, wind, sky, and moon phase from your property
          location.
        </p>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  marginBottom: "1rem",
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "42px",
  padding: "0.55rem 1rem",
  borderRadius: "8px",
  border: "1px solid #3a5a3a",
  background: "#14231400",
  backgroundColor: "#16261699",
  color: "#cfe8c8",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  lineHeight: 1.4,
};
