import type { CSSProperties } from "react";
import type { MapAsset } from "@/lib/propertyMap";

type MapAssetSelectorPanelProps = {
  assets: MapAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (asset: MapAsset) => void;
};

export default function MapAssetSelectorPanel({
  assets,
  selectedAssetId,
  onSelectAsset,
}: MapAssetSelectorPanelProps) {
  if (assets.length === 0) return null;

  return (
    <div
      style={panelStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={headerStyle}>
        <p style={eyebrowStyle}>Mapped Assets</p>
        <span style={countStyle}>{assets.length}</span>
      </div>
      <div style={scrollRowStyle}>
        {assets.map((asset) => {
          const isSelected = asset.id === selectedAssetId;

          return (
            <button
              key={asset.id}
              type="button"
              style={{
                ...assetButtonStyle,
                ...(isSelected ? selectedAssetButtonStyle : null),
              }}
              onClick={() => onSelectAsset(asset)}
            >
              <span
                style={{
                  ...assetIconStyle,
                  background: asset.background,
                  borderColor: asset.color,
                  color: asset.color,
                }}
              >
                {asset.shortLabel}
              </span>
              <span style={assetTextStyle}>
                <span style={assetNameStyle}>{asset.label}</span>
                <span style={assetTypeStyle}>{asset.typeLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  right: "1rem",
  bottom: "1rem",
  left: "1rem",
  zIndex: 1050,
  display: "grid",
  gap: "0.5rem",
  padding: "0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.54)",
  borderRadius: "8px",
  background: "rgba(17, 23, 17, 0.9)",
  boxShadow: "0 16px 36px rgba(0, 0, 0, 0.28)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#dce9da",
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const countStyle: CSSProperties = {
  display: "inline-flex",
  minWidth: "28px",
  minHeight: "28px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "999px",
  color: "#f1f5ef",
  fontSize: "0.78rem",
  fontWeight: 900,
};

const scrollRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.55rem",
  maxHeight: "82px",
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: "0.1rem",
};

const assetButtonStyle: CSSProperties = {
  display: "flex",
  minWidth: "180px",
  maxWidth: "240px",
  minHeight: "58px",
  alignItems: "center",
  gap: "0.55rem",
  padding: "0.55rem 0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.95)",
  color: "#111711",
  cursor: "pointer",
  textAlign: "left",
};

const selectedAssetButtonStyle: CSSProperties = {
  borderColor: "#74a86f",
  background: "#edf7ea",
};

const assetIconStyle: CSSProperties = {
  display: "inline-flex",
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 900,
};

const assetTextStyle: CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: "0.15rem",
};

const assetNameStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.9rem",
  fontWeight: 900,
};

const assetTypeStyle: CSSProperties = {
  overflow: "hidden",
  color: "#475247",
  fontSize: "0.76rem",
  fontWeight: 800,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
