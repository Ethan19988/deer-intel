"use client";

import type { CSSProperties } from "react";
import { MapPinIcon } from "@/components/ui/FieldIcons";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";

// The one property picker for the whole app. Every page reads
// state.selectedPropertyId, so switching here switches everywhere.
export default function PropertySwitcher() {
  const state = useDeerIntelStore();
  if (state.properties.length < 2) return null;

  return (
    <div style={rowStyle}>
    <label className="di-property-switcher" style={wrapStyle}>
      <span style={iconStyle} aria-hidden="true">
        <MapPinIcon size={16} />
      </span>
      <span className="di-visually-hidden">Property</span>
      <select
        value={state.selectedPropertyId}
        onChange={(event) =>
          updateDeerIntelStore((current) => ({
            ...current,
            selectedPropertyId: event.target.value,
          }))
        }
        style={selectStyle}
      >
        {state.properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.name}
          </option>
        ))}
      </select>
    </label>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "0.75rem",
};

const wrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "min(100%, 320px)",
};

const iconStyle: CSSProperties = {
  position: "absolute",
  left: "0.75rem",
  display: "inline-flex",
  color: "var(--accent-text)",
  pointerEvents: "none",
};

const selectStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0.5rem 2rem 0.5rem 2.2rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: 800,
  textOverflow: "ellipsis",
};
