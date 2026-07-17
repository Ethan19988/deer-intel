// Terrain-derived deer movement prediction.
//
// The existing movementPrediction layer connects assets a hunter has already
// pinned (bedding -> food/water corridors). This layer is the missing half:
// where deer LIKELY bed, travel, and cross based purely on the shape of the
// land — ridges, saddles, drainages, benches, and points — before any scouting.
//
// The landform-to-behavior rules encode findings from the Penn State
// Deer-Forest Study (GPS-collar data on PA big-woods deer):
//  - Deer use steep slopes far from roads as security cover; hunters are most
//    successful on 10-20 degree slopes 500-1000 yds from a road, and vanish
//    beyond that — so the steep core is a refuge to hunt the EDGE of.
//    (deer.psu.edu/goldilocks, deer.psu.edu/shift-or-shrink)
//  - Deer bed on steep sidehills / benches with cover above an open slope, for
//    early warning and a downhill escape. (deer.psu.edu/hillside-does-hiding-spot)
//  - In cold weather deer favor south-facing slopes for thermal gain (up to 6x
//    solar radiation, up to 40F warmer than north-facing).
//    (deer.psu.edu/changes-in-attitude-not-altitude)
//  - Drainages/draws connect bedding to feed and carry travel.
//
// A first version ships hand-built sample data for one property so the map
// layer and its styling can be trialed. The offline LiDAR pipeline (geomorphon
// terrain classification -> these rules) will later emit the same shape per
// property, dropping straight into this module with no UI change.

export type TerrainKind = "bedding" | "travel" | "pinch" | "refuge";

/** [latitude, longitude] — the order Leaflet expects. */
export type LatLng = [number, number];

type TerrainFeatureBase = {
  id: string;
  kind: TerrainKind;
  title: string;
  /** Why this spot, in plain hunter language (grounded in the rules above). */
  detail: string;
  /** How to play the wind / approach, or empty for refuge zones. */
  windNote?: string;
  /**
   * Metres to the nearest road at this spot (S1 "Goldilocks" security band).
   * Set by the pipeline only on scored spots (beds, saddles) and only when a
   * roads layer was supplied — absent on hand-built sets and no-roads runs.
   */
  roadDistM?: number;
};

export type TerrainBeddingFeature = TerrainFeatureBase & {
  kind: "bedding";
  polygon: LatLng[];
};

export type TerrainTravelFeature = TerrainFeatureBase & {
  kind: "travel";
  line: LatLng[];
};

export type TerrainPinchFeature = TerrainFeatureBase & {
  kind: "pinch";
  point: LatLng;
};

export type TerrainRefugeFeature = TerrainFeatureBase & {
  kind: "refuge";
  polygon: LatLng[];
};

export type TerrainMovementFeature =
  | TerrainBeddingFeature
  | TerrainTravelFeature
  | TerrainPinchFeature
  | TerrainRefugeFeature;

export type TerrainMovementSet = {
  areaName: string;
  center: LatLng;
  /** Where the prediction came from, shown for trust. */
  source: string;
  features: TerrainMovementFeature[];
};

/** Rendering colors + labels per landform kind (Leaflet needs hex). */
export const TERRAIN_STYLE: Record<
  TerrainKind,
  { color: string; label: string }
> = {
  bedding: { color: "#e0642a", label: "Likely bedding" },
  travel: { color: "#2f8a49", label: "Travel corridor" },
  pinch: { color: "#eab308", label: "Crossing / pinch point" },
  refuge: { color: "#b23127", label: "Security refuge" },
};

// Prediction set for Moore Hill (Cameron County, PA — summit 41.45953, -78.31918,
// 633 m / 2,077 ft, on the Lyme Emporium Highlands tract). These features are
// anchored on a REAL terrain read: USGS 10 m NED elevation sampled over the
// summit, run through slope/aspect/curvature analysis, and interpreted with the
// Penn State Deer-Forest rules. Coarse (10 m data at ~60 m spacing) but the
// landform shapes are genuine — the 1 m LiDAR pipeline will sharpen the edges
// and exact grades. Same shape the pipeline emits, so it swaps in cleanly.
export const MOORE_HILL_SAMPLE: TerrainMovementSet = {
  areaName: "Moore Hill",
  center: [41.45953, -78.31918],
  source: "USGS 10 m terrain read · Penn State rules · 1 m LiDAR pending",
  features: [
    {
      id: "mh-bed-south",
      kind: "bedding",
      title: "South-face beds (2,000 ft)",
      detail:
        "A run of SSE-facing benches just under the summit — the warmest ground on the hill. Penn State collar deer relocate to south faces for thermal gain (up to 40°F warmer than north slopes) and bed with an open slope below for early warning.",
      windNote: "Beds hold a N/NW wind. Slip in along the ridgetop above them.",
      polygon: [
        [41.45855, -78.3201],
        [41.45855, -78.3182],
        [41.45775, -78.31815],
        [41.45775, -78.32015],
      ],
    },
    {
      id: "mh-bed-spur",
      kind: "bedding",
      title: "SW spur nose",
      detail:
        "A convex point dropping SW off the summit (~2,050 ft). Bucks bed on noses like this to watch two draws at once and read swirling thermals — a higher-elevation early-season rest site.",
      windNote: "Best on a W wind; the nose keeps deer scent down both draws.",
      polygon: [
        [41.45975, -78.3206],
        [41.45975, -78.31955],
        [41.45875, -78.3195],
        [41.45875, -78.32055],
      ],
    },
    {
      id: "mh-travel-bench",
      kind: "travel",
      title: "Below-ridge bench trail",
      detail:
        "A sheltered bench line linking the west and east saddles across the south face — deer skirt just under the crest between bedding areas without skylining.",
      windNote: "Deer walk it into a S wind; set up on the downwind end.",
      line: [
        [41.45845, -78.32135],
        [41.45845, -78.319],
        [41.4596, -78.317],
        [41.46061, -78.31485],
      ],
    },
    {
      id: "mh-travel-draw",
      kind: "travel",
      title: "SE draw",
      detail:
        "The main drainage off the south beds, dropping to ~1,810 ft — the natural bed-to-feed travel line and your quietest, lowest-scent way in.",
      windNote: "Morning thermals pull downhill — hunt the lower end at first light.",
      line: [
        [41.45845, -78.3186],
        [41.4584, -78.3164],
        [41.45845, -78.31485],
        [41.459, -78.3136],
      ],
    },
    {
      id: "mh-pinch-west",
      kind: "pinch",
      title: "West saddle crossing",
      detail:
        "The low gap on the ridge ~200 yds WSW of the summit (1,957 ft), 80 ft under the top. Deer cross ridges at saddles — this one funnels travel between the summit's two flanks. The highest-odds stand on the hill.",
      windNote: "Hunt it on a N/NW wind, sitting the downhill (south) side.",
      point: [41.45845, -78.32135],
    },
    {
      id: "mh-pinch-east",
      kind: "pinch",
      title: "East saddle crossing",
      detail:
        "A second gap on the east shoulder of the ridge (1,957 ft) where the below-ridge bench and an east draw meet — a pinch between bedding and the eastern drainage.",
      windNote: "Set up on a W/SW wind; deer come off the beds to the west.",
      point: [41.46061, -78.31485],
    },
    {
      id: "mh-refuge-core",
      kind: "refuge",
      title: "Steep SW sanctuary",
      detail:
        "The steepest lower flank below the south beds — the far, hard-to-reach ground deer ride the season out in. Don't push it: hunt its upper edge and the saddles leading out of it.",
      polygon: [
        [41.45775, -78.3205],
        [41.45775, -78.319],
        [41.4569, -78.31895],
        [41.4569, -78.32045],
      ],
    },
  ],
};
