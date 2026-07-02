import { Polygon, Polyline } from "react-leaflet";
import type { MapDrawing } from "@/types/mapDrawing";

type MapDrawingShapeProps = {
  drawing: MapDrawing;
  isSelected: boolean;
  onSelect: () => void;
};

export default function MapDrawingShape({
  drawing,
  isSelected,
  onSelect,
}: MapDrawingShapeProps) {
  const positions = drawing.points.map((point) => [point.lat, point.lng] as [
    number,
    number,
  ]);
  const style = getDrawingStyle(drawing, isSelected);
  const eventHandlers = {
    click(event: unknown) {
      const leafletEvent = event as {
        originalEvent?: {
          stopPropagation?: () => void;
        };
      };

      leafletEvent.originalEvent?.stopPropagation?.();
      onSelect();
    },
  };

  if (drawing.geometry === "polygon") {
    return (
      <Polygon
        positions={positions}
        pathOptions={style}
        eventHandlers={eventHandlers}
      />
    );
  }

  return (
    <Polyline
      positions={positions}
      pathOptions={style}
      eventHandlers={eventHandlers}
    />
  );
}

export function getDrawingStyle(drawing: MapDrawing, isSelected = false) {
  const color = getDrawingColor(drawing.type);

  return {
    color,
    fillColor: color,
    fillOpacity: drawing.geometry === "polygon" ? 0.18 : 0,
    opacity: isSelected ? 1 : 0.82,
    weight: isSelected ? 5 : 4,
  };
}

function getDrawingColor(type: MapDrawing["type"]) {
  if (type === "Access Route") return "#f2d48b";
  if (type === "Trail") return "#d9c27a";
  if (type === "Property Boundary") return "#f1f5ef";
  if (type === "Food Plot") return "#78d98d";

  return "#c6a1ff";
}
