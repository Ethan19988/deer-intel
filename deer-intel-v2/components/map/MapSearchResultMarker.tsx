import * as L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { AddressSearchPlace } from "@/lib/propertyMap";

type MapSearchResultMarkerProps = {
  assetType: string;
  result: AddressSearchPlace;
  onCreateAssetHere: () => void;
};

export default function MapSearchResultMarker({
  assetType,
  result,
  onCreateAssetHere,
}: MapSearchResultMarkerProps) {
  return (
    <Marker position={result.center} icon={createSearchIcon()}>
      <Popup>
        <div style={popupWrapStyle}>
          <strong>{result.label}</strong>
          <span>
            {result.typeLabel} - {result.provider}
          </span>
          <button
            type="button"
            style={popupButtonStyle}
            onClick={onCreateAssetHere}
          >
            Create Asset Here
          </button>
          <span style={assetTypeStyle}>{assetType}</span>
        </div>
      </Popup>
    </Marker>
  );
}

function createSearchIcon() {
  return L.divIcon({
    className: "deer-intel-search-marker",
    html: `<div style="
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #ffffff;
      border-radius: 999px;
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
      font-size: 17px;
      font-weight: 900;
    ">S</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

const popupWrapStyle = {
  display: "grid",
  gap: "0.45rem",
  maxWidth: "260px",
  color: "#111711",
} as const;

const popupButtonStyle = {
  minHeight: "38px",
  border: "1px solid #2f6f3b",
  borderRadius: "8px",
  background: "#17331b",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
} as const;

const assetTypeStyle = {
  color: "#485248",
  fontSize: "0.78rem",
  fontWeight: 800,
} as const;
