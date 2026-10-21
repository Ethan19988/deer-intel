"use client";

import type { CSSProperties } from "react";

// The map's top-left property switcher (the app header's switcher is hidden on
// the full-screen map). On phones it stretches to fill the row up to the
// Search and Layers buttons, so the top of the map is one even row. Map style
// and overlays live on the Layers panel's "Map" tab (MapStylePicker).

type MapTopBarProps = {
  properties: Array<{ id: string; name: string }>;
  selectedPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
};

export default function MapTopBar({
  properties,
  selectedPropertyId,
  onSelectProperty,
}: MapTopBarProps) {
  if (properties.length <= 1) return null;

  return (
    <div
      className="di-map-topbar"
      style={barStyle}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <label className="di-map-topbar-chip" style={chipStyle}>
        <span className="di-visually-hidden">Property</span>
        <PinIcon />
        <select
          value={selectedPropertyId}
          onChange={(event) => onSelectProperty(event.target.value)}
          style={selectStyle}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
        <span aria-hidden="true" style={caretStyle}>
          ▾
        </span>
      </label>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", opacity: 0.75 }}
    >
      <path d="M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

const barStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1050,
  display: "flex",
  maxWidth: "calc(100% - 18rem)",
};

const chipStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minWidth: 0,
  minHeight: "44px",
  maxWidth: "16rem",
  padding: "0 0.85rem",
  // Same face as the Search and Layers buttons beside it, so the top row
  // reads as one set of controls (the dark/night themes retint all of them).
  border: "1px solid rgba(25, 34, 25, 0.28)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
  color: "#111711",
  fontSize: "0.9rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const selectStyle: CSSProperties = {
  appearance: "none",
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textOverflow: "ellipsis",
  cursor: "pointer",
};

const caretStyle: CSSProperties = {
  fontSize: "0.75rem",
  opacity: 0.8,
  pointerEvents: "none",
};
