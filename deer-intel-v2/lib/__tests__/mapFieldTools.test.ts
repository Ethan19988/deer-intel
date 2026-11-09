import { describe, expect, it } from "vitest";
import { routeLegScent, sampleLeg, scentHitAt } from "@/lib/accessScent";
import { buildBloodTrailHunt, nearestStandTo } from "@/lib/bloodTrailHunt";
import {
  edgeAlertLabel,
  formatGuideDistance,
  guideReading,
  nextEdgeAlert,
} from "@/lib/fieldGuide";
import { distanceToPolygonEdgeMeters } from "@/lib/geofence";
import { legalLightChip, shortDuration } from "@/lib/legalLight";
import {
  forecastSlotLabel,
  halfHourClock,
  playsForWind,
  sitPlayLabel,
  standAssetIds,
  standsByPinId,
} from "@/lib/mapPlay";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// ~0.001° latitude ≈ 111 m; near 41.5°N, 0.001° longitude ≈ 83 m.
const BASE = { lat: 41.5, lng: -77.5 };
const at = (dLat: number, dLng: number) => ({ lat: BASE.lat + dLat, lng: BASE.lng + dLng });

function pin(id: string, type: PinType, dLat: number, dLng: number, name = id): MapPin {
  return { id, propertyId: "p1", type, ...at(dLat, dLng), createdAt: "", name, notes: "" };
}

function stand(id: string, name: string, extra: Partial<Stand> = {}): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Hang-on",
    bestWinds: "NW",
    avoidWinds: "SE",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...extra,
  };
}

describe("access route scent (shared sampler)", () => {
  const bed = pin("bed", "Bedding", -0.0025, 0.003, "Laurel bench");
  const route = [at(-0.005, 0), at(0, 0)];

  it("flags a leg whose middle blows into bedding even when both taps are clear", () => {
    const scent = routeLegScent(route, [bed], "W");
    expect(scent).not.toBeNull();
    expect(scent!.vertices).toEqual([null, null]);
    expect(scent!.legs[0]?.kind).toBe("scent");
  });

  it("is clear on an upwind leg and unknown without a wind", () => {
    expect(routeLegScent(route, [bed], "E")!.legs).toEqual([null]);
    expect(routeLegScent(route, [bed], undefined)).toBeNull();
  });

  it("bumps bedding within 60 m whatever the wind, unless told not to", () => {
    const close = pin("close", "Bedding", 0.0003, 0);
    expect(scentHitAt(at(0, 0), [close], 0)?.kind).toBe("bump");
    expect(scentHitAt(at(0, 0), [close], 90, { bump: false })).toBeNull();
  });

  it("samples a leg every ~40 m, stopping short of the end", () => {
    const points = sampleLeg(at(0, 0), at(0.002, 0)); // ~222 m
    expect(points).toHaveLength(6);
    expect(points[0]).toEqual(at(0, 0));
  });
});

describe("distanceToPolygonEdgeMeters", () => {
  const square = [at(-0.001, -0.002), at(0.001, -0.002), at(0.001, 0.002), at(-0.001, 0.002)];

  it("measures to the nearest edge from inside and outside", () => {
    expect(distanceToPolygonEdgeMeters(BASE.lat, BASE.lng, square)).toBeCloseTo(111.2, 0);
    const outside = at(0.0015, 0);
    expect(distanceToPolygonEdgeMeters(outside.lat, outside.lng, square)).toBeCloseTo(55.6, 0);
  });

  it("is null for an invalid outline", () => {
    expect(distanceToPolygonEdgeMeters(BASE.lat, BASE.lng, [at(0, 0)])).toBeNull();
  });
});

describe("guide me", () => {
  it("formats yards under 1000 and miles beyond", () => {
    expect(formatGuideDistance(50)).toBe("55 yd");
    expect(formatGuideDistance(400)).toBe("440 yd");
    expect(formatGuideDistance(1097.28)).toBe("0.7 mi");
    expect(formatGuideDistance(20000)).toBe("12 mi");
  });

  it("gives bearing text and a heading-relative arrow", () => {
    const reading = guideReading(at(0, 0), at(0.001, 0), 90);
    expect(reading.bearing).toBe(0);
    expect(reading.headText).toBe("Head N (0°)");
    expect(reading.arrowRotation).toBe(270);
    expect(reading.distanceLabel).toBe("120 yd");
    expect(reading.arrived).toBe(false);
    expect(guideReading(at(0, 0), at(0.001, 0), null).arrowRotation).toBeNull();
  });

  it("arrives within 15 yd", () => {
    expect(guideReading(at(0, 0), at(0.0001, 0), null).arrived).toBe(true);
  });
});

describe("hunt-area edge alert", () => {
  const inside = (meters: number) => ({ inside: true, edgeMeters: meters });

  it("buzzes once on the approach and holds through the hysteresis band", () => {
    expect(nextEdgeAlert("clear", inside(40))).toEqual({ state: "near", buzz: true });
    expect(nextEdgeAlert("near", inside(40))).toEqual({ state: "near", buzz: false });
    expect(nextEdgeAlert("near", inside(55))).toEqual({ state: "near", buzz: false });
    expect(nextEdgeAlert("near", inside(70))).toEqual({ state: "clear", buzz: false });
    expect(nextEdgeAlert("clear", inside(55))).toEqual({ state: "clear", buzz: false });
  });

  it("buzzes on stepping out, not on starting out or coming back", () => {
    expect(nextEdgeAlert("near", { inside: false, edgeMeters: 5 })).toEqual({
      state: "outside",
      buzz: true,
    });
    expect(nextEdgeAlert("off", { inside: false, edgeMeters: 5 }).buzz).toBe(false);
    expect(nextEdgeAlert("outside", inside(20))).toEqual({ state: "near", buzz: false });
    expect(nextEdgeAlert("near", null)).toEqual({ state: "off", buzz: false });
  });

  it("labels the banner", () => {
    expect(edgeAlertLabel("near", 36.6)).toBe("Hunt area edge · 40 yd");
    expect(edgeAlertLabel("outside", null)).toBe("Outside your hunt area");
    expect(edgeAlertLabel("clear", 100)).toBeNull();
  });
});

describe("legalLightChip", () => {
  const sunrise = "2026-11-08T06:50";
  const sunset = "2026-11-08T16:50";
  const utc = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 8, h, m));

  it("counts down to legal light, shows the end, then counts down the end", () => {
    expect(legalLightChip(utc(6, 0), sunrise, sunset, 0)?.label).toBe("Legal light in 20m");
    // Newer ICU puts a narrow no-break space before AM/PM.
    expect(legalLightChip(utc(12), sunrise, sunset, 0)?.label.replace(/\u202f/g, " ")).toBe(
      "Legal now · ends 5:20 PM",
    );
    expect(legalLightChip(utc(16, 48), sunrise, sunset, 0)).toEqual({
      label: "Legal end in 32m",
      tone: "ending",
    });
  });

  it("rolls to tomorrow's legal light after dark", () => {
    expect(legalLightChip(utc(20), sunrise, sunset, 0)?.label).toBe("Legal light in 10h 20m");
  });

  it("formats short durations", () => {
    expect(shortDuration(580)).toBe("9h 40m");
    expect(shortDuration(120)).toBe("2h");
    expect(shortDuration(0.2)).toBe("1m");
  });
});

describe("map today's play", () => {
  it("labels the sit and forecast windows", () => {
    expect(sitPlayLabel("tomorrow", "WNW")).toBe("Tomorrow AM · WNW");
    expect(sitPlayLabel("evening", "SW", true)).toBe("Tonight · Calm");
    expect(
      forecastSlotLabel({ period: "dusk", dayIndex: 0, dayLabel: "TONIGHT" }, "6:50 AM", "5:30 PM"),
    ).toBe("Forecast · 5 PM");
    expect(
      forecastSlotLabel({ period: "dawn", dayIndex: 1, dayLabel: "THU" }, "6:50 AM", "5:30 PM"),
    ).toBe("Forecast · Thu 7:30 AM");
    expect(halfHourClock(0)).toBe("12 AM");
    expect(halfHourClock(750)).toBe("12:30 PM");
  });

  it("links a renamed stand to its pin through sourcePinId", () => {
    const renamed = stand("s1", "Old name", { sourcePinId: "p9" });
    const pins = [pin("p9", "Stand", 0, 0, "New name")];
    const assets = [{ id: "pin-p9", pinId: "p9" }];

    expect(standAssetIds([renamed], pins, assets).get("s1")).toBe("pin-p9");
    expect(standsByPinId([renamed], pins).get("p9")?.id).toBe("s1");
  });

  it("ranks a forecast wind good first", () => {
    const plays = playsForWind(
      [stand("a", "Avoid me", { bestWinds: "N", avoidWinds: "NW" }), stand("b", "Good one")],
      "NW",
      new Map(),
    );
    expect(plays.map((play) => play.id)).toEqual(["b", "a"]);
  });
});

describe("blood trail → hunt log", () => {
  const near = stand("near", "Creek", { sourcePinId: "pinNear" });
  const far = stand("far", "Ridge", { sourcePinId: "pinFar" });
  const pins = [pin("pinNear", "Stand", 0.0005, 0), pin("pinFar", "Stand", 0.01, 0)];
  const marks = [at(0, 0), at(0.001, 0.001)];

  it("files under the stand nearest the hit site", () => {
    expect(nearestStandTo(marks[0], [far, near], pins)?.stand.id).toBe("near");
    expect(nearestStandTo(marks[0], [], pins)).toBeNull();
    // One stand that isn't on the map still works.
    expect(nearestStandTo(marks[0], [stand("solo", "Solo")], [])?.stand.id).toBe("solo");
  });

  it("builds a valid hunt with recovery notes", () => {
    const result = buildBloodTrailHunt({
      id: "h1",
      propertyId: "p1",
      stands: [far, near],
      pins,
      summary: { marks, trailMeters: 180, recovered: true },
      startedAt: new Date(2026, 10, 8, 17, 40),
      endedAt: new Date(2026, 10, 8, 19, 5),
      windDirection: "NW",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hunt.standId).toBe("near");
    expect(result.hunt.date).toBe("2026-11-08");
    expect(result.hunt.startTime).toBe("17:40");
    expect(result.hunt.endTime).toBe("19:05");
    expect(result.hunt.harvest).toBe(true);
    expect(result.hunt.shotOpportunity).toBe(true);
    expect(result.hunt.notes).toContain("recovered: yes");
    expect(result.hunt.notes).toContain("Hit site: 41.50000, -77.50000");
    expect(result.hunt.notes).toContain("197 yd tracked");
    expect(result.hunt.notes).toMatch(/yd straight-line NE from the hit/);
  });

  it("explains instead of saving when there's no stand", () => {
    const result = buildBloodTrailHunt({
      id: "h2",
      propertyId: "p1",
      stands: [],
      pins: [],
      summary: { marks, trailMeters: 0, recovered: false },
      startedAt: new Date(),
      endedAt: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});
