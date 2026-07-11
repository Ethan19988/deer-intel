import * as L from "leaflet";
import { Marker } from "react-leaflet";
import type { MapAsset } from "@/lib/propertyMap";
import { PIN_ICON_PATHS, pinIconForAsset } from "@/lib/mapPinIcons";

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
  // The glyph (camera, stand, deer, …) is drawn in a 24×24 box, then scaled to
  // ~11px and centered inside the ring so it reads at pin size.
  const iconPaths = PIN_ICON_PATHS[pinIconForAsset(asset)];

  // A classic teardrop map pin: the asset's color fills the body, a white ring
  // holds the asset's icon in that same color, and the point sits exactly on the
  // coordinate. Reads cleanly over satellite, terrain, or LiDAR imagery.
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 33.5C13 33.5 2 20 2 13A11 11 0 1 1 24 13C24 20 13 33.5 13 33.5Z" fill="${asset.color}" stroke="#ffffff" stroke-width="${isSelected ? 2.4 : 2}" />
      <circle cx="13" cy="13" r="7" fill="#ffffff" />
      <g fill="${asset.color}" transform="translate(7.48 7.48) scale(0.46)">${iconPaths}</g>
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
