import * as L from "leaflet";
import { Marker } from "react-leaflet";
import type { MapAsset } from "@/lib/propertyMap";

type PropertyMapAssetMarkerProps = {
  asset: MapAsset;
  isSelected: boolean;
  onSelect: () => void;
};

export default function PropertyMapAssetMarker({
  asset,
  isSelected,
  onSelect,
}: PropertyMapAssetMarkerProps) {
  return (
    <Marker
      position={[asset.lat, asset.lng]}
      icon={createAssetIcon(asset, isSelected)}
      zIndexOffset={isSelected ? 1000 : 0}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: onSelect,
      }}
    />
  );
}

// Base (unselected) teardrop footprint in CSS pixels; the selected pin scales up
// from this so tapping a marker lifts it above its neighbors.
const PIN_WIDTH = 30;
const PIN_HEIGHT = 40;

function createAssetIcon(asset: MapAsset, isSelected: boolean) {
  const scale = isSelected ? 1.2 : 1;
  const width = Math.round(PIN_WIDTH * scale);
  const height = Math.round(PIN_HEIGHT * scale);
  const label = asset.shortLabel;
  // Two-character labels (e.g. "SC") need to shrink to sit inside the ring.
  const fontSize = label.length > 1 ? 7.4 : 10;

  // A classic teardrop map pin: the asset's color fills the body, a white ring
  // holds the short label in that same color, and the point sits exactly on the
  // coordinate. Reads cleanly over satellite, terrain, or LiDAR imagery.
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 33.5C13 33.5 2 20 2 13A11 11 0 1 1 24 13C24 20 13 33.5 13 33.5Z" fill="${asset.color}" stroke="#ffffff" stroke-width="${isSelected ? 2.4 : 2}" />
      <circle cx="13" cy="13" r="7" fill="#ffffff" />
      <text x="13" y="13" text-anchor="middle" dominant-baseline="central" font-family="inherit" font-size="${fontSize}" font-weight="900" fill="${asset.color}">${label}</text>
    </svg>`;

  return L.divIcon({
    className: "deer-intel-map-marker",
    html: `<div class="di-map-pin${
      isSelected ? " di-map-pin-selected" : ""
    }">${svg}</div>`,
    iconSize: [width, height],
    // Anchor the point of the teardrop on the coordinate, not its center.
    iconAnchor: [Math.round(width / 2), height],
    popupAnchor: [0, -height + 6],
  });
}
