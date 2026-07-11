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

type GlyphKey = AssetLayerId | "deer" | "other";

// Literal glyphs per asset type, drawn to sit inside the pin head centered on
// (12, 11.5) within a 24-wide teardrop. Lines inherit the pin color; a few
// marks are filled (marked inline) where a solid shape reads better small.
const ICON_GLYPHS: Record<GlyphKey, string> = {
  // Trail camera: body, lens, small top mount.
  cameras:
    '<rect x="6.6" y="9" width="10.8" height="6.8" rx="1.5"/><circle cx="12" cy="12.4" r="2.3"/><path d="M8.6 9v-1h2.2v1"/>',
  // Ladder treestand against a tree: trunk, seat with backrest, and a ladder
  // with rungs widening toward the ground.
  stands:
    '<path d="M15.7 5.7v11.4"/><path d="M9.6 9.9h6.1"/><path d="M9.6 9.9v1.3"/><path d="M14.3 9.9v-2.3M12.5 7.6h1.8"/><path d="M10.5 10.1 11.1 16.8M12.6 10.1 13.2 16.8"/><path d="M10.62 12.2h1.78M10.82 14.2h1.9M11.02 16.2h2.02"/>',
  // Bed: frame with headboard and a pillow.
  bedding:
    '<path d="M6.8 11v4.6M6.8 12.7h10.4v2.9M17.2 12.3v3.3"/><path d="M8.6 12.7v-1a1.4 1.4 0 0 1 1.4-1.4h3.8a1.4 1.4 0 0 1 1.4 1.4v1"/>',
  // Food plot: sprout with a stem and two leaves.
  food: '<path d="M12 16.6v-6.2"/><path d="M12 12.6c-2.4 0-4-1.4-4-3.5 2.4 0 4 1.4 4 3.5Z"/><path d="M12 11.1c1.9 0 3.3-1.2 3.3-3-1.9 0-3.3 1.2-3.3 3Z"/>',
  // Water: droplet.
  water:
    '<path d="M12 6.4C12 6.4 8.2 11 8.2 13.5a3.8 3.8 0 0 0 7.6 0C15.8 11 12 6.4 12 6.4Z" fill="currentColor" stroke="none"/>',
  // Scrape: licking branch over a scuffed ground oval.
  scrapes:
    '<path d="M7 8.6h10M12 8.6v2.6"/><ellipse cx="12" cy="14.2" rx="3.6" ry="1.5"/>',
  // Buck rub: a small tiered pine with a bare rubbed patch and gouge marks on
  // the trunk where the buck stripped the bark.
  rubs: '<path d="M12 3.8 13.8 7.3 12.9 7.3 14.8 10.4 13.7 10.4 16 13.5 8 13.5 10.3 10.4 9.2 10.4 11.1 7.3 10.2 7.3Z" fill="currentColor" stroke="none"/><path d="M11.2 13.5v3.4M12.8 13.5v3.4"/><ellipse cx="12" cy="15.1" rx="0.95" ry="1.6" fill="currentColor" fill-opacity="0.32"/><path d="M11.4 14.6 12.7 14.9M11.4 15.8 12.7 16.1"/>',
  // Deer trail: a winding dashed path.
  trails:
    '<path d="M8.5 16.5c2-3.6 1-5.6 3-7.1 1.6-1.2 1.4-2.1 2.5-2.9" stroke-dasharray="2.2 1.8"/>',
  // Parking "P".
  parking: '<path d="M10 7v9.5M10 7h3a2.6 2.6 0 0 1 0 5.2H10"/>',
  // Farm gate.
  gates:
    '<path d="M6.9 8.1v7.8M17.1 8.1v7.8M6.9 8.1h10.2M6.9 15.9h10.2M6.9 15.9 17.1 9.5"/>',
  // Deer sighting: a front-facing buck head with antlers.
  deer: '<path d="M12 16.6c-1.9-1-2.5-3.3-2-5.4h4c0.5 2.1-0.1 4.4-2 5.4Z" fill="currentColor" stroke="none"/><path d="M10.2 11.4 8.6 10.6M13.8 11.4 15.4 10.6"/><path d="M10.3 10.8C9.1 9.7 8.9 8 9 6.8M9 8.4 7.6 7.9M9.1 7 7.9 6.2"/><path d="M13.7 10.8C14.9 9.7 15.1 8 15 6.8M15 8.4 16.4 7.9M14.9 7 16.1 6.2"/>',
  other: '<circle cx="12" cy="11.5" r="2.6" fill="currentColor" stroke="none"/>',
};

// The "other" layer buckets sightings and vegetation, so match the pin's actual
// type there rather than showing a generic dot.
function glyphKeyForAsset(asset: MapAsset): GlyphKey {
  if (asset.layerId !== "other") return asset.layerId;

  const type = (asset.typeLabel ?? "").toLowerCase();
  if (/buck|doe|deer|sighting/.test(type)) return "deer";
  if (/veg/.test(type)) return "food";
  return "other";
}

function createAssetIcon(asset: MapAsset, isSelected: boolean) {
  const width = isSelected ? 38 : 30;
  const height = Math.round((width * 34) / 24);
  const glyph = ICON_GLYPHS[glyphKeyForAsset(asset)];

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
