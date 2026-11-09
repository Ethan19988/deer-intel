export type AiScoutConditions = {
  windDirection: string;
  windSpeed: string;
  temperature: string;
  moonPhase: string;
  notes: string;
  /** "°F" / "°C" — the unit of `temperature` (and of every logged temperature). */
  temperatureUnit?: string;
};

/** The sit AI Scout is planning for: the next one, per lib/todayVerdict. */
export type AiScoutTargetSit = {
  /** "morning" / "evening". */
  period: "morning" | "evening";
  /** Whether the sit is today or tomorrow. */
  day: "today" | "tomorrow";
  /** "This evening", "Tomorrow morning". */
  label: string;
  /** Property-local date of the sit, "YYYY-MM-DD". */
  date?: string;
  /** Forecast wind averaged over that sit window (compass point), e.g. "NW". */
  forecastWind?: string;
  /** Speed with its unit, e.g. "8 mph". */
  forecastWindSpeed?: string;
  /** Under the calm threshold: direction isn't dependable. */
  calmWind?: boolean;
  /** That day's high / low, with unit, e.g. "44°F". */
  dayHigh?: string;
  dayLow?: string;
  /** Property-clock times for that day, e.g. "6:52 AM". */
  sunrise?: string;
  sunset?: string;
  legalStart?: string;
  legalEnd?: string;
};

export type AiScoutSeasonContext = {
  /** e.g. "Seeking". */
  rutPhase: string;
  rutPhaseHint?: string;
  /** Days to the rut peak; negative once it has passed. */
  daysToPeak: number;
  /** True when the peak date is the app's latitude estimate, not the hunter's. */
  peakIsEstimate: boolean;
};

/**
 * The rut as read from the hunter's own recent photos, sits and sign on this
 * property (lib/observedRut) — a hint, not a fact; "unclear" when thin.
 */
export type AiScoutObservedRut = {
  /** "Chasing", "Lockdown", … or "Unclear". */
  phase: string;
  confidence: "low" | "medium" | "high";
  /** Deer photos + sightings in the window. */
  sampleSize: number;
  windowDays: number;
  /** e.g. "3 chasing photos in 10 days". */
  evidence: string[];
  /** "ahead of the calendar" / "behind the calendar" when it differs. */
  vsCalendar?: string;
  summary: string;
};

/** A camera close to a stand, by straight-line distance. */
export type AiScoutNearbyCamera = { name: string; yards: number };

/** A predicted terrain spot close to a stand. */
export type AiScoutNearbyTerrain = { kind: string; title: string; yards: number };

export type AiScoutPropertyContext = {
  name: string;
  county: string;
  acres: string;
  notes: string;
};

export type AiScoutStandContext = {
  name: string;
  standType: string;
  bestWinds: string;
  avoidWinds: string;
  accessRouteNotes: string;
  exitRouteNotes: string;
  notes: string;
  huntCount: number;
  lastHuntDate?: string;
  /** False when the stand has no map location (no nearby cameras/terrain then). */
  located?: boolean;
  /** ≤2 cameras within 800 yd, nearest first (only for located stands). */
  nearestCameras?: AiScoutNearbyCamera[];
  /** ≤3 terrain picks within 400 yd, nearest first (only for located stands). */
  nearbyTerrain?: AiScoutNearbyTerrain[];
};

export type AiScoutHuntContext = {
  date: string;
  /** "HH:MM" as logged, when set. */
  startTime?: string;
  endTime?: string;
  /** "morning" / "evening" / "midday", from the start time when there is one. */
  sit?: string;
  standName: string;
  windDirection: string;
  windSpeed: string;
  temperature: string;
  weather: string;
  moonPhase: string;
  bucks: number;
  does: number;
  fawns: number;
  shotOpportunity: boolean;
  harvest: boolean;
  notes: string;
};

export type AiScoutCameraCheckContext = {
  date: string;
  cameraName: string;
  bucks: number;
  does: number;
  fawns: number;
  notes: string;
};

export type AiScoutDeerProfileContext = {
  nickname: string;
  /** Only active bucks are sent; kept for clarity in the payload. */
  status?: string;
  estimatedAge: string;
  firstSeen: string;
  lastSeen: string;
  notes: string;
};

export type AiScoutBuckPhotoContext = {
  date: string;
  cameraName: string;
  species: string;
  buckName?: string;
  // Conditions the photo was taken in, from its stored weather snapshot.
  temperature?: string;
  windDirection?: string;
  moonPhase?: string;
  notes: string;
};

/** A terrain-predicted spot (bedding, travel, saddle) from the LiDAR read. */
export type AiScoutTerrainPickContext = {
  kind: string;
  title: string;
  detail: string;
  /**
   * Bedding only: the wind deer bed on there (at their back). NOT the hunter's
   * wind — coming in from above on it blows scent onto the beds.
   */
  deerBedOnWind?: string;
  /** How to play the wind at this spot (non-bedding spots). */
  windNote?: string;
  /** Recent camera activity near this spot, e.g. "Ridge Cam 120 yd: 2 bucks, 5 does". */
  cameraActivityNearby?: string;
};

/** Compact, trimmed snapshot of one property's saved data sent to the LLM. */
export type AiScoutRequestContext = {
  property: AiScoutPropertyContext;
  /** The hunter's local date today, "YYYY-MM-DD (Mon)". */
  today?: string;
  /** The sit this plan is for, with its forecast and legal light. */
  targetSit?: AiScoutTargetSit;
  season?: AiScoutSeasonContext;
  /** The rut as the hunter's own cameras/sits read it (see AiScoutObservedRut). */
  observedRut?: AiScoutObservedRut;
  conditions: AiScoutConditions;
  stands: AiScoutStandContext[];
  recentHunts: AiScoutHuntContext[];
  recentCameraChecks: AiScoutCameraCheckContext[];
  deerProfiles: AiScoutDeerProfileContext[];
  recentBuckPhotos: AiScoutBuckPhotoContext[];
  /** Predicted terrain spots (empty when no LiDAR read covers this property). */
  terrainPicks: AiScoutTerrainPickContext[];
};

export type AiScoutConfidence = "low" | "medium" | "high";

export type AiScoutReport = {
  headline: string;
  recommendedStandName: string;
  recommendedStandReasoning: string;
  keyFactors: string[];
  risks: string[];
  confidence: AiScoutConfidence;
};

export type AiScoutStatusResponse = {
  configured: boolean;
};

export type AiScoutErrorResponse = {
  error: string;
};

/** A report still streaming in: only the fields that have started to arrive. */
export type AiScoutPartialReport = Partial<AiScoutReport>;

/** One NDJSON line from the streaming AI Scout route (see lib/aiScoutStream). */
export type AiScoutStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; report: AiScoutReport }
  | { type: "error"; error: string };
