import { describe, expect, it } from "vitest";
import { buckSitPlanLine, buildBuckSitPlan, type BuckSitPlanInput } from "@/lib/buckSitPlan";
import { buildHitListSlides } from "@/lib/hitListSlides";
import type { ForecastDay } from "@/lib/liveWeather";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

const CAM = { lat: 41.0, lng: -77.0 };
// ~0.0009° of latitude ≈ 100 m.
const NORTH_100M = { lat: CAM.lat + 0.0009, lng: CAM.lng };
const FAR_2KM = { lat: CAM.lat + 0.018, lng: CAM.lng };

const profile: DeerProfile = {
  id: "king",
  propertyId: "p",
  nickname: "King",
  estimatedAge: "4.5",
  firstSeen: "",
  lastSeen: "",
  notes: "",
};

const camera: Camera = {
  id: "c1",
  propertyId: "p",
  name: "Creek Cam",
  cameraType: "Cellular",
  manufacturer: "",
  model: "",
  status: "Active",
  latitude: CAM.lat,
  longitude: CAM.lng,
  locationNotes: "",
  notes: "",
};

function photo(id: string, photoDate: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id,
    propertyId: "p",
    cameraSiteId: "c1",
    cameraCheckId: "",
    fileName: "",
    photoDate,
    species: "Deer (Antlered)",
    notes: "",
    createdAt: "",
    deerProfileIds: ["king"],
    captureTimeSource: "stamp",
    ...extra,
  };
}

// Evening visits on separate days (so none collapse into one visit).
const eveningPhotos = [
  photo("a", "2026-11-03T17:20"),
  photo("b", "2026-11-05T17:45"),
  photo("c", "2026-11-07T16:50"),
  photo("d", "2026-11-08T07:10"),
];

function standAt(
  id: string,
  name: string,
  at: { lat: number; lng: number },
  extra: Partial<Stand> = {},
): { stand: Stand; pin: MapPin } {
  return {
    stand: {
      id,
      propertyId: "p",
      name,
      standType: "Hang-on",
      bestWinds: "NW",
      avoidWinds: "SE",
      accessRouteNotes: "",
      exitRouteNotes: "",
      notes: "",
      sourcePinId: `pin-${id}`,
      ...extra,
    },
    pin: {
      id: `pin-${id}`,
      propertyId: "p",
      type: "Stand",
      lat: at.lat,
      lng: at.lng,
      createdAt: "",
      name,
      notes: "",
    },
  };
}

function day(date: string, label: string, morningWind: string, eveningWind = morningWind): ForecastDay {
  return { date, label, high: "", low: "", conditions: "", wind: morningWind, morningWind, eveningWind };
}

const nwDays = [
  day("2026-11-09", "Today", "NW 8 mph"),
  day("2026-11-10", "Tue", "NW 8 mph"),
  day("2026-11-11", "Wed", "NW 8 mph"),
];

const oak = standAt("oak", "Oak Flat", NORTH_100M);

function input(overrides: Partial<BuckSitPlanInput> = {}): BuckSitPlanInput {
  return {
    profile,
    photoRecords: eveningPhotos,
    hunts: [],
    cameras: [camera],
    stands: [oak.stand],
    pins: [oak.pin],
    forecastDays: nwDays,
    today: "2026-11-09",
    ...overrides,
  };
}

function sit(id: string, standId: string, date: string): HuntLogEntry {
  return { id, propertyId: "p", standId, standName: "", date, startTime: "16:00" } as HuntLogEntry;
}

describe("buildBuckSitPlan", () => {
  it("picks evening sits on the good-wind stand near his camera, with reasons", () => {
    const plan = buildBuckSitPlan(input());

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    const [best] = plan.picks;
    expect(best.sitLabel).toBe("Today PM");
    expect(best.standName).toBe("Oak Flat");
    expect(best.cameraName).toBe("Creek Cam");
    expect(best.yardsToCamera).toBeGreaterThanOrEqual(100);
    expect(best.yardsToCamera).toBeLessThanOrEqual(120);
    expect(best.reasons).toContain("NW wind fits this stand");
    expect(best.reasons.some((reason) => reason.startsWith("Usually evening"))).toBe(true);
    expect(best.reasons.some((reason) => reason.includes("from Creek Cam"))).toBe(true);
    expect(plan.picks.length).toBeLessThanOrEqual(3);
    // One pick per sit.
    expect(new Set(plan.picks.map((pick) => pick.sitKey)).size).toBe(plan.picks.length);
    // Evening sits outrank mornings for an evening buck.
    expect(plan.picks.every((pick) => pick.sitLabel.endsWith("PM"))).toBe(true);
  });

  it("says so when there are too few timed sightings", () => {
    const plan = buildBuckSitPlan(input({ photoRecords: [photo("a", "2026-11-07T17:20")] }));
    expect(plan.status).toBe("few-sightings");
  });

  it("ignores untrusted capture times when counting timed sightings", () => {
    const plan = buildBuckSitPlan(
      input({
        photoRecords: eveningPhotos.map((item) => ({ ...item, captureTimeSource: "file" as const })),
      }),
    );
    expect(plan.status).toBe("few-sightings");
  });

  it("needs a located stand within ~600 yd of his cameras", () => {
    const far = standAt("far", "Far Ridge", FAR_2KM);
    expect(buildBuckSitPlan(input({ stands: [far.stand], pins: [far.pin] })).status).toBe("no-stands");
    // A stand with no map pin can't be placed.
    expect(buildBuckSitPlan(input({ pins: [] })).status).toBe("no-stands");
    // Cameras without coordinates can't place him.
    const blind = { ...camera, latitude: undefined, longitude: undefined };
    expect(buildBuckSitPlan(input({ cameras: [blind] })).status).toBe("no-stands");
  });

  it("needs a forecast", () => {
    expect(buildBuckSitPlan(input({ forecastDays: [] })).status).toBe("no-forecast");
  });

  it("excludes a stand on the wrong wind", () => {
    const plan = buildBuckSitPlan(
      input({ forecastDays: [day("2026-11-09", "Today", "SE 8 mph"), day("2026-11-10", "Tue", "SE 8 mph")] }),
    );
    expect(plan.status).toBe("no-sits");
  });

  it("excludes a morning-only stand from evening sits", () => {
    const amOak = { ...oak.stand, bestTime: "am" as const };
    const plan = buildBuckSitPlan(input({ stands: [amOak] }));
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.picks.every((pick) => pick.sitLabel.endsWith("AM"))).toBe(true);
    // And the pick is honest that he's an evening buck.
    expect(plan.picks[0].cautions.some((caution) => caution.includes("evenings"))).toBe(true);
  });

  it("skips a burned stand and prefers a rested one", () => {
    const ridge = standAt("ridge", "Ridge", { lat: CAM.lat - 0.0009, lng: CAM.lng });
    const hunts = [sit("h1", "oak", "2026-11-08"), sit("h2", "oak", "2026-11-07"), sit("h3", "oak", "2026-11-06")];
    const plan = buildBuckSitPlan(
      input({
        stands: [oak.stand, ridge.stand],
        pins: [oak.pin, ridge.pin],
        hunts,
        forecastDays: [nwDays[0]],
      }),
    );
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.picks.every((pick) => pick.standName === "Ridge")).toBe(true);
  });

  it("skips sits that are already over", () => {
    const plan = buildBuckSitPlan(input({ nextSitKey: "2026-11-10-AM" }));
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.picks.some((pick) => pick.sitKey.startsWith("2026-11-09"))).toBe(false);
  });

  it("rewards a stand downwind of where he walks and flags scent blowing onto his trail", () => {
    const twoWay = { ...oak.stand, bestWinds: "N, S", avoidWinds: "" };
    const south = buildBuckSitPlan(
      input({ stands: [twoWay], forecastDays: [day("2026-11-09", "Today", "S 8 mph")] }),
    );
    const north = buildBuckSitPlan(
      input({ stands: [twoWay], forecastDays: [day("2026-11-09", "Today", "N 8 mph")] }),
    );
    expect(south.status).toBe("ready");
    expect(north.status).toBe("ready");
    if (south.status !== "ready" || north.status !== "ready") return;

    const southPm = south.picks.find((pick) => pick.sitLabel === "Today PM");
    const northPm = north.picks.find((pick) => pick.sitLabel === "Today PM");
    expect(southPm?.reasons).toContain("Stand is downwind of where he walks at Creek Cam");
    expect(northPm?.cautions.some((caution) => caution.includes("carries your scent toward Creek Cam"))).toBe(true);
    expect((southPm?.score ?? 0) > (northPm?.score ?? 0)).toBe(true);
    expect(northPm?.confidence).not.toBe("high");
  });

  it("counts his heading toward the stand when his photos agree on one", () => {
    const headed = eveningPhotos.map((item) => ({ ...item, travelDirection: "N" }));
    const plan = buildBuckSitPlan(input({ photoRecords: headed }));
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.picks[0].reasons).toContain("He usually heads N — toward this stand");
  });

  it("never claims more than a best bet in its line", () => {
    const plan = buildBuckSitPlan(input());
    expect(buckSitPlanLine(plan)).toBe("Best: Today PM · Oak Flat");
    expect(buckSitPlanLine(buildBuckSitPlan(input({ forecastDays: [] })))).toBeNull();
  });
});

describe("buildHitListSlides best sit", () => {
  const base = {
    propertyId: "p",
    propertyName: "Moore Hill",
    profiles: [profile],
    photos: eveningPhotos,
    cameras: [camera],
    cameraChecks: [],
    hunts: [],
    pins: [oak.pin],
  };

  it("adds the best-sit line when stands and the forecast are passed", () => {
    const slides = buildHitListSlides({ ...base, stands: [oak.stand], forecastDays: nwDays });
    expect(slides[0].bestSit).toBe("Best: Today PM · Oak Flat");
  });

  it("leaves it null without them", () => {
    expect(buildHitListSlides(base)[0].bestSit).toBeNull();
  });
});
