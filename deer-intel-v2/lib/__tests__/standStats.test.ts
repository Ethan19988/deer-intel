import { describe, expect, it } from "vitest";
import {
  aggregateSits,
  buildPropertyStandStats,
  buildStandStats,
  classifySit,
  huntWindBucket,
  legalHours,
  MIN_SITS_TO_CALL,
  pickBest,
  sampleLabel,
  sunTimesFor,
  toWind8,
  type StatsContext,
  type SunTimes,
} from "@/lib/standStats";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

// Fixed sun (6:30 AM / 6:00 PM) and a fixed phase so the tests never depend on
// the device clock, timezone or season calendar.
const SUN: SunTimes = { sunrise: 390, sunset: 1080 };
const ctx: StatsContext = {
  sunFor: () => SUN,
  phaseFor: (date) => (date >= "2025-11-01" ? "chasing" : "pre-rut"),
};

function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge",
    date: "2025-10-20",
    startTime: "06:00",
    endTime: "09:30",
    windDirection: "NW",
    windSpeed: "8 mph",
    temperature: "40",
    weather: "Clear",
    moonPhase: "Full",
    weatherSnapshot: {
      temperature: "",
      windDirection: "",
      windSpeed: "",
      conditions: "",
      moonPhase: "",
      source: "manual",
    },
    bucks: 0,
    does: 0,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes: "",
    ...overrides,
  };
}

const stand = (id: string, name: string): Stand => ({
  id,
  propertyId: "p1",
  name,
  standType: "Ladder",
  bestWinds: "",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
});

describe("toWind8 / huntWindBucket", () => {
  it("groups 16-wind points onto 8", () => {
    expect(toWind8("NW")).toBe("NW");
    expect(toWind8("NNW")).toBe("N"); // 337.5 rounds to N
    expect(toWind8("WNW")).toBe("NW"); // 292.5 rounds up to NW
    expect(toWind8("SW 8 mph")).toBe("SW");
    expect(toWind8("225")).toBe("SW");
    expect(toWind8("")).toBeNull();
    expect(toWind8("calm")).toBeNull();
  });

  it("reads calm sits as Calm and falls back to the weather snapshot", () => {
    expect(huntWindBucket(hunt({ windSpeed: "2 mph" }))).toBe("Calm");
    expect(
      huntWindBucket(
        hunt({
          windDirection: "",
          weatherSnapshot: {
            temperature: "",
            windDirection: "S",
            windSpeed: "6 mph",
            conditions: "",
            moonPhase: "",
            source: "live",
          },
        }),
      ),
    ).toBe("S");
  });
});

describe("classifySit", () => {
  it("splits morning, evening and all-day around solar noon", () => {
    expect(classifySit(360, 570, SUN)).toBe("morning");
    expect(classifySit(900, 1110, SUN)).toBe("evening");
    expect(classifySit(360, 1110, SUN)).toBe("all-day");
    // No end time: a dawn start reads as a morning sit
    expect(classifySit(360, null, SUN)).toBe("morning");
    expect(classifySit(null, 600, SUN)).toBeNull();
  });
});

describe("legalHours", () => {
  it("clips a sit to legal light", () => {
    // 5:00 to 9:00 → legal starts 6:00 → 3 h
    expect(legalHours(300, 540, SUN)).toBe(3);
    // 4:00 PM to 7:30 PM → legal ends 6:30 PM → 2.5 h
    expect(legalHours(960, 1170, SUN)).toBe(2.5);
    expect(legalHours(null, 540, SUN)).toBeNull();
  });
});

describe("sunTimesFor", () => {
  it("gives sensible PA sunrise / sunset in EST", () => {
    // State College, Nov 15: sunrise ~6:59 AM, sunset ~4:58 PM EST.
    const sun = sunTimesFor("2025-11-15", 40.79, -77.86, 300)!;
    expect(sun.sunrise).toBeGreaterThan(405);
    expect(sun.sunrise).toBeLessThan(435);
    expect(sun.sunset).toBeGreaterThan(995);
    expect(sun.sunset).toBeLessThan(1035);
  });
});

describe("aggregateSits + sample honesty", () => {
  it("labels small samples as too few to call", () => {
    expect(sampleLabel(0)).toBe("No sits logged");
    expect(sampleLabel(3)).toBe("3 sits — too few to call");
    expect(sampleLabel(1)).toBe("1 sit — too few to call");
    expect(sampleLabel(MIN_SITS_TO_CALL)).toContain("early read");
    expect(sampleLabel(20)).toContain("solid");
  });

  it("totals sits, hours, deer, shots and harvests", () => {
    const stats = buildStandStats(
      stand("s1", "Ridge"),
      [
        hunt({ bucks: 1, does: 2, shotOpportunity: true }),
        hunt({ does: 1, fawns: 1, harvest: true }),
        hunt({ standId: "other", bucks: 5 }),
      ],
      ctx,
    );
    expect(stats.overall.sits).toBe(2);
    expect(stats.overall.deer).toBe(5);
    expect(stats.overall.bucks).toBe(1);
    expect(stats.overall.shots).toBe(1);
    expect(stats.overall.harvests).toBe(1);
    expect(stats.overall.deerPerSit).toBe(2.5);
    // 6:00–9:30 each = 3.5 h (legal starts 6:00)
    expect(stats.overall.hours).toBe(7);
    expect(stats.overall.enough).toBe(false);
    expect(stats.bestWind).toBeNull();
  });

  it("aggregates an empty list without dividing by zero", () => {
    const agg = aggregateSits([]);
    expect(agg.deerPerSit).toBe(0);
    expect(agg.sampleLabel).toBe("No sits logged");
  });
});

describe("best wind / time", () => {
  const hunts = [
    ...Array.from({ length: 4 }, () => hunt({ windDirection: "NW", does: 3, bucks: 1 })),
    ...Array.from({ length: 3 }, () =>
      hunt({ windDirection: "S", startTime: "15:00", endTime: "18:30", does: 0 }),
    ),
  ];

  it("names the best wind and time once the sample is enough", () => {
    const stats = buildStandStats(stand("s1", "Ridge"), hunts, ctx);
    expect(stats.overall.sits).toBe(7);
    expect(stats.bestWind?.key).toBe("NW");
    expect(stats.bestWind?.lift).toBeGreaterThan(1);
    expect(stats.bestTime?.key).toBe("morning");
    expect(stats.byWind.map((b) => b.key)).toEqual(["S", "NW"]);
  });

  it("does not crown a bucket without a qualified rival", () => {
    const fewRivals = [
      ...Array.from({ length: 5 }, () => hunt({ windDirection: "NW", does: 2 })),
      hunt({ windDirection: "S" }),
    ];
    const stats = buildStandStats(stand("s1", "Ridge"), fewRivals, ctx);
    expect(stats.overall.enough).toBe(true);
    expect(stats.bestWind).toBeNull();
  });

  it("returns null when the winner saw nothing", () => {
    const blank = Array.from({ length: 6 }, (_, i) =>
      hunt({ windDirection: i % 2 ? "N" : "S" }),
    );
    const stats = buildStandStats(stand("s1", "Ridge"), blank, ctx);
    expect(pickBest(stats.byWind, stats.overall)).toBeNull();
  });

  it("buckets by rut phase", () => {
    const stats = buildStandStats(
      stand("s1", "Ridge"),
      [hunt({ date: "2025-10-10" }), hunt({ date: "2025-11-05", bucks: 2 })],
      ctx,
    );
    expect(stats.byPhase.map((b) => b.key)).toEqual(["pre-rut", "chasing"]);
  });
});

describe("buildPropertyStandStats", () => {
  it("rolls up the property and keeps stands with no sits", () => {
    const result = buildPropertyStandStats(
      [stand("s1", "Ridge"), stand("s2", "Creek")],
      [hunt({ does: 2 }), hunt({ standId: "", standName: "Old oak", does: 1 })],
      ctx,
    );
    expect(result.property.overall.sits).toBe(2);
    expect(result.stands.map((s) => s.standName)).toEqual(["Old oak", "Ridge", "Creek"]);
    expect(result.stands.find((s) => s.standName === "Creek")?.overall.sits).toBe(0);
  });
});
