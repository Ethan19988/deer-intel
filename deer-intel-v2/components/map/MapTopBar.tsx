"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MapLayerId } from "@/lib/propertyMap";

// The map's top-left controls, kept small so the imagery stays visible:
//   [Property ▾] [Satellite ▾] [Wind ✕] [Contours ✕] …
// The property chip switches property (the app header's switcher is hidden on
// the full-screen map). The style chip opens a panel with every base map and
// overlay toggle, the mapped-trails layer, and older imagery. Overlays that
// are on show as small chips — tap one to turn it off.

type OverlayKey =
  | "contours"
  | "slope"
  | "landcover"
  | "cameraHeat"
  | "deerHeat"
  | "wind"
  | "movement"
  | "terrain";

type MapTopBarProps = {
  properties: Array<{ id: string; name: string }>;
  selectedPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
  selectedLayer: MapLayerId;
  overlays: Record<OverlayKey, boolean>;
  contourNeedsZoomIn: boolean;
  onSelectLayer: (layerId: MapLayerId) => void;
  onToggleOverlay: (key: OverlayKey) => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  /** The base map has dated imagery to step through. */
  canBrowseImagery: boolean;
  showImageryYears: boolean;
  onToggleImageryYears: () => void;
};

const BASE_MAP_CHOICES: Array<{ id: MapLayerId; label: string }> = [
  { id: "hybrid", label: "Satellite" },
  { id: "topographic", label: "Aerial" },
  { id: "terrain", label: "Topo" },
  { id: "lidar", label: "LiDAR" },
  { id: "roads", label: "Roads" },
];

const OVERLAY_CHOICES: Array<{ key: OverlayKey; label: string }> = [
  { key: "wind", label: "Wind" },
  { key: "movement", label: "Movement" },
  { key: "deerHeat", label: "Deer Heat" },
  { key: "terrain", label: "Terrain" },
  { key: "contours", label: "Contours" },
  { key: "slope", label: "Slope Angle" },
  { key: "landcover", label: "Food & Cover" },
  { key: "cameraHeat", label: "Camera Heat" },
];

// More than this many "on" chips collapses the rest into "+N".
const MAX_ACTIVE_CHIPS = 3;

export default function MapTopBar({
  properties,
  selectedPropertyId,
  onSelectProperty,
  selectedLayer,
  overlays,
  contourNeedsZoomIn,
  onSelectLayer,
  onToggleOverlay,
  showTrails,
  onToggleTrails,
  canBrowseImagery,
  showImageryYears,
  onToggleImageryYears,
}: MapTopBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the panel on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const layerLabel =
    BASE_MAP_CHOICES.find((choice) => choice.id === selectedLayer)?.label ?? "Map";
  const active = OVERLAY_CHOICES.filter((choice) => overlays[choice.key]);
  const shownActive = active.slice(0, MAX_ACTIVE_CHIPS);
  const hiddenActive = active.length - shownActive.length;

  return (
    <div
      ref={rootRef}
      className="di-map-topbar"
      style={barStyle}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={rowStyle}>
        {properties.length > 1 ? (
          <label className="di-map-topbar-chip" style={chipStyle}>
            <span className="di-visually-hidden">Property</span>
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
        ) : null}

        <button
          type="button"
          className="di-map-topbar-chip"
          style={{ ...chipStyle, ...(open ? chipOpenStyle : null) }}
          aria-expanded={open}
          aria-controls="di-map-style-panel"
          onClick={() => setOpen((current) => !current)}
        >
          {layerLabel}
          <span aria-hidden="true" style={caretStyle}>
            ▾
          </span>
        </button>

        {shownActive.map((choice) => (
          <button
            key={choice.key}
            type="button"
            style={activeChipStyle}
            aria-label={`Turn off ${choice.label}`}
            onClick={() => onToggleOverlay(choice.key)}
          >
            {choice.label}
            <span aria-hidden="true">✕</span>
          </button>
        ))}
        {hiddenActive > 0 ? (
          <button type="button" style={activeChipStyle} onClick={() => setOpen(true)}>
            +{hiddenActive}
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id="di-map-style-panel"
          className="di-map-style-panel"
          role="dialog"
          aria-label="Map style"
          style={panelStyle}
        >
          <p style={panelHeadingStyle}>Base map</p>
          <div style={segmentGridStyle} role="radiogroup" aria-label="Base map">
            {BASE_MAP_CHOICES.map((choice) => {
              const isActive = choice.id === selectedLayer;
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  style={{ ...segmentStyle, ...(isActive ? activeSegmentStyle : null) }}
                  onClick={() => onSelectLayer(choice.id)}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>

          <p style={panelHeadingStyle}>Overlays</p>
          <div style={pillWrapStyle}>
            {OVERLAY_CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                role="switch"
                aria-checked={overlays[choice.key]}
                style={{ ...pillStyle, ...(overlays[choice.key] ? activeOverlayPillStyle : null) }}
                onClick={() => onToggleOverlay(choice.key)}
              >
                {choice.label}
              </button>
            ))}
            <button
              type="button"
              role="switch"
              aria-checked={showTrails}
              style={{ ...pillStyle, ...(showTrails ? activeOverlayPillStyle : null) }}
              onClick={onToggleTrails}
            >
              Trails &amp; Logging Roads
            </button>
          </div>
          {overlays.contours && contourNeedsZoomIn ? (
            <p style={hintStyle}>Zoom in to see contours.</p>
          ) : null}

          {canBrowseImagery ? (
            <button
              type="button"
              role="switch"
              aria-checked={showImageryYears}
              style={{ ...pillStyle, ...(showImageryYears ? activeSegmentStyle : null), justifySelf: "start" }}
              onClick={onToggleImageryYears}
            >
              {showImageryYears ? "Hide older imagery" : "Browse older imagery"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const barStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1050,
  maxWidth: "calc(100% - 18rem)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  flexWrap: "wrap",
};

const chipStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  minHeight: "44px",
  maxWidth: "12rem",
  padding: "0 0.75rem",
  // Same face as the Search and Layers buttons beside it, so the top row
  // reads as one set of controls (the dark/night themes retint all of them).
  border: "1px solid rgba(25, 34, 25, 0.28)",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
  color: "#111711",
  fontSize: "0.86rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const chipOpenStyle: CSSProperties = {
  borderColor: "#2f6d3a",
  boxShadow: "0 0 0 2px rgba(47, 109, 58, 0.35), 0 10px 24px rgba(0, 0, 0, 0.22)",
};

const selectStyle: CSSProperties = {
  appearance: "none",
  minWidth: 0,
  maxWidth: "9.5rem",
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

const activeChipStyle: CSSProperties = {
  ...chipStyle,
  minHeight: "36px",
  padding: "0 0.6rem",
  borderColor: "rgba(240, 150, 70, 0.6)",
  background: "rgba(194, 87, 28, 0.9)",
  color: "white",
  fontSize: "0.78rem",
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.4rem)",
  left: 0,
  width: "min(340px, calc(100vw - 1.5rem))",
  display: "grid",
  gap: "0.5rem",
  padding: "0.75rem",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: "14px",
  background: "rgba(17, 23, 17, 0.92)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
};

const panelHeadingStyle: CSSProperties = {
  margin: 0,
  color: "rgba(231, 239, 228, 0.7)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const segmentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.3rem",
};

const segmentStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "38px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.35rem 0.6rem",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: "8px",
  background: "transparent",
  color: "#e7efe4",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const activeSegmentStyle: CSSProperties = {
  borderColor: "rgba(149, 210, 122, 0.55)",
  background: "#2f6d3a",
  color: "white",
};

const pillWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
};

const pillStyle: CSSProperties = {
  ...segmentStyle,
  minHeight: "36px",
  fontSize: "0.82rem",
};

// Overlay "on" is blaze orange; base-map selection stays green.
const activeOverlayPillStyle: CSSProperties = {
  borderColor: "rgba(240, 150, 70, 0.6)",
  background: "#c2571c",
  color: "white",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#f2c98a",
  fontSize: "0.78rem",
  fontWeight: 700,
};
