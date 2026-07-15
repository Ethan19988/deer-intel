export type AiScoutConditions = {
  windDirection: string;
  windSpeed: string;
  temperature: string;
  moonPhase: string;
  notes: string;
};

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
};

export type AiScoutHuntContext = {
  date: string;
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
  bestWind?: string;
};

/** Compact, trimmed snapshot of one property's saved data sent to the LLM. */
export type AiScoutRequestContext = {
  property: AiScoutPropertyContext;
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
