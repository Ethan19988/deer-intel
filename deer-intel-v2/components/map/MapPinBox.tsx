import type { CSSProperties, DragEvent } from "react";
import {
  ASSET_LAYER_LOOKUP,
  PIN_LAYER_LOOKUP,
} from "@/lib/propertyMap";
import { PROPERTY_ASSET_PIN_TYPES, type PinType } from "@/types/mapPin";

export const PIN_BOX_DRAG_DATA_TYPE = "application/x-deer-intel-pin";

type MapPinBoxProps = {
  disabled?: boolean;
  isPlacing: boolean;
  message: string;
  pinType: PinType;
  onCancelPlacement: () => void;
  onPinTypeChange: (pinType: PinType) => void;
  onStartPlacement: () => void;
};

export default function MapPinBox({
  disabled = false,
  isPlacing,
  message,
  pinType,
  onCancelPlacement,
  onPinTypeChange,
  onStartPlacement,
}: MapPinBoxProps) {
  const pinStyle = getPinStyle(pinType);

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(PIN_BOX_DRAG_DATA_TYPE, pinType);
    event.dataTransfer.setData("text/plain", pinType);
  }

  return (
    <aside
      className="di-map-pin-box"
      style={pinBoxStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="di-map-pin-box-header" style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Pin Box</p>
          <h3 style={titleStyle}>Place a Pin</h3>
        </div>
        <div
          draggable={!disabled}
          role="button"
          aria-label={`Drag ${pinType} pin`}
          tabIndex={0}
          style={{
            ...pinPreviewStyle,
            background: pinStyle.background,
            borderColor: pinStyle.color,
            color: pinStyle.color,
            opacity: disabled ? 0.55 : 1,
          }}
          onDragStart={handleDragStart}
        >
          {pinStyle.shortLabel}
        </div>
      </div>

      <label className="di-map-pin-box-field" style={fieldStyle}>
        <span style={labelStyle}>Select Pin Type</span>
        <select
          aria-label="Select Pin Type"
          value={pinType}
          disabled={disabled}
          style={selectStyle}
          onChange={(event) => onPinTypeChange(event.target.value as PinType)}
        >
          {PROPERTY_ASSET_PIN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="di-map-pin-box-button"
        disabled={disabled}
        style={{
          ...placeButtonStyle,
          ...(isPlacing ? cancelButtonStyle : null),
          ...(disabled ? disabledButtonStyle : null),
        }}
        onClick={isPlacing ? onCancelPlacement : onStartPlacement}
      >
        {isPlacing ? "Cancel" : "Place Pin"}
      </button>

      <p className="di-map-pin-box-message" style={messageStyle}>
        {message}
      </p>
    </aside>
  );
}

function getPinStyle(pinType: PinType) {
  const layerId = PIN_LAYER_LOOKUP[pinType];

  if (layerId === "other") {
    return {
      shortLabel: "O",
      color: "#f7d17b",
      background: "#2f230f",
    };
  }

  return ASSET_LAYER_LOOKUP[layerId];
}

const pinBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#56705a",
  fontSize: "0.75rem",
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.1rem 0 0",
  color: "#111711",
  fontSize: "1.05rem",
  lineHeight: 1.2,
};

const pinPreviewStyle: CSSProperties = {
  display: "inline-flex",
  width: "48px",
  minHeight: "48px",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid",
  borderRadius: "999px",
  cursor: "grab",
  fontSize: "0.78rem",
  fontWeight: 900,
  boxShadow: "0 12px 26px rgba(0, 0, 0, 0.35)",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const labelStyle: CSSProperties = {
  color: "#56705a",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  width: "100%",
  minHeight: "48px",
  padding: "0.65rem 0.75rem",
  border: "1px solid rgba(17, 23, 17, 0.16)",
  borderRadius: "8px",
  background: "white",
  color: "#111711",
  fontSize: "0.98rem",
};

const placeButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "50px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.85rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 900,
};

const cancelButtonStyle: CSSProperties = {
  borderColor: "#444",
  background: "#1b1b1b",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.58,
  cursor: "not-allowed",
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: "#566157",
  fontSize: "0.84rem",
  fontWeight: 700,
  lineHeight: 1.4,
};
