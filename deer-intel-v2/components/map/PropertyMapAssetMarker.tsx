import * as L from "leaflet";
import { Marker, Popup } from "react-leaflet";
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
      icon={createAssetIcon(asset)}
      zIndexOffset={isSelected ? 1000 : 0}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: onSelect,
        popupopen: onSelect,
      }}
    >
      <Popup>
        <strong>{asset.label}</strong>
        <br />
        {asset.typeLabel}
        <br />
        {asset.description}
        <br />
        Lat: {asset.lat.toFixed(5)}
        <br />
        Lng: {asset.lng.toFixed(5)}
      </Popup>
    </Marker>
  );
}

function createAssetIcon(asset: MapAsset) {
  return L.divIcon({
    className: "deer-intel-map-marker",
    html: `<div style="
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid ${asset.color};
      border-radius: 999px;
      background: ${asset.background};
      color: ${asset.color};
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
    ">${asset.shortLabel}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}
