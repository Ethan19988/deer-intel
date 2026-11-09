import { describe, expect, it } from "vitest";
import {
  EMPTY_AI_SCOUT_CONDITIONS,
  buildAiScoutRequestContext,
  deerBedOnWind,
  sitOfDay,
} from "@/lib/aiScoutContext";
import {
  aiScoutToday,
  buildAiScoutSeason,
  buildAiScoutTargetSit,
  withTemperatureUnit,
} from "@/lib/aiScoutSit";
import type { LiveForecast } from "@/lib/liveWeather";
import type { ScoutPick } from "@/lib/terrainMovementData";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

const property = {
  id: "p1",
  name: "Ridge",
  county: "Tioga",
  acres: "80",
  notes: "",
} as unknown as Property;

function stand(id: string, name: string, sourcePinId?: string): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds: "NW",
    avoidWinds: "S",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    sourcePinId,
  };
}

const pin: MapPin = {
  id: "pin1",
  propertyId: "p1",
  type: "Stand",
  lat: 41.4,
  lng: -78.3,
  createdAt: "",
  name: "Ridge Ladder",
  notes: "",
};

const cam: Camera = {
  id: "c1",
  propertyId: "p1",
  name: "Saddle Cam",
  cameraType: "Standard",
  manufacturer: "",
  model: "",
  status: "Active",
  latitude: 41.401,
  longitude: -78.3,
  locationNotes: "",
  notes: "",
};

function profile(id: string, status: DeerProfile["status"], lastSeen: string): DeerProfile {
  return {
    id,
    propertyId: "p1",
    nickname: id,
    estimatedAge: "",
    firstSeen: "",
    lastSeen,
    notes: "",
    status,
  };
}

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  return {
    id: Math.random().toString(36),
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge Ladder",
    date: "2026-11-01",
    startTime: "",
    endTime: "",
    windDirection: "NW",
    windSpeed: "8",
    temperature: "40",
    weather: "",
    moonPhase: "",
    weatherSnapshot: snapshot,
    bucks: 0,
    does: 0,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes: "",
    ...overrides,
  };
}

function scoutPick(id: string, kind: ScoutPick["kind"], windNote: string, lat = 41.4012): ScoutPick {
  return { id, kind, title: `${kind} ${id}`, reason: "r", windNote, point: [lat, -78.3], rank: 1 };
}

function build(overrides: Partial<Parameters<typeof buildAiScoutRequestContext>[0]> = {}) {
  return buildAiScoutRequestContext({
    property,
    stands: [stand("s1", "Ridge Ladder", "pin1"), stand("s2", "Creek Bottom")],
    cameras: [cam],
    cameraChecks: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    conditions: EMPTY_AI_SCOUT_CONDITIONS,
    pins: [pin],
    ...overrides,
  });
}

describe("buildAiScoutRequestContext", () => {
  it("gives located stands their nearby cameras and terrain, and flags the rest", () => {
    const context = build({
      scoutPicks: [scoutPick("a", "pinch", "Sit the downhill side on a crosswind.")],
    });
    const [ridge, creek] = context.stands;
    expect(ridge.located).toBe(true);
    expect(ridge.nearestCameras?.[0].name).toBe("Saddle Cam");
    expect(ridge.nearbyTerrain?.[0].title).toBe("pinch a");
    expect(creek.located).toBe(false);
    expect(creek.nearestCameras).toBeUndefined();
  });

  it("sends bedding wind as deerBedOnWind, never bestWind", () => {
    const context = build({
      scoutPicks: [
        scoutPick(
          "b",
          "bedding",
          "Deer bed here on a NNW wind (wind at their back, eyes downhill). Don't come in from above — hunt the exit trail on a crosswind.",
        ),
      ],
    });
    const bed = context.terrainPicks[0];
    expect(bed.deerBedOnWind).toBe("NNW");
    expect(JSON.stringify(context)).not.toMatch(/bestWind"/);
  });

  it("caps terrain picks", () => {
    const many = Array.from({ length: 60 }, (_, k) => scoutPick(`b${k}`, "bedding", ""));
    expect(build({ scoutPicks: many }).terrainPicks).toHaveLength(4);
  });

  it("sends only active bucks, most recently seen first", () => {
    const context = build({
      deerProfiles: [
        profile("old", "active", "2025-10-01"),
        profile("tagged", "harvested", "2026-11-05"),
        profile("retired", "retired", "2026-11-01"),
        profile("fresh", undefined, "2026-11-07"),
      ],
    });
    expect(context.deerProfiles.map((p) => p.nickname)).toEqual(["fresh", "old"]);
  });

  it("tags each hunt with its times and sit, and skips blood trails", () => {
    const context = build({
      hunts: [
        hunt({ date: "2026-11-02", startTime: "06:10", endTime: "09:30" }),
        hunt({ date: "2026-11-03", startTime: "15:00", endTime: "17:30" }),
        hunt({ date: "2026-11-04", kind: "blood-trail" }),
      ],
    });
    expect(context.recentHunts).toHaveLength(2);
    expect(context.recentHunts[0].sit).toBe("evening");
    expect(context.recentHunts[1].startTime).toBe("06:10");
    expect(context.recentHunts[1].endTime).toBe("09:30");
    expect(context.recentHunts[1].sit).toBe("morning");
  });
});

describe("helpers", () => {
  it("reads the deer's bed wind from new and old notes", () => {
    expect(deerBedOnWind("Beds hold a NE wind. Approach from the ridge above.")).toBe("NE");
    expect(deerBedOnWind("Deer bed here on a SW wind (wind at their back)")).toBe("SW");
    expect(deerBedOnWind("Sit the downhill side")).toBeUndefined();
  });

  it("tags sits by start time", () => {
    expect(sitOfDay("05:45")).toBe("morning");
    expect(sitOfDay("12:30")).toBe("midday");
    expect(sitOfDay("16:00")).toBe("evening");
    expect(sitOfDay("")).toBe("");
  });

  it("adds a temperature unit only to bare numbers", () => {
    expect(withTemperatureUnit("41", "°F")).toBe("41°F");
    expect(withTemperatureUnit("41°F", "°C")).toBe("41°F");
    expect(withTemperatureUnit("", "°F")).toBe("");
  });

  it("formats today with its weekday", () => {
    expect(aiScoutToday(new Date(2026, 10, 9, 8))).toBe("2026-11-09 (Mon)");
  });
});

describe("buildAiScoutTargetSit", () => {
  const forecast = {
    current: { temperature: "38", windDirection: "W", windSpeed: "5 mph", weather: "", moonPhase: "" },
    sunrise: "",
    sunset: "",
    days: [
      { date: "2026-11-09", label: "", high: "48", low: "31", conditions: "", wind: "" },
      { date: "2026-11-10", label: "", high: "44", low: "29", conditions: "", wind: "" },
    ],
  } as LiveForecast;

  it("describes tomorrow morning's sit with that day's numbers and light", () => {
    const sit = buildAiScoutTargetSit({
      verdict: {
        period: "tomorrow",
        periodLabel: "Tomorrow morning",
        wind: "NW",
        windSpeed: "9 mph",
        calm: false,
        daylight: {
          progress: 0,
          label: "",
          sunriseLabel: "6:58 AM",
          sunsetLabel: "4:56 PM",
          legalStartLabel: "6:28 AM",
          legalEndLabel: "5:26 PM",
          isDark: true,
        },
      },
      forecast,
      temperatureUnitLabel: "°F",
    });
    expect(sit).toEqual({
      period: "morning",
      day: "tomorrow",
      label: "Tomorrow morning",
      date: "2026-11-10",
      forecastWind: "NW",
      forecastWindSpeed: "9 mph",
      dayHigh: "44°F",
      dayLow: "29°F",
      sunrise: "6:58 AM",
      sunset: "4:56 PM",
      legalStart: "6:28 AM",
      legalEnd: "5:26 PM",
    });
  });

  it("carries rut phase and countdown", () => {
    expect(
      buildAiScoutSeason({ phaseLabel: "Seeking", phaseHint: "", daysToPeak: 6, peakIsCustom: false }),
    ).toEqual({ rutPhase: "Seeking", daysToPeak: 6, peakIsEstimate: true });
  });
});
