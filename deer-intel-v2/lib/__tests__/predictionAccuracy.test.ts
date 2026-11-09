import { describe, expect, it } from "vitest";
import { outlookIntensity } from "@/lib/deerHeat";
import { getHuntPlannerIntelligence } from "@/lib/huntPlannerIntelligence";
import { corridorEvidence, photoSunResolver, propertyMovementSignal } from "@/lib/movementPrediction";
import { getPropertyIntelligenceCards } from "@/lib/propertyIntelligence";
import { buildSightingHeat } from "@/lib/sightingHeat";
import type { StatsContext } from "@/lib/standStats";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

function stand(id: string, name: string, extra: Partial<Stand> = {}): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...extra,
  };
}

function pin(id: string, name: string, lat: number, lng: number): MapPin {
  return { id, propertyId: "p1", type: "Stand", lat, lng, createdAt: "", name, notes: "" };
}

function camera(id: string, lat?: number, lng?: number): Camera {
  return {
    id,
    propertyId: "p1",
    name: `Cam ${id}`,
    cameraType: "Standard",
    manufacturer: "",
    model: "",
    status: "Active",
    latitude: lat,
    longitude: lng,
    locationNotes: "",
    notes: "",
  };
}

function hunt(standId: string, standName: string, deer: number, extra: Partial<HuntLogEntry> = {}): HuntLogEntry {
  return {
    id: Math.random().toString(36),
    propertyId: "p1",
    standId,
    standName,
    date: "2026-10-20",
    startTime: "06:00",
    endTime: "09:00",
    windDirection: "",
    windSpeed: "",
    temperature: "",
    weather: "",
    moonPhase: "",
    weatherSnapshot: snapshot,
    bucks: 0,
    does: deer,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes: "",
    ...extra,
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

function photo(id: string, cameraSiteId: string, photoDate: string, species = "Doe"): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId,
    cameraCheckId: "",
    fileName: "",
    photoDate,
    species,
    notes: "",
    createdAt: "",
  };
}

describe("outlookIntensity", () => {
  it("maps the 1-5 rating the map passes onto 0.55-1", () => {
    expect(outlookIntensity(1)).toBeCloseTo(0.55, 5);
    expect(outlookIntensity(5)).toBeCloseTo(1, 5);
    expect(outlookIntensity(3)).toBeGreaterThan(outlookIntensity(2));
    expect(outlookIntensity(4)).toBeLessThan(1);
    expect(outlookIntensity(null)).toBe(0.85);
  });
});

describe("photo sun times", () => {
  it("bins an old photo against its own day's sunrise, not today's", () => {
    // Today (Nov 9) sunrise 6:55 AM; an Aug 20 photo at 6:40 AM is dawn
    // there (sunrise ~6:30 EDT), but would read as "night" against Nov.
    const sunFor = (dateKey: string) =>
      dateKey.startsWith("2026-08") ? { sunrise: 390, sunset: 1190 } : { sunrise: 415, sunset: 1015 };
    const resolve = photoSunResolver("6:55 AM", "4:55 PM", sunFor);
    expect(resolve(new Date(2026, 7, 20, 6, 40).getTime()).sunriseMin).toBe(390);
    expect(resolve(new Date(2026, 10, 9, 7, 0).getTime()).sunriseMin).toBe(415);

    const photos = Array.from({ length: 10 }, (_, k) => ({
      photoDate: `2026-08-${String(10 + k).padStart(2, "0")}T06:40`,
      species: "Doe",
      captureTimeSource: "exif" as const,
    }));
    const signal = propertyMovementSignal(photos, "dawn", "6:55 AM", "4:55 PM", sunFor);
    expect(signal.ratio).toBeGreaterThan(1);
  });

  it("falls back to a calibrated model without a sunFor", () => {
    const resolve = photoSunResolver("2026-11-09T06:55", "2026-11-09T16:55");
    const nov = resolve(new Date(2026, 10, 9, 12).getTime());
    const aug = resolve(new Date(2026, 7, 20, 12).getTime());
    // Calibrated to today's real times...
    expect(Math.abs(nov.sunriseMin - (6 * 60 + 55))).toBeLessThanOrEqual(1);
    // ...and a long summer day on the old date.
    expect(aug.sunsetMin - aug.sunriseMin).toBeGreaterThan(nov.sunsetMin - nov.sunriseMin + 90);
  });

  it("corridorEvidence accepts per-date sun times", () => {
    const evidence = corridorEvidence([], [], [], "dawn", "6:55 AM", "4:55 PM", 300, () => null);
    expect(evidence).toEqual({});
  });
});

describe("sighting heat normalization", () => {
  const ctx: StatsContext = { sunFor: () => ({ sunrise: 390, sunset: 1080 }), phaseFor: () => null };

  it("ranks stands per sit, not by total deer", () => {
    const busy = stand("s1", "Busy", { sourcePinId: "p-busy" });
    const good = stand("s2", "Good", { sourcePinId: "p-good" });
    const spots = buildSightingHeat(
      {
        stands: [busy, good],
        pins: [pin("p-busy", "Busy", 41.4, -78.3), pin("p-good", "Good", 41.41, -78.3)],
        hunts: [
          ...Array.from({ length: 10 }, () => hunt("s1", "Busy", 1)),
          hunt("s2", "Good", 4),
          hunt("s2", "Good", 4),
        ],
        cameras: [],
        cameraChecks: [],
        photos: [],
      },
      { time: "all", phase: "all", weight: "deer" },
      ctx,
    );
    expect(spots[0].name).toBe("Good");
    expect(spots[0].intensity).toBe(1);
    expect(spots[1].intensity).toBeCloseTo(0.25, 5);
  });

  it("collapses a photo burst into one camera visit", () => {
    const timed = (id: string, at: string, species = "Doe") => ({
      ...photo(id, "c1", at, species),
      captureTimeSource: "exif" as const,
    });
    const spots = buildSightingHeat(
      {
        stands: [],
        pins: [],
        hunts: [],
        cameras: [camera("c1", 41.4, -78.3)],
        cameraChecks: [],
        photos: [
          timed("a", "2026-10-20T07:00"),
          timed("b", "2026-10-20T07:01", "Buck"),
          timed("c", "2026-10-20T07:05"),
          timed("d", "2026-10-20T18:00"),
        ],
      },
      { time: "all", phase: "all", weight: "deer" },
      ctx,
    );
    expect(spots[0].observations).toBe(2);
    expect(spots[0].bucks).toBe(1);
    expect(spots[0].deer).toBe(2);
  });
});

describe("property intelligence cards", () => {
  const base = {
    cameras: [] as Camera[],
    cameraChecks: [] as CameraCheck[],
    hunts: [] as HuntLogEntry[],
    photoRecords: [] as PhotoRecord[],
    pins: [] as MapPin[],
    stands: [] as Stand[],
  };

  it("ranks Best Stands per sit with at least 2 sits", () => {
    const cards = getPropertyIntelligenceCards({
      ...base,
      stands: [stand("s1", "Busy"), stand("s2", "Good"), stand("s3", "Once")],
      hunts: [
        ...Array.from({ length: 10 }, () => hunt("s1", "Busy", 1)),
        hunt("s2", "Good", 4),
        hunt("s2", "Good", 4),
        hunt("s3", "Once", 20),
      ],
    });
    const best = cards.find((c) => c.title === "Best Stands");
    expect(best?.value).toBe("Good");
    expect(best?.description).toMatch(/4\.0 deer per sit over 2 sits/);
  });

  it("ranks Most Active Camera by deer counted, not by checks", () => {
    const cards = getPropertyIntelligenceCards({
      ...base,
      cameras: [camera("a"), camera("b")],
      cameraChecks: [
        ...Array.from({ length: 6 }, (_, k) => check("a", `2026-10-0${k + 1}`, 0, 0)),
        check("b", "2026-10-02", 2, 5),
      ],
    });
    expect(cards.find((c) => c.title === "Most Active Camera Sites")?.value).toBe("Cam b");
  });
});

describe("hunt planner", () => {
  const property = { id: "p1", name: "Ridge" } as unknown as Property;
  const now = new Date(2026, 10, 9, 12);

  it("scores stands against the sit's wind and links camera activity by distance", () => {
    const nw = stand("s1", "NW Stand", { bestWinds: "NW", avoidWinds: "SE", sourcePinId: "pa" });
    const se = stand("s2", "SE Stand", { bestWinds: "SE", avoidWinds: "NW", sourcePinId: "pb" });
    const result = getHuntPlannerIntelligence({
      property,
      stands: [nw, se],
      cameras: [camera("near", 41.4005, -78.3)],
      cameraChecks: [check("near", "2026-11-07", 1, 2)],
      deerProfiles: [],
      hunts: [],
      photoRecords: [],
      pins: [pin("pa", "NW Stand", 41.4, -78.3), pin("pb", "SE Stand", 41.45, -78.3)],
      now,
      sitWind: "NW",
      sitWindSpeed: "8 mph",
    });
    const [top, second] = result.bestStandCandidates;
    expect(top.title).toBe("NW Stand");
    expect(top.reasons.join(" ")).toMatch(/Good wind \(NW\) for the next sit/);
    expect(top.reasons.join(" ")).toMatch(/Deer on Cam near/);
    expect(second.reasons.join(" ")).toMatch(/Wrong wind/);
    expect(second.reasons.join(" ")).not.toMatch(/Deer on/);
    expect(result.standsWithRecentCameraActivity.map((s) => s.title)).toEqual(["NW Stand"]);
  });

  it("gives no wind points without the sit's forecast", () => {
    const result = getHuntPlannerIntelligence({
      property,
      stands: [stand("s1", "NW Stand", { bestWinds: "NW" })],
      cameras: [],
      cameraChecks: [],
      deerProfiles: [],
      hunts: [],
      photoRecords: [],
      pins: [],
      now,
    });
    expect(result.bestStandCandidates[0].reasons.join(" ")).toMatch(/wind not loaded/);
    expect(result.standsWithRecentCameraActivity).toHaveLength(0);
  });
});
