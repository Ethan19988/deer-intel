import { describe, expect, it } from "vitest";
import { buildSightingHeat, heatExtentPoints, heatSpotLine, type HeatInput } from "@/lib/sightingHeat";
import type { StatsContext, SunTimes } from "@/lib/standStats";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

const SUN: SunTimes = { sunrise: 390, sunset: 1080 };
const ctx: StatsContext = {
  sunFor: () => SUN,
  phaseFor: (date) => (date >= "2025-11-01" ? "chasing" : "pre-rut"),
};

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

const stand: Stand = {
  id: "s1",
  propertyId: "p1",
  name: "Ridge",
  standType: "Ladder",
  bestWinds: "",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
  sourcePinId: "pin1",
};

const pin: MapPin = {
  id: "pin1",
  propertyId: "p1",
  type: "Stand",
  lat: 41.5,
  lng: -77.5,
  createdAt: "",
  name: "Ridge",
  notes: "",
};

function camera(id: string, lat?: number): Camera {
  return {
    id,
    propertyId: "p1",
    name: `Cam ${id}`,
    cameraType: "Standard",
    manufacturer: "",
    model: "",
    status: "Active",
    latitude: lat,
    longitude: lat === undefined ? undefined : -77.51,
    locationNotes: "",
    notes: "",
  };
}

function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  return {
    id: Math.random().toString(36),
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge",
    date: "2025-10-20",
    startTime: "06:00",
    endTime: "09:00",
    windDirection: "NW",
    windSpeed: "8",
    temperature: "",
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

function photo(id: string, cameraSiteId: string, photoDate: string, species: string, buckName?: string): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId,
    cameraCheckId: "",
    fileName: "",
    photoDate,
    species,
    buckName,
    notes: "",
    createdAt: "",
  };
}

function check(cameraId: string, date: string, bucks: number, does: number): CameraCheck {
  return {
    id: Math.random().toString(36),
    propertyId: "p1",
    cameraId,
    date,
    batteryPercent: "",
    sdCardPercent: "",
    weatherSnapshot: snapshot,
    bucks,
    does,
    fawns: 0,
    turkeys: 0,
    bears: 0,
    coyotes: 0,
    otherWildlife: "",
    notes: "",
  };
}

const base: HeatInput = {
  stands: [stand],
  pins: [pin],
  hunts: [
    hunt({ does: 3, bucks: 1 }),
    hunt({ startTime: "15:00", endTime: "18:30", does: 1, date: "2025-11-05" }),
  ],
  cameras: [camera("c1", 41.51), camera("c2", 41.52), camera("c3")],
  cameraChecks: [check("c2", "2025-10-15", 2, 4), check("c1", "2025-10-15", 9, 9)],
  photos: [
    photo("p1", "c1", "2025-10-21T07:15", "Buck", "Big 8"),
    photo("p2", "c1", "2025-10-21T17:40", "Doe"),
    photo("p3", "c1", "2025-11-03T02:00", "Doe"),
    photo("p4", "c1", "2025-11-03T02:00", "Turkey"),
  ],
};

describe("buildSightingHeat", () => {
  it("places sits at the stand pin and camera hits at the site", () => {
    const spots = buildSightingHeat(base, { time: "all", phase: "all", weight: "deer" }, ctx);
    const standSpot = spots.find((s) => s.kind === "stand")!;
    expect(standSpot.lat).toBe(41.5);
    expect(standSpot.deer).toBe(5);
    expect(standSpot.observations).toBe(2);
    // c1 has photos, so its check tallies are ignored (no double count)
    const c1 = spots.find((s) => s.id === "camera:c1")!;
    expect(c1.deer).toBe(3);
    expect(c1.bucks).toBe(1);
    // c2 has no photos → falls back to the check
    const c2 = spots.find((s) => s.id === "camera:c2")!;
    expect(c2.deer).toBe(6);
    // c3 has no location
    expect(spots.some((s) => s.id === "camera:c3")).toBe(false);
    expect(Math.max(...spots.map((s) => s.intensity))).toBe(1);
  });

  it("filters by time of day and drops untimed checks", () => {
    const evening = buildSightingHeat(base, { time: "evening", phase: "all", weight: "deer" }, ctx);
    expect(evening.find((s) => s.kind === "stand")?.deer).toBe(1);
    expect(evening.find((s) => s.id === "camera:c1")?.deer).toBe(1);
    expect(evening.some((s) => s.id === "camera:c2")).toBe(false);
    const night = buildSightingHeat(base, { time: "night", phase: "all", weight: "deer" }, ctx);
    expect(night.map((s) => s.id)).toEqual(["camera:c1"]);
  });

  it("filters by rut phase and weights by bucks", () => {
    const chasing = buildSightingHeat(base, { time: "all", phase: "chasing", weight: "deer" }, ctx);
    expect(chasing.find((s) => s.kind === "stand")?.observations).toBe(1);
    const bucks = buildSightingHeat(base, { time: "all", phase: "all", weight: "bucks" }, ctx);
    // c2's check: 2 bucks; c1: 1 buck photo; stand: 1 buck
    expect(bucks[0].id).toBe("camera:c2");
    expect(bucks.every((s) => s.bucks > 0)).toBe(true);
  });

  it("honours a date range", () => {
    const spots = buildSightingHeat(
      base,
      { time: "all", phase: "all", weight: "deer", from: "2025-11-01", to: "2025-11-30" },
      ctx,
    );
    expect(spots.find((s) => s.kind === "stand")?.deer).toBe(1);
    expect(spots.some((s) => s.id === "camera:c2")).toBe(false);
  });

  it("counts date-only deer photos under any time, but not under a time filter", () => {
    const input: HeatInput = {
      ...base,
      hunts: [],
      cameras: [camera("c4", 41.53)],
      // c4 has photos, so this check is never counted on top of them.
      cameraChecks: [check("c4", "2025-10-15", 5, 5)],
      photos: [
        photo("d1", "c4", "2025-10-22", "Doe"),
        photo("d2", "c4", "2025-10-23", "Unknown", "Big 8"),
        photo("d3", "c4", "2025-10-24", "Turkey"),
        photo("d4", "c4", "2025-10-25T07:30", "Doe"),
      ],
    };
    const any = buildSightingHeat(input, { time: "all", phase: "all", weight: "deer" }, ctx);
    const c4 = any.find((s) => s.id === "camera:c4")!;
    expect(c4.observations).toBe(3);
    expect(c4.deer).toBe(3);
    expect(c4.bucks).toBe(1);
    const morning = buildSightingHeat(input, { time: "morning", phase: "all", weight: "deer" }, ctx);
    expect(morning.find((s) => s.id === "camera:c4")?.observations).toBe(1);
  });

  it("lists every located asset for the extent and phrases a popup line", () => {
    expect(heatExtentPoints(base)).toHaveLength(3);
    const [first] = buildSightingHeat(base, { time: "all", phase: "all", weight: "deer" }, ctx);
    expect(heatSpotLine(first)).toMatch(/deer/);
  });
});
