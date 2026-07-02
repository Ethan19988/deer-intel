export type MapDrawingType =
  | "Access Route"
  | "Trail"
  | "Property Boundary"
  | "Food Plot"
  | "Bedding Area";

export type MapDrawingGeometry = "line" | "polygon";

export type MapDrawingPoint = {
  lat: number;
  lng: number;
};

export type MapDrawing = {
  id: string;
  propertyId: string;
  type: MapDrawingType;
  geometry: MapDrawingGeometry;
  name: string;
  points: MapDrawingPoint[];
  createdAt: string;
};

export const MAP_DRAWING_TYPES: Array<{
  geometry: MapDrawingGeometry;
  type: MapDrawingType;
}> = [
  {
    geometry: "line",
    type: "Access Route",
  },
  {
    geometry: "line",
    type: "Trail",
  },
  {
    geometry: "polygon",
    type: "Property Boundary",
  },
  {
    geometry: "polygon",
    type: "Food Plot",
  },
  {
    geometry: "polygon",
    type: "Bedding Area",
  },
];
