import type { CSSProperties } from "react";
import {
  MAP_DRAWING_TYPES,
  type MapDrawingGeometry,
  type MapDrawingType,
} from "@/types/mapDrawing";

type MapDrawingToolbarProps = {
  activeDrawingType: MapDrawingType | null;
  canFinish: boolean;
  pointCount: number;
  onCancel: () => void;
  onFinish: () => void;
  onStartDrawing: (type: MapDrawingType, geometry: MapDrawingGeometry) => void;
};

export default function MapDrawingToolbar({
  activeDrawingType,
  canFinish,
  pointCount,
  onCancel,
  onFinish,
  onStartDrawing,
}: MapDrawingToolbarProps) {
  return (
    <div
      style={toolbarStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={headerStyle}>
        <p style={eyebrowStyle}>Draw</p>
        {activeDrawingType ? (
          <span style={statusPillStyle}>{pointCount} points</span>
        ) : null}
      </div>

      <div style={buttonGridStyle}>
        {MAP_DRAWING_TYPES.map((drawingType) => {
          const isActive = drawingType.type === activeDrawingType;

          return (
            <button
              key={drawingType.type}
              type="button"
              style={{
                ...drawButtonStyle,
                ...(isActive ? activeDrawButtonStyle : null),
              }}
              onClick={() =>
                onStartDrawing(drawingType.type, drawingType.geometry)
              }
            >
              {drawingType.type}
            </button>
          );
        })}
      </div>

      {activeDrawingType ? (
        <div style={activePanelStyle}>
          <p style={helpTextStyle}>Tap the map to add points.</p>
          <div style={actionRowStyle}>
            <button
              type="button"
              style={{
                ...actionButtonStyle,
                ...(canFinish ? primaryActionButtonStyle : disabledButtonStyle),
              }}
              disabled={!canFinish}
              onClick={onFinish}
            >
              Finish
            </button>
            <button
              type="button"
              style={actionButtonStyle}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  position: "absolute",
  top: "5rem",
  right: "1rem",
  zIndex: 1000,
  display: "grid",
  gap: "0.55rem",
  width: "min(270px, calc(100% - 2rem))",
  padding: "0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.58)",
  borderRadius: "8px",
  background: "rgba(17, 23, 17, 0.9)",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.26)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.6rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#dce9da",
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "28px",
  alignItems: "center",
  padding: "0.25rem 0.5rem",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "999px",
  color: "#f1f5ef",
  fontSize: "0.76rem",
  fontWeight: 800,
};

const buttonGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.45rem",
};

const drawButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0.45rem 0.5rem",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.95)",
  color: "#111711",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 900,
};

const activeDrawButtonStyle: CSSProperties = {
  borderColor: "#74a86f",
  background: "#edf7ea",
};

const activePanelStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  paddingTop: "0.5rem",
  borderTop: "1px solid rgba(255, 255, 255, 0.12)",
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "#d8e2d6",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const actionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.45rem",
};

const actionButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0.45rem 0.5rem",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f1f5ef",
  cursor: "pointer",
  fontSize: "0.84rem",
  fontWeight: 900,
};

const primaryActionButtonStyle: CSSProperties = {
  borderColor: "#3b6843",
  background: "#18351d",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};
