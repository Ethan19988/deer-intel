import type { WeatherSnapshot } from "@/types/weather";

export type HuntLogEntry = {
  id: string;
  propertyId: string;
  standId: string;
  standName: string;
  date: string;
  startTime: string;
  endTime: string;
  windDirection: string;
  windSpeed: string;
  temperature: string;
  weather: string;
  moonPhase: string;
  weatherSnapshot: WeatherSnapshot;
  bucks: number;
  does: number;
  fawns: number;
  shotOpportunity: boolean;
  harvest: boolean;
  notes: string;
  // Tracked bucks (deer profile ids) seen in person on this sit. Optional:
  // older sits predate buck tagging.
  deerProfileIds?: string[];
  // What the entry records. Absent on regular sits (and every older entry);
  // "blood-trail" for a recovery saved from the map, which sit counts, stand
  // stats and pressure leave out.
  kind?: "sit" | "blood-trail";
};
