import { describe, expect, it } from "vitest";
import { routeLegScent, sampleLeg, scentHitAt } from "@/lib/accessScent";
import { buildBloodTrailHunt, nearestStandTo } from "@/lib/bloodTrailHunt";
import {
  EDGE_TRACKER_OFF,
  edgeAlertLabel,
  formatGuideDistance,
  guideArriveMeters,
  guideReading,
  nextEdgeAlert,
  nextGuideArrival,
  type EdgeReading,
  type EdgeTracker,
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

  it("widens the arrival circle to the fix accuracy, capped at 20 m", () => {
    expect(guideArriveMeters(null)).toBeCloseTo(13.716, 2);
    expect(guideArriveMeters(5)).toBeCloseTo(13.716, 2);
    expect(guideArriveMeters(18)).toBe(18);
    expect(guideArriveMeters(60)).toBe(20);
    // ~17 m away: arrived on a ±18 m fix, not on a ±4 m one.
    const target = at(0.00015, 0);
    expect(guideReading({ ...at(0, 0), accuracy: 18 }, target, null).arrived).toBe(true);
    expect(guideReading({ ...at(0, 0), accuracy: 4 }, target, null).arrived).toBe(false);
  });

  it("flags a target inside the GPS accuracy", () => {
    const target = at(0.0002, 0); // ~22 m
    expect(guideReading({ ...at(0, 0), accuracy: 30 }, target, 0).withinAccuracy).toBe(true);
    expect(guideReading({ ...at(0, 0), accuracy: 5 }, target, 0).withinAccuracy).toBe(false);
    expect(guideReading(at(0, 0), target, 0).withinAccuracy).toBe(false);
  });

  it("ends guidance on two good fixes in a row, ignoring poor ones", () => {
    const inRange = { arrived: true };
    const outOfRange = { arrived: false };
    let step = nextGuideArrival(0, inRange, 8);
    expect(step).toEqual({ streak: 1, arrived: false });
    step = nextGuideArrival(step.streak, inRange, 50); // too loose: ignored
    expect(step).toEqual({ streak: 1, arrived: false });
    step = nextGuideArrival(step.streak, inRange, 8);
    expect(step).toEqual({ streak: 2, arrived: true });
    expect(nextGuideArrival(1, outOfRange, 8)).toEqual({ streak: 0, arrived: false });
  });
});

describe("hunt-area edge alert", () => {
  const inside = (meters: number, accuracy = 5) => ({ inside: true, edgeMeters: meters, accuracy });
  const outside = (meters: number, accuracy = 5) => ({ inside: false, edgeMeters: meters, accuracy });

  // Run a sequence of readings from "off" and collect state + buzz per step.
  function run(readings: Array<EdgeReading | null>, start: EdgeTracker = EDGE_TRACKER_OFF) {
    let tracker = start;
    return readings.map((reading) => {
      const next = nextEdgeAlert(tracker, reading);
      tracker = next.tracker;
      return [next.tracker.state, next.buzz] as const;
    });
  }

  it("buzzes once on the approach and holds through the hysteresis band", () => {
    expect(run([inside(100), inside(40), inside(40), inside(55), inside(70), inside(55)])).toEqual([
      ["clear", false],
      ["near", true],
      ["near", false],
      ["near", false],
      ["clear", false],
      ["clear", false],
    ]);
  });

  it("doesn't buzz when turned on next to the line (re-enable isn't an approach)", () => {
    expect(run([inside(30), inside(20)])).toEqual([
      ["near", false],
      ["near", false],
    ]);
    // ...but stepping out from there still warns.
    expect(run([inside(30), outside(25)])).toEqual([
      ["near", false],
      ["outside", true],
    ]);
    expect(run([outside(40), outside(60)])).toEqual([
      ["outside", false],
      ["outside", false],
    ]);
    expect(run([inside(30), null, inside(30)])).toEqual([
      ["near", false],
      ["off", false],
      ["near", false],
    ]);
  });

  it("needs a deep fix or two in a row to count as stepping out", () => {
    // 6 m out with ±8 m: one fix reads "near"; the second confirms it.
    expect(run([inside(100), inside(30), outside(6, 8), outside(6, 8)])).toEqual([
      ["clear", false],
      ["near", true],
      ["near", false],
      ["outside", true],
    ]);
    // Deeper than max(10 m, accuracy) confirms on one fix.
    expect(run([inside(100), inside(30), outside(15, 8)])).toEqual([
      ["clear", false],
      ["near", true],
      ["outside", true],
    ]);
  });

  it("doesn't re-buzz while jitter wobbles across the line", () => {
    const steps = run([
      inside(100),
      inside(30),
      outside(15),
      inside(3),
      outside(12),
      inside(2),
      outside(14),
      inside(40),
      inside(30),
    ]);
    expect(steps.filter(([, buzz]) => buzz)).toHaveLength(2); // approach + first step-out
    expect(steps.map(([state]) => state)).toEqual([
      "clear",
      "near",
      "outside",
      "near",
      "outside",
      "near",
      "outside",
      "near",
      "near",
    ]);
  });

  it("oscillating around the 50 yd line buzzes once until back in the clear", () => {
    const steps = run([inside(100), inside(44), inside(47), inside(44), inside(47), inside(44)]);
    expect(steps.filter(([, buzz]) => buzz)).toHaveLength(1);
    // Back in the clear re-arms it.
    const again = run([inside(100), inside(44), inside(80), inside(44)]);
    expect(again.filter(([, buzz]) => buzz)).toHaveLength(2);
  });

  it("ignores fixes worse than ±30 m and far-away fixes", () => {
    const near = nextEdgeAlert(EDGE_TRACKER_OFF, inside(100)).tracker;
    expect(nextEdgeAlert(near, outside(40, 45))).toEqual({ tracker: near, buzz: false });
    expect(nextEdgeAlert(near, outside(5000)).tracker.state).toBe("off");
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

  it("tags the entry as a blood trail", () => {
    const result = buildBloodTrailHunt({
      id: "h3",
      propertyId: "p1",
      stands: [near],
      pins,
      summary: { marks, trailMeters: 50, recovered: false },
      startedAt: new Date(2026, 10, 8, 17, 40),
      endedAt: new Date(2026, 10, 8, 18, 30),
    });
    expect(result.ok && result.hunt.kind).toBe("blood-trail");
  });

  it("keeps an overnight trail on its start date, ending 23:59, with real times in notes", () => {
    const result = buildBloodTrailHunt({
      id: "h4",
      propertyId: "p1",
      stands: [near],
      pins,
      summary: { marks, trailMeters: 180, recovered: true },
      startedAt: new Date(2026, 10, 8, 18, 50),
      endedAt: new Date(2026, 10, 9, 8, 10),
      recoveredAt: new Date(2026, 10, 9, 7, 45),
      windDirection: "SW",
      windSpeed: "6 mph",
      windAtSaveTime: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hunt.date).toBe("2026-11-08");
    expect(result.hunt.startTime).toBe("18:50");
    expect(result.hunt.endTime).toBe("23:59");
    expect(result.hunt.notes).toContain("Recovered: 2026-11-09 07:45");
    expect(result.hunt.notes).toContain("Trail started 2026-11-08 18:50, saved 2026-11-09 08:10");
    expect(result.hunt.notes).toContain("Wind: at save time");
  });

  it("leaves same-day times alone and skips the wind note with start wind", () => {
    const result = buildBloodTrailHunt({
      id: "h5",
      propertyId: "p1",
      stands: [near],
      pins,
      summary: { marks, trailMeters: 10, recovered: false },
      startedAt: new Date(2026, 10, 8, 17, 0),
      endedAt: new Date(2026, 10, 8, 19, 0),
      windDirection: "NW",
    });
    expect(result.ok && result.hunt.endTime).toBe("19:00");
    expect(result.ok && result.hunt.notes).not.toContain("Wind:");
    expect(result.ok && result.hunt.notes).not.toContain("Trail started");
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
