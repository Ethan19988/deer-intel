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

function createAssetIcon(asset: MapAsset, isSelected: boolean) {
  return L.divIcon({
    className: "deer-intel-map-marker",
    html: `<div style="
      width: ${isSelected ? 42 : 36}px;
      height: ${isSelected ? 42 : 36}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${isSelected ? 3 : 2}px solid ${asset.color};
      border-radius: 999px;
      background: ${asset.background};
      color: ${asset.color};
      box-shadow: 0 10px 24px rgba(0, 0, 0, ${isSelected ? 0.5 : 0.35});
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
    ">${asset.shortLabel}</div>`,
    iconSize: isSelected ? [42, 42] : [36, 36],
    iconAnchor: isSelected ? [21, 21] : [18, 18],
    popupAnchor: [0, -18],
  });
}
