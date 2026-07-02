import type { CSSProperties } from "react";
import { ASSET_LAYERS, type AssetLayerId } from "@/lib/propertyMap";

type MapLayerControlProps = {
  ownerNamesDisabled: boolean;
  showAssetLayers?: boolean;
  showOwnerNames: boolean;
  showPropertyLines: boolean;
  visibleAssetLayers: Record<AssetLayerId, boolean>;
  onToggleLayer: (layerId: AssetLayerId) => void;
  onToggleOwnerNames: () => void;
  onTogglePropertyLines: () => void;
};

export default function MapLayerControl({
  ownerNamesDisabled,
  showAssetLayers = true,
  showOwnerNames,
  showPropertyLines,
  visibleAssetLayers,
  onToggleLayer,
  onToggleOwnerNames,
  onTogglePropertyLines,
}: MapLayerControlProps) {
  return (
    <div>
      <p style={controlLabelStyle}>Map Overlays</p>
      <div style={overlayToggleRowStyle}>
        <button
          type="button"
          style={{
            ...assetToggleStyle,
            ...(showPropertyLines ? activeAssetToggleStyle : null),
          }}
          onClick={onTogglePropertyLines}
        >
          <span
            style={{
              ...assetToggleDotStyle,
              background: "#202820",
              borderColor: "#f1f5ef",
              color: "#f1f5ef",
            }}
          >
            PL
          </span>
          Property Lines
        </button>
        <button
          type="button"
          disabled={ownerNamesDisabled}
          style={{
            ...assetToggleStyle,
            ...(showOwnerNames && !ownerNamesDisabled
              ? activeAssetToggleStyle
              : null),
            ...(ownerNamesDisabled ? disabledToggleStyle : null),
          }}
          onClick={onToggleOwnerNames}
        >
          <span
            style={{
              ...assetToggleDotStyle,
              background: "#1b2328",
              borderColor: "#a7d3ff",
              color: "#a7d3ff",
            }}
          >
            ON
          </span>
          Owner Names
        </button>
      </div>

      {showAssetLayers ? (
        <>
          <p style={controlLabelStyle}>Property Layers</p>
          <div style={assetToggleGridStyle}>
            {ASSET_LAYERS.map((layer) => {
              const isVisible = visibleAssetLayers[layer.id];

              return (
                <button
                  key={layer.id}
                  type="button"
                  style={{
                    ...assetToggleStyle,
                    ...(isVisible ? activeAssetToggleStyle : null),
                  }}
                  onClick={() => onToggleLayer(layer.id)}
                >
                  <span
                    style={{
                      ...assetToggleDotStyle,
                      background: layer.background,
                      borderColor: layer.color,
                      color: layer.color,
                    }}
                  >
                    {layer.shortLabel}
                  </span>
                  {layer.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

const controlLabelStyle: CSSProperties = {
  margin: "0 0 0.55rem",
  color: "#c6d5c5",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const overlayToggleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.6rem",
  marginBottom: "0.85rem",
};

const assetToggleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
  gap: "0.6rem",
};

const assetToggleStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  gap: "0.55rem",
  padding: "0.55rem 0.65rem",
  border: "1px solid #253425",
  borderRadius: "8px",
  background: "#070a07",
  color: "#aab7a8",
  fontSize: "0.9rem",
  fontWeight: 800,
  cursor: "pointer",
};

const disabledToggleStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.55,
};

const activeAssetToggleStyle: CSSProperties = {
  borderColor: "#3b6843",
  background: "#102111",
  color: "#f1f5ef",
};

const assetToggleDotStyle: CSSProperties = {
  display: "inline-flex",
  width: "28px",
  height: "28px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid",
  borderRadius: "999px",
  fontSize: "0.65rem",
  fontWeight: 900,
};
