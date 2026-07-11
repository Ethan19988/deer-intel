import * as L from "leaflet";
import { Marker } from "react-leaflet";
import type { AssetLayerId, MapAsset } from "@/lib/propertyMap";

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

// Line-drawn glyphs per asset type, sized to sit inside the pin head centered
// on (12, 11.5) within a 24-wide teardrop. Stroke inherits the pin color.
const ICON_GLYPHS: Record<AssetLayerId | "other", string> = {
  cameras:
    '<rect x="6.8" y="9" width="10.4" height="6.6" rx="1.6"/><path d="M9.8 9 l1-1.5h2.4l1 1.5"/><circle cx="12" cy="12.3" r="2.1"/>',
  stands:
    '<path d="M12 6.4 l2.7 4.3h-5.4z"/><path d="M12 9.3 l3.1 4.9h-6.2z"/><path d="M12 14.2v2.6"/>',
  bedding:
    '<path d="M6.9 10.2v5.6M6.9 12.7h10.2v3.1M17.1 11.5v4.3"/><path d="M8.7 12.7v-1a1.4 1.4 0 0 1 1.4-1.4h3.8a1.4 1.4 0 0 1 1.4 1.4v1"/>',
  food:
    '<path d="M8 15.6C7.4 9.6 12 6.9 16.6 6.9 16.6 12 13 15.9 8 15.6Z"/><path d="M9.3 14.4 14.8 8.9"/>',
  water:
    '<path d="M12 6.3C12 6.3 8.1 11 8.1 13.5a3.9 3.9 0 0 0 7.8 0C15.9 11 12 6.3 12 6.3Z"/>',
  scrapes:
    '<path d="M9.4 9.4C9.4 9.4 8.9 13 10 14.8M12 8.9C12 8.9 11.6 13.3 12 15.1M14.6 9.4C14.6 9.4 15.1 13 14 14.8"/>',
  rubs:
    '<path d="M10.4 6.4v10.2M13.6 6.4v10.2"/><path d="M8.9 11.6 15.1 9M8.9 13.7 15.1 11.1"/>',
  trails:
    '<path d="M8.2 16.6C10.2 13 9.1 11 11.1 9.4 12.8 8.1 12.6 7.2 13.8 6.4" stroke-dasharray="2 1.7"/>',
  parking:
    '<path d="M10 7v9.5M10 7h3.1a2.5 2.5 0 0 1 0 5H10"/>',
  gates:
    '<path d="M6.9 8.1v7.8M17.1 8.1v7.8M6.9 8.1h10.2M6.9 15.9h10.2M6.9 15.9 17.1 9.5M6.9 12 17.1 8.1"/>',
  other: '<circle cx="12" cy="11.5" r="2.6" fill="currentColor" stroke="none"/>',
};

function createAssetIcon(asset: MapAsset, isSelected: boolean) {
  const width = isSelected ? 38 : 30;
  const height = Math.round((width * 34) / 24);
  const glyph = ICON_GLYPHS[asset.layerId] ?? ICON_GLYPHS.other;

  // Classic teardrop pin: color-outlined dark body with a bright icon in the
  // head and a point that anchors to the exact spot.
  const html = `<svg width="${width}" height="${height}" viewBox="0 0 24 34"
    xmlns="http://www.w3.org/2000/svg"
    style="display:block;filter:drop-shadow(0 4px 5px rgba(0,0,0,0.45));color:${asset.color};overflow:visible;">
    <path d="M12 1C6 1 1.5 5.6 1.5 11.4 1.5 19 12 33 12 33S22.5 19 22.5 11.4C22.5 5.6 18 1 12 1Z"
      fill="${asset.background}" stroke="${asset.color}" stroke-width="${isSelected ? 2.4 : 2}"/>
    <g fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
  </svg>`;

  return L.divIcon({
    className: "deer-intel-map-marker",
    html,
    iconSize: [width, height],
    // Anchor at the pin's tip (bottom center) so it marks the exact location.
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  });
}
