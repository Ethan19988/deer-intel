import type { CSSProperties } from "react";
import { MAP_LAYERS, type MapLayerId } from "@/lib/propertyMap";

type MapModeSelectorProps = {
  selectedLayer: MapLayerId;
  onSelectLayer: (layerId: MapLayerId) => void;
};

export default function MapModeSelector({
  selectedLayer,
  onSelectLayer,
}: MapModeSelectorProps) {
  return (
    <div>
      <p style={controlLabelStyle}>Map Mode</p>
      <div style={layerButtonGridStyle}>
        {MAP_LAYERS.map((layer) => {
          const isSelected = layer.id === selectedLayer;

          return (
            <button
              key={layer.id}
              type="button"
              style={{
                ...layerButtonStyle,
                ...(isSelected ? selectedLayerButtonStyle : null),
              }}
              onClick={() => onSelectLayer(layer.id)}
            >
              {layer.label}
              {layer.isPlaceholder ? (
                <span style={placeholderTextStyle}>Placeholder</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const controlLabelStyle: CSSProperties = {
  margin: "0 0 0.55rem",
  color: "#c6d5c5",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const layerButtonGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))",
  gap: "0.6rem",
};

const layerButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "46px",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.65rem 0.75rem",
  border: "1px solid #2b3a2b",
  borderRadius: "8px",
  background: "#071007",
  color: "#dce9da",
  fontSize: "0.94rem",
  fontWeight: 800,
  cursor: "pointer",
};

const selectedLayerButtonStyle: CSSProperties = {
  borderColor: "#4c8d56",
  background: "#17331b",
  color: "white",
};

const placeholderTextStyle: CSSProperties = {
  color: "#9faa9d",
  fontSize: "0.72rem",
  fontWeight: 800,
};
