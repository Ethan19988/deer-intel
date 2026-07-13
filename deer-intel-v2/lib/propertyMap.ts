import type { Camera } from "@/types/camera";
import type { MapPin, PinType } from "@/types/mapPin";

export type MapCenter = [number, number];
export type MapLayerId =
  | "satellite"
  | "roads"
  | "terrain"
  | "hybrid"
  | "topographic"
  | "lidar";
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
  /** Esri Wayback imagery whose release (year) can be swapped at runtime. */
  isWayback?: boolean;
  /** Deepest zoom the source has real tiles for; deeper zooms upscale it. */
  maxNativeZoom?: number;
  /** Extra class on the base tile layer for tone/contrast tuning (e.g. LiDAR). */
  className?: string;
  overlayLayers?: Array<{
    attribution: string;
    label: string;
    url: string;
    /** 0-1 blend for stacking a relief pass over the base; defaults to 1. */
    opacity?: number;
    /** Extra class on this overlay (e.g. a multiply blend for relief depth). */
    className?: string;
  }>;
};

export type AddressSearchResult =
  | {
      status: "found";
      results: AddressSearchPlace[];
    }
  | {
      status: "not-found" | "error";
      message: string;
    };

export type AddressSearchPlace = {
  id: string;
  center: MapCenter;
  label: string;
  provider: "GPS Coordinates" | "OpenStreetMap" | "US Census";
  typeLabel: string;
  zoom: number;
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
  sourceId: string;
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

export type MapAssetRoute = {
  href?: string;
  unavailableMessage?: string;
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

// "Current" imagery: Esri Wayback's latest release shows the world as of its
// most recent capture (each tile redirects to its freshest version), so it
// reads as close to "today" as free imagery gets. USDA NAIP is the sharpest
// US aerial but a static yearly mosaic — kept as a high-detail alternative.
const CURRENT_URL =
  "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/32246/{z}/{y}/{x}";
const CURRENT_ATTRIBUTION =
  "Imagery &copy; Esri, Maxar, Earthstar Geographics (World Imagery, updated 2026)";
const NAIP_URL =
  "https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer/tile/{z}/{y}/{x}";
const NAIP_ATTRIBUTION = "Aerial imagery &copy; USDA NAIP (US)";

// LiDAR terrain — a Spartan Forge–style shaded relief. Esri's World Hillshade is
// a *multidirectional* hillshade (lit from several angles at once) built on the
// USGS 3DEP LiDAR-derived elevation where it exists, so subtle micro-terrain the
// satellite can't show — benches, saddles, draws, ditches, old logging grades,
// and the fine ridgelines that funnel deer — pops in crisp 3D. A second 3DEP
// hillshade is stacked at low opacity to deepen shadows for extra bite, and a
// contrast/tone filter (di-lidar-tiles) gives it the punchy LiDAR look.
const ESRI_HILLSHADE_URL =
  "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const USGS_HILLSHADE_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSHillshade/MapServer/tile/{z}/{y}/{x}";
const LIDAR_ATTRIBUTION =
  "Shaded relief &copy; Esri, USGS 3DEP (LiDAR-derived multidirectional hillshade)";

export const MAP_LAYERS: MapLayer[] = [
  {
    id: "satellite",
    label: "Current",
    attribution: CURRENT_ATTRIBUTION,
    isWayback: true,
    maxNativeZoom: 19,
    url: CURRENT_URL,
  },
  {
    id: "roads",
    label: "Roads",
    attribution: "&copy; OpenStreetMap contributors",
    maxNativeZoom: 19,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  {
    id: "terrain",
    label: "Terrain",
    attribution:
      "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
    maxNativeZoom: 17,
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
  {
    id: "hybrid",
    label: "Current + labels",
    attribution: CURRENT_ATTRIBUTION,
    isWayback: true,
    maxNativeZoom: 19,
    url: CURRENT_URL,
    overlayLayers: SATELLITE_REFERENCE_OVERLAYS,
  },
  {
    id: "topographic",
    label: "Aerial (sharp, US)",
    attribution: NAIP_ATTRIBUTION,
    maxNativeZoom: 18,
    url: NAIP_URL,
    overlayLayers: SATELLITE_REFERENCE_OVERLAYS,
  },
  {
    id: "lidar",
    label: "LiDAR (US)",
    attribution: LIDAR_ATTRIBUTION,
    maxNativeZoom: 16,
    url: ESRI_HILLSHADE_URL,
    className: "di-lidar-tiles",
    overlayLayers: [
      {
        attribution: "Relief &copy; USGS 3DEP",
        label: "3DEP relief",
        url: USGS_HILLSHADE_URL,
        opacity: 0.65,
        className: "di-lidar-relief",
      },
      ...SATELLITE_REFERENCE_OVERLAYS,
    ],
  },
];

export const MAP_LAYER_BY_ID = MAP_LAYERS.reduce<Record<MapLayerId, MapLayer>>(
  (lookup, layer) => {
    lookup[layer.id] = layer;
    return lookup;
  },
  {} as Record<MapLayerId, MapLayer>,
);

// Data overlays that stack on ANY base map, toggled independently (unlike the
// base-map-bound overlayLayers above). These are dynamic ArcGIS WMS services —
// tiles are rendered on demand with a per-tile bbox — so they render via
// react-leaflet's <WMSTileLayer>, not the XYZ CachedTileLayer path.

// USGS "The National Map" contour service. Its sublayer groups are SCALE
// BANDS, not selectable intervals: one group only draws around web zooms
// 12–13 and the other only at ~14+ (measured empirically — the service's
// advertised scale ranges don't match what its WMS actually renders). A
// "pick your interval" UI can't be honored, so contours are a single on/off
// overlay that requests both bands' lines + labels and lets the service show
// the densest set available at the current zoom, like a paper topo.
export type ContourSetting = "off" | "on";

export const CONTOUR_WMS_URL =
  "https://carto.nationalmap.gov/arcgis/services/contours/MapServer/WMSServer";
// Zoomed OUT, 25-ft lines pack into an unreadable white blur, so switch to a
// sparse 100-ft-only overview (USGS index + intermediate contour lines) that
// lets the map read through. Recolored white like the fine lines.
export const CONTOUR_WMS_COARSE_LINES = "11,13";
// Zoomed IN, thin white 25-ft lines come from the 3DEP DEM's on-the-fly
// contours (same image service the slope overlay uses), recolored white via
// the di-contour-line-white filter, with the labeled USGS layer stacked under
// them for the elevation numbers.
export const CONTOUR_FINE_WMS_URL =
  "https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer";
export const CONTOUR_FINE_WMS_LAYER = "3DEPElevation:Contour 25";
export const CONTOUR_ATTRIBUTION =
  "Contours &copy; USGS The National Map, 3DEP";
// Below this web zoom, hold contours off (prompt the hunter to zoom in).
export const CONTOUR_MIN_ZOOM = 14;
// At/above this zoom, switch from the sparse 100-ft overview (with no numbers)
// to the detailed 25-ft lines + elevation numbers.
export const CONTOUR_FINE_ZOOM = 16;

// USGS 3DEP elevation image service rendered on the fly as a slope map — a
// color ramp that reads steepness (benches, shelves, access difficulty) the
// hillshade can't quantify. Use the "Slope Map" rendering (colorized ramp,
// pale→yellow→red), NOT "Slope Degrees" (a raw grayscale of degrees that
// renders near-black — flat ground ≈ 0° ≈ black — so it just dims the map).
export const SLOPE_WMS_URL =
  "https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer";
export const SLOPE_WMS_LAYER = "3DEPElevation:Slope Map";
export const SLOPE_ATTRIBUTION = "Slope &copy; USGS 3DEP";

// BLM Surface Management Agency — federal + state/local public land colored by
// its managing agency (BLM, USFS, NPS, USFWS, state, …). It's a cached XYZ
// service (Web Mercator), so it rides the normal CachedTileLayer path and gets
// offline caching for free. Cache is capped short of deep zooms, so overzoom
// rather than 404 past the native level.
export const PUBLIC_LAND_TILE_URL =
  "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/tile/{z}/{y}/{x}";
export const PUBLIC_LAND_ATTRIBUTION =
  "Public land &copy; BLM Surface Management Agency";
export const PUBLIC_LAND_MAX_NATIVE_ZOOM = 16;

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
  "Camera Site": "cameras",
  Stand: "stands",
  Bedding: "bedding",
  Food: "food",
  Water: "water",
  Scrape: "scrapes",
  Rub: "rubs",
  Trail: "trails",
  Parking: "parking",
  Gate: "gates",
  "Trail Camera": "cameras",
  Treestand: "stands",
  "Bedding Area": "bedding",
  "Food Source": "food",
  "Water Source": "water",
  "Rub Line": "rubs",
  "Access Route": "trails",
  "Buck Sighting": "other",
  "Doe Sighting": "other",
  Vegetation: "other",
};

const OTHER_ASSET_STYLE = {
  shortLabel: "O",
  color: "#f7d17b",
  background: "#2f230f",
};

const addressSearchCache = new Map<string, AddressSearchResult>();

export async function geocodeAddressOrPlace(
  query: string,
): Promise<AddressSearchResult> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      status: "not-found",
      message: "Enter an address, place, road, or GPS coordinate.",
    };
  }

  const coordinateResult = parseCoordinateSearch(trimmedQuery);

  if (coordinateResult) return coordinateResult;

  const cacheKey = trimmedQuery.toLowerCase();
  const cachedResult = addressSearchCache.get(cacheKey);

  if (cachedResult) return cachedResult;

  // Geocoding runs in our own /api/geocode route, which merges the US Census
  // address geocoder (rural US street coverage) with OpenStreetMap (places and
  // POIs). Doing it server-side also dodges the Census endpoint's missing CORS
  // headers and lets Nominatim receive a proper User-Agent.
  try {
    const response = await fetch(
      `/api/geocode?q=${encodeURIComponent(trimmedQuery)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return {
        status: "error",
        message: "Address search is temporarily unavailable.",
      };
    }

    const searchResult = (await response.json()) as AddressSearchResult;

    if (searchResult.status === "found") {
      addressSearchCache.set(cacheKey, searchResult);
    }

    return searchResult;
  } catch {
    return {
      status: "error",
      message: "Address search is temporarily unavailable.",
    };
  }
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
    sourceId: camera.id,
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
  const notes = pin.notes.trim();

  return {
    id: `pin-${pin.id}`,
    source: "pin",
    sourceId: pin.id,
    layerId,
    pinId: pin.id,
    label: notes || pin.type,
    typeLabel: pin.type,
    shortLabel: layer.shortLabel,
    color: layer.color,
    background: layer.background,
    lat: pin.lat,
    lng: pin.lng,
    description: notes || "Saved map pin.",
  };
}

export function formatCoordinate(value: number) {
  return value.toFixed(5);
}

export function getAssetDetailHref(
  asset: MapAsset,
  propertyId: string,
): MapAssetRoute {
  if (asset.source === "camera") {
    return {
      href: `/properties/${propertyId}/assets/${asset.sourceId}`,
    };
  }

  return {
    unavailableMessage: "Details page not available yet",
  };
}

export function getAssetEditHref(
  asset: MapAsset,
  propertyId: string,
): MapAssetRoute {
  if (asset.source === "camera") {
    return {
      href: `/properties/${propertyId}?editCameraId=${encodeURIComponent(
        asset.sourceId,
      )}#camera-sites`,
    };
  }

  return {
    unavailableMessage: "Edit page not available yet",
  };
}

function parseCoordinateSearch(query: string): AddressSearchResult | null {
  const coordinateMatch = query.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d+(?:\.\d+)?)\s*$/,
  );

  if (!coordinateMatch) return null;

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      status: "not-found",
      message: "GPS coordinates should be latitude, longitude.",
    };
  }

  return {
    status: "found",
    results: [
      {
        id: `coordinates-${latitude}-${longitude}`,
        center: [latitude, longitude],
        label: `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`,
        provider: "GPS Coordinates",
        typeLabel: "GPS Coordinates",
        zoom: 16,
      },
    ],
  };
}

