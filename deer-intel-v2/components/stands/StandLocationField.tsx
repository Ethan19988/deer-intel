"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { formatCoordinate } from "@/lib/standFormValues";

// Where the stand is. Saved as a "Stand" map pin linked to the stand, so the
// wind suggestion, walk-in scent check and map all know where it sits.
// "Use my GPS" takes one fresh fix (for marking the tree you're standing at);
// coordinates can also be typed or pasted, or the stand placed on the map later.

const METERS_TO_YARDS = 1.0936;
// Past this a phone fix can be off by a tree line or more.
const POOR_ACCURACY_M = 30;

type GpsState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "fixed"; accuracyM: number }
  | { status: "error"; message: string };

export default function StandLocationField({
  lat,
  lng,
  onChange,
  savedOnMap = false,
  allowClear = true,
}: {
  lat: string;
  lng: string;
  onChange: (point: { lat: string; lng: string }) => void;
  /** The coordinates shown are the stand's saved map pin, unchanged. */
  savedOnMap?: boolean;
  /**
   * Off when editing a stand that's already on the map: saving with no
   * location leaves its pin alone, so "Clear" would promise more than it does.
   */
  allowClear?: boolean;
}) {
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [manualOpen, setManualOpen] = useState(false);
  const hasLocation = Boolean(lat.trim() && lng.trim());

  function useGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGps({ status: "error", message: "GPS isn't available on this device." });
      return;
    }
    setGps({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        onChange({ lat: formatCoordinate(latitude), lng: formatCoordinate(longitude) });
        setGps({ status: "fixed", accuracyM: accuracy });
      },
      (error) =>
        setGps({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Location access is off for this site. Allow it in Settings, or enter coordinates."
              : "Couldn't get a GPS fix. Try again under open sky, or enter coordinates.",
        }),
      // A fresh, high-accuracy fix: this marks a single tree.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const accuracyYards =
    gps.status === "fixed" ? Math.max(1, Math.round(gps.accuracyM * METERS_TO_YARDS)) : null;

  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>Location</span>

      <div style={buttonRowStyle}>
        <button
          type="button"
          onClick={useGps}
          disabled={gps.status === "locating"}
          style={primaryButtonStyle}
        >
          {gps.status === "locating" ? "Getting GPS fix…" : "Use my GPS"}
        </button>
        <button
          type="button"
          aria-expanded={manualOpen}
          onClick={() => setManualOpen((open) => !open)}
          style={secondaryButtonStyle}
        >
          Enter coordinates
        </button>
      </div>

      {gps.status === "error" ? (
        <p style={errorStyle} role="alert">
          {gps.message}
        </p>
      ) : null}

      {hasLocation ? (
        <p style={statusStyle}>
          <strong>{lat}, {lng}</strong>
          {accuracyYards !== null ? ` · GPS ±${accuracyYards} yd` : ""}
          {savedOnMap ? " · saved on the map" : ""}
        </p>
      ) : (
        <p style={hintStyle}>
          Not set. Stand at the tree and tap Use my GPS, enter coordinates, or{" "}
          <Link href="/map?pin=Stand" style={linkStyle}>
            place it on the map
          </Link>{" "}
          later (name the pin the same as this stand to link them).
        </p>
      )}

      {gps.status === "fixed" && gps.accuracyM > POOR_ACCURACY_M ? (
        <p style={warnStyle}>
          That fix is only good to about ±{accuracyYards} yd. Try again with a
          clear view of the sky, or fine-tune the pin on the map.
        </p>
      ) : null}

      {manualOpen ? (
        <div style={manualGridStyle}>
          <label style={fieldStyle}>
            <span style={smallLabelStyle}>Latitude</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="41.512345"
              value={lat}
              onChange={(event) => onChange({ lat: event.target.value, lng })}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={smallLabelStyle}>Longitude</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="-77.512345"
              value={lng}
              onChange={(event) => onChange({ lat, lng: event.target.value })}
              style={inputStyle}
            />
          </label>
          <p style={{ ...hintStyle, gridColumn: "1 / -1" }}>
            Decimal degrees. Pennsylvania longitudes are negative (west).
          </p>
        </div>
      ) : null}

      {hasLocation && allowClear ? (
        <button
          type="button"
          onClick={() => {
            onChange({ lat: "", lng: "" });
            setGps({ status: "idle" });
          }}
          style={clearButtonStyle}
        >
          Clear location
        </button>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const smallLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const buttonRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};

const baseButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.75rem",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
  touchAction: "manipulation",
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid var(--border-strong, var(--border))",
  background: "transparent",
  color: "var(--text)",
};

const clearButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "44px",
  padding: "0 0.25rem",
  border: "none",
  background: "none",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
};

const statusStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.85rem",
  overflowWrap: "anywhere",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const linkStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 700,
};

const warnStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const errorStyle: CSSProperties = {
  ...warnStyle,
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
};

const manualGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  minWidth: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.7rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  // 16px keeps iOS Safari from zooming the page on focus.
  fontSize: "1rem",
};
