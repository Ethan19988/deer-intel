import * as L from "leaflet";
import { Marker } from "react-leaflet";
import type { MapAsset } from "@/lib/propertyMap";
import { pinMarkerSvg, type GlyphKey } from "@/lib/mapPinIcon";

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

  // Classic teardrop pin: color-outlined dark body with a bright icon in the
  // head and a point that anchors to the exact spot.
  const html = pinMarkerSvg({
    color: asset.color,
    background: asset.background,
    glyphKey: glyphKeyForAsset(asset),
    width,
    selected: isSelected,
  });

  return L.divIcon({
    className: "deer-intel-map-marker",
    html,
    iconSize: [width, height],
    // Anchor at the pin's tip (bottom center) so it marks the exact location.
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  });
}
