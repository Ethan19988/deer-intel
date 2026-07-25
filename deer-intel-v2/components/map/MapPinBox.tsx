import type { CSSProperties, DragEvent } from "react";
import { ASSET_LAYERS, PIN_LAYER_LOOKUP } from "@/lib/propertyMap";
import { pinMarkerSvg } from "@/lib/mapPinIcon";
import { PROPERTY_ASSET_PIN_TYPES, type PinType } from "@/types/mapPin";

export const PIN_BOX_DRAG_DATA_TYPE = "application/x-deer-intel-pin";

type MapPinBoxProps = {
  disabled?: boolean;
  isPlacing: boolean;
  message: string;
  pinType: PinType;
  onPlacePin: (pinType: PinType) => void;
};

// One quick-place button per property pin type, styled as the exact teardrop
// pin that will land on the map. Tap to arm placement (the drawer closes and
// the next map tap drops the pin); desktop users can also drag a pin onto the
// map. The lookup keeps the button and marker in sync with ASSET_LAYERS.
const PIN_OPTIONS = PROPERTY_ASSET_PIN_TYPES.map((type) => {
  const layerId = PIN_LAYER_LOOKUP[type];
  const layer =
    layerId === "other"
      ? { label: type, color: "#f7d17b", background: "#2f230f" }
      : ASSET_LAYERS.find((entry) => entry.id === layerId)!;

  return { type, layerId, label: layer.label, color: layer.color, background: layer.background };
});

export default function MapPinBox({
  disabled = false,
  isPlacing,
  message,
  pinType,
  onPlacePin,
}: MapPinBoxProps) {
  function handleDragStart(event: DragEvent<HTMLButtonElement>, type: PinType) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(PIN_BOX_DRAG_DATA_TYPE, type);
    event.dataTransfer.setData("text/plain", type);
  }

  return (
    <aside
      className="di-map-pin-box"
      style={pinBoxStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={gridStyle}>
        {PIN_OPTIONS.map((option) => {
          const active = isPlacing && option.type === pinType;

          return (
            <button
              key={option.type}
              type="button"
              className="di-map-pin-box-option"
              draggable={!disabled}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`Place ${option.label} pin`}
              style={{
                ...optionStyle,
                ...(active ? activeOptionStyle : null),
                ...(disabled ? disabledOptionStyle : null),
              }}
              onDragStart={(event) => handleDragStart(event, option.type)}
              onClick={() => !disabled && onPlacePin(option.type)}
            >
              <span
                aria-hidden="true"
                style={pinPreviewStyle}
                dangerouslySetInnerHTML={{
                  __html: pinMarkerSvg({
                    color: option.color,
                    background: option.background,
                    glyphKey: option.layerId,
                    width: 26,
                  }),
                }}
              />
              <span style={optionLabelStyle}>{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="di-map-pin-box-message" style={messageStyle}>
        {message}
      </p>
    </aside>
  );
}

const pinBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.5rem",
};

const optionStyle: CSSProperties = {
  display: "flex",
  minHeight: "78px",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  padding: "0.6rem 0.3rem",
  border: "1px solid rgba(17, 23, 17, 0.12)",
  borderRadius: "10px",
  background: "white",
  color: "#1b241b",
  cursor: "pointer",
};

const activeOptionStyle: CSSProperties = {
  borderColor: "#2f6d3a",
  background: "#eef4ea",
  boxShadow: "0 0 0 2px rgba(47, 109, 58, 0.25)",
};

const disabledOptionStyle: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.55,
};

const pinPreviewStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "37px",
  cursor: "grab",
};

const optionLabelStyle: CSSProperties = {
  overflow: "hidden",
  maxWidth: "100%",
  fontSize: "0.8rem",
  fontWeight: 750,
  lineHeight: 1.15,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: "#566157",
  fontSize: "0.84rem",
  fontWeight: 700,
  lineHeight: 1.4,
};
