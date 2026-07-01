import type { Camera } from "@/types/camera";
import type { MapPin, PinType } from "@/types/mapPin";

export type MapCenter = [number, number];
export type MapLayerId =
  | "satellite"
  | "roads"
  | "terrain"
  | "hybrid"
  | "topographic";
export type AssetLayerId =
  | "cameras"
  | "stands"
  | "bedding"
  | "food"
  | "water"
  | "scrapes"
  | "rubs"
  | "trails"
  | "parking"
  | "gates";

export type MapLayer = {
  id: MapLayerId;
  label: string;
  url: string;
  attribution: string;
  isPlaceholder?: boolean;
  overlayLayers?: Array<{
    attribution: string;
    label: string;
    url: string;
  }>;
};

export type AddressSearchResult =
  | {
      status: "found";
      center: MapCenter;
      label: string;
      zoom?: number;
    }
  | {
      status: "not-found" | "provider-missing";
      message: string;
    };

export type AssetLayer = {
  id: AssetLayerId;
  label: string;
  shortLabel: string;
  color: string;
  background: string;
};

export type MapAsset = {
  id: string;
  source: "camera" | "pin";
  layerId: AssetLayerId | "other";
  label: string;
  typeLabel: string;
  shortLabel: string;
  color: string;
  background: string;
  lat: number;
  lng: number;
  description: string;
  pinId?: string;
};

export const DEFAULT_MAP_CENTER: MapCenter = [40.9, -77.8];
export const DEFAULT_MAP_ZOOM = 8;

const SATELLITE_REFERENCE_OVERLAYS: NonNullable<
  MapLayer["overlayLayers"]
> = [
  {
    attribution: "Roads &copy; Esri",
    label: "Roads",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  },
  {
    attribution: "Labels &copy; Esri",
    label: "Labels",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  },
];

export const MAP_LAYERS: MapLayer[] = [
  {
    id: "satellite",
    label: "Satellite",
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    overlayLayers: SATELLITE_REFERENCE_OVERLAYS,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  {
    id: "roads",
    label: "Roads",
    attribution: "&copy; OpenStreetMap contributors",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  {
    id: "terrain",
    label: "Terrain",
    attribution:
      "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlayLayers: SATELLITE_REFERENCE_OVERLAYS,
  },
  {
    id: "topographic",
    label: "Topographic",
    attribution:
      "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
    isPlaceholder: true,
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
];

export const MAP_LAYER_BY_ID = MAP_LAYERS.reduce<Record<MapLayerId, MapLayer>>(
  (lookup, layer) => {
    lookup[layer.id] = layer;
    return lookup;
  },
  {} as Record<MapLayerId, MapLayer>,
);

export const ASSET_LAYERS: AssetLayer[] = [
  {
    id: "cameras",
    label: "Camera Sites",
    shortLabel: "C",
    color: "#f5c542",
    background: "#33280b",
  },
  {
    id: "stands",
    label: "Stands",
    shortLabel: "S",
    color: "#95d27a",
    background: "#172912",
  },
  {
    id: "bedding",
    label: "Bedding",
    shortLabel: "B",
    color: "#c6a1ff",
    background: "#241735",
  },
  {
    id: "food",
    label: "Food",
    shortLabel: "F",
    color: "#78d98d",
    background: "#102a16",
  },
  {
    id: "water",
    label: "Water",
    shortLabel: "W",
    color: "#74c7ff",
    background: "#102334",
  },
  {
    id: "scrapes",
    label: "Scrapes",
    shortLabel: "SC",
    color: "#ffb36b",
    background: "#301b0b",
  },
  {
    id: "rubs",
    label: "Rubs",
    shortLabel: "R",
    color: "#ff8b5c",
    background: "#321409",
  },
  {
    id: "trails",
    label: "Trails",
    shortLabel: "T",
    color: "#d9c27a",
    background: "#2e2610",
  },
  {
    id: "parking",
    label: "Parking",
    shortLabel: "P",
    color: "#f1f5ef",
    background: "#202820",
  },
  {
    id: "gates",
    label: "Gates",
    shortLabel: "G",
    color: "#f2d48b",
    background: "#2f2511",
  },
];

export const ASSET_LAYER_LOOKUP = ASSET_LAYERS.reduce<
  Record<AssetLayerId, AssetLayer>
>((lookup, layer) => {
  lookup[layer.id] = layer;
  return lookup;
}, {} as Record<AssetLayerId, AssetLayer>);

export const PIN_LAYER_LOOKUP: Record<PinType, AssetLayerId | "other"> = {
  "Trail Camera": "cameras",
  Treestand: "stands",
  "Bedding Area": "bedding",
  "Food Source": "food",
  "Water Source": "water",
  Scrape: "scrapes",
  Rub: "rubs",
  "Rub Line": "rubs",
  Trail: "trails",
  "Access Route": "trails",
  Parking: "parking",
  Gate: "gates",
  "Buck Sighting": "other",
  "Doe Sighting": "other",
  Vegetation: "other",
};

const OTHER_ASSET_STYLE = {
  shortLabel: "O",
  color: "#f7d17b",
  background: "#2f230f",
};

export async function geocodeAddressOrPlace(
  query: string,
): Promise<AddressSearchResult> {
  query.trim();

  return {
    status: "provider-missing",
    message: "Address search is not connected yet.",
  };
}

export function createVisibleAssetLayerState() {
  return ASSET_LAYERS.reduce<Record<AssetLayerId, boolean>>((layers, layer) => {
    layers[layer.id] = true;
    return layers;
  }, {} as Record<AssetLayerId, boolean>);
}

export function cameraToMapAsset(camera: Camera): MapAsset | null {
  if (
    typeof camera.latitude !== "number" ||
    typeof camera.longitude !== "number"
  ) {
    return null;
  }

  const layer = ASSET_LAYER_LOOKUP.cameras;

  return {
    id: `camera-${camera.id}`,
    source: "camera",
    layerId: "cameras",
    label: camera.name,
    typeLabel: `${camera.cameraType} Camera`,
    shortLabel: layer.shortLabel,
    color: layer.color,
    background: layer.background,
    lat: camera.latitude,
    lng: camera.longitude,
    description: camera.locationNotes || camera.notes || "Saved camera site.",
  };
}

export function pinToMapAsset(pin: MapPin): MapAsset {
  const layerId = PIN_LAYER_LOOKUP[pin.type];
  const layer =
    layerId === "other" ? OTHER_ASSET_STYLE : ASSET_LAYER_LOOKUP[layerId];

  return {
    id: `pin-${pin.id}`,
    source: "pin",
    layerId,
    pinId: pin.id,
    label: pin.type,
    typeLabel: "Map Pin",
    shortLabel: layer.shortLabel,
    color: layer.color,
    background: layer.background,
    lat: pin.lat,
    lng: pin.lng,
    description: pin.notes || "Saved map pin.",
  };
}

export function formatCoordinate(value: number) {
  return value.toFixed(5);
}
