"use client";

import type { CSSProperties } from "react";
import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { CURRENT_URL } from "@/lib/propertyMap";
import type { MapPin, PinType } from "@/types/mapPin";

// Satellite imagery centered on a stand, drawn behind the wind compass so the
// hunter picks winds while looking at the ground: where the bedding, food, and
// parking sit relative to the tree. Plain <img> tiles (the same imagery as the
// map), so there's no second Leaflet map to load.

const BOX = 300; // matches the WindPicker viewBox
const TILE = 256;
// Where the farthest nearby pin lands: out in the wedge band, clear of the
// center ring (46) and inside the rim (128).
const FIT_RADIUS_PX = 112;
const MAX_ZOOM = 18;
const MIN_ZOOM = 13;
const METERS_TO_YARDS = 1.0936;

const PIN_STYLE: Partial<Record<PinType, { letter: string; color: string; name: string }>> = {
  Bedding: { letter: "B", color: "#8b5a2b", name: "Bedding" },
  "Bedding Area": { letter: "B", color: "#8b5a2b", name: "Bedding" },
  Food: { letter: "F", color: "#3f8f3a", name: "Food" },
  "Food Source": { letter: "F", color: "#3f8f3a", name: "Food" },
  Water: { letter: "W", color: "#2f7fc1", name: "Water" },
  "Water Source": { letter: "W", color: "#2f7fc1", name: "Water" },
  Parking: { letter: "P", color: "#4b5563", name: "Parking" },
  Gate: { letter: "G", color: "#4b5563", name: "Gate" },
};

function worldPx(point: LatLng, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((point.lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function metersPerPx(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Fractional zoom that puts the farthest nearby pin at FIT_RADIUS_PX from the
 * stand, so the ground around the tree fills the compass instead of bunching
 * in the middle. No pins nearby → a close look at the stand itself.
 */
export function pickWindMapZoom(center: LatLng, pins: LatLng[], reachM: number): number {
  const farthest = pins
    .map((pin) => distanceMeters(center, pin))
    .filter((distance) => distance <= reachM)
    .reduce((max, distance) => Math.max(max, distance), 0);
  if (farthest < 20) return 17;
  const metersAtZoomZero = 156543.03392 * Math.cos((center.lat * Math.PI) / 180);
  const zoom = Math.log2((metersAtZoomZero * FIT_RADIUS_PX) / farthest);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export default function StandWindBackdrop({
  center,
  pins,
  reachM,
}: {
  center: LatLng;
  pins: MapPin[];
  reachM: number;
}) {
  const shown = pins.filter((pin) => PIN_STYLE[pin.type]);
  const exactZoom = pickWindMapZoom(center, shown, reachM);
  // Fetch tiles one level deeper than needed and draw them a little smaller,
  // so the imagery stays sharp at a fractional zoom.
  const zoom = Math.min(MAX_ZOOM, Math.ceil(exactZoom));
  const scale = 2 ** (exactZoom - zoom);
  const tileSize = TILE * scale;
  const origin = worldPx(center, zoom);
  // Everything below is in the 300-unit compass box; world px × scale.
  const left = origin.x * scale - BOX / 2;
  const top = origin.y * scale - BOX / 2;

  const tiles: { x: number; y: number }[] = [];
  for (let tx = Math.floor(left / tileSize); tx <= Math.floor((left + BOX) / tileSize); tx += 1) {
    for (let ty = Math.floor(top / tileSize); ty <= Math.floor((top + BOX) / tileSize); ty += 1) {
      tiles.push({ x: tx, y: ty });
    }
  }

  const pct = (value: number) => `${(value / BOX) * 100}%`;
  // The rim of the wedges (128 units out) in yards.
  const ringYards =
    Math.round((128 * (metersPerPx(center.lat, zoom) / scale) * METERS_TO_YARDS) / 25) * 25;
  const legend = Array.from(
    new Map(
      shown.map((pin) => [PIN_STYLE[pin.type]!.name, PIN_STYLE[pin.type]!]),
    ).values(),
  );

  return (
    <div style={frameStyle} aria-hidden="true">
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${tile.x}-${tile.y}`}
          alt=""
          draggable={false}
          src={CURRENT_URL.replace("{z}", String(zoom))
            .replace("{x}", String(tile.x))
            .replace("{y}", String(tile.y))}
          style={{
            ...tileStyle,
            left: pct(tile.x * tileSize - left),
            top: pct(tile.y * tileSize - top),
            width: pct(tileSize + 0.5),
            height: pct(tileSize + 0.5),
          }}
        />
      ))}
      <div style={shadeStyle} />
      {shown.map((pin) => {
        const point = worldPx(pin, zoom);
        const x = point.x * scale - left;
        const y = point.y * scale - top;
        if (x < 6 || y < 6 || x > BOX - 6 || y > BOX - 6) return null;
        const style = PIN_STYLE[pin.type]!;
        return (
          <span
            key={pin.id}
            title={pin.name || style.name}
            style={{ ...pinStyle, left: pct(x), top: pct(y), background: style.color }}
          >
            {style.letter}
          </span>
        );
      })}
      <span style={{ ...standDotStyle, left: "50%", top: "50%" }} />
      <span style={scaleStyle}>Rim ≈ {ringYards} yd</span>
      {legend.length ? (
        <span style={legendStyle}>
          {legend.map((item) => `${item.letter} ${item.name}`).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

const frameStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  borderRadius: "50%",
  background: "#2b3a2a",
  pointerEvents: "none",
};

const tileStyle: CSSProperties = {
  position: "absolute",
  maxWidth: "none",
  userSelect: "none",
};

const shadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(10, 16, 10, 0.18)",
};

const pinStyle: CSSProperties = {
  position: "absolute",
  width: "20px",
  height: "20px",
  marginLeft: "-10px",
  marginTop: "-10px",
  display: "grid",
  placeItems: "center",
  borderRadius: "999px",
  border: "2px solid #fff",
  color: "#fff",
  fontSize: "11px",
  fontWeight: 900,
  boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
  zIndex: 2,
};

const standDotStyle: CSSProperties = {
  position: "absolute",
  width: "16px",
  height: "16px",
  marginLeft: "-8px",
  marginTop: "-8px",
  borderRadius: "999px",
  background: "#f97316",
  border: "3px solid #fff",
  boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
  zIndex: 2,
};

const scaleStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "3%",
  transform: "translateX(-50%)",
  padding: "1px 6px",
  borderRadius: "var(--radius-sm)",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontSize: "10px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  zIndex: 3,
};

const legendStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "3%",
  transform: "translateX(-50%)",
  padding: "1px 6px",
  borderRadius: "var(--radius-sm)",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontSize: "10px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  zIndex: 3,
};
