import { describe, expect, it } from "vitest";
import {
  availableSeasons,
  buildSeasonReport,
  inSeason,
  seasonWindow,
  seasonYearFor,
  type SeasonReportInput,
} from "@/lib/seasonReport";
import type { StatsContext, SunTimes } from "@/lib/standStats";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

const SUN: SunTimes = { sunrise: 390, sunset: 1080 };
const ctx: StatsContext = {
  sunFor: () => SUN,
  phaseFor: (date) =>
    date >= "2025-11-20" ? "post-rut" : date >= "2025-11-01" ? "chasing" : "pre-rut",
};

const snapshot = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  conditions: "",
  moonPhase: "",
  source: "manual" as const,
};

function stand(id: string, name: string, avoidWinds = ""): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds: "",
    avoidWinds,
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

let seq = 0;
function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  seq += 1;
  return {
    id: `h${seq}`,
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge",
    date: "2025-10-20",
    startTime: "06:00",
    endTime: "09:00",
    windDirection: "NW",
    windSpeed: "8 mph",
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

function photo(id: string, photoDate: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id,
    propertyId: "p1",
    cameraSiteId: "c1",
    cameraCheckId: "",
    fileName: "",
    photoDate,
    species: "Buck",
    notes: "",
    createdAt: "",
    ...extra,
  };
}

const profile: DeerProfile = {
  id: "d1",
  propertyId: "p1",
  nickname: "Big 8",
  estimatedAge: "4.5",
  firstSeen: "",
  lastSeen: "",
  notes: "",
};

describe("season window", () => {
  it("runs Sep 1 to Jan 31 and maps dates to their season", () => {
    const season = seasonWindow(2025);
    expect(season.label).toBe("2025–26");
    expect(inSeason("2025-09-01", season)).toBe(true);
    expect(inSeason("2026-01-31", season)).toBe(true);
    expect(inSeason("2026-02-01", season)).toBe(false);
    expect(inSeason("2025-08-31", season)).toBe(false);
    expect(seasonYearFor("2026-01-10")).toBe(2025);
    expect(seasonYearFor("2026-03-10")).toBe(2026);
  });

  it("lists seasons with data plus the current one, newest first", () => {
    const years = availableSeasons(
      { hunts: [hunt({ date: "2023-11-01" })], cameraChecks: [], photos: [] },
      new Date(2025, 10, 1),
    );
    expect(years).toEqual([2025, 2023]);
  });
});

describe("buildSeasonReport", () => {
  const input: SeasonReportInput = {
    stands: [stand("s1", "Ridge", "S"), stand("s2", "Creek"), stand("s3", "Oak flat")],
    hunts: [
      // Ridge: hammered, mediocre, twice on its avoid wind
      ...Array.from({ length: 6 }, () => hunt({ does: 1 })),
      hunt({ windDirection: "S" }),
      hunt({ windDirection: "S" }),
      // Creek: few sits, lots of deer, evenings
      ...Array.from({ length: 3 }, () =>
        hunt({
          standId: "s2",
          standName: "Creek",
          startTime: "15:00",
          endTime: "18:30",
          does: 4,
          bucks: 1,
          shotOpportunity: true,
        }),
      ),
      // Out of season — ignored
      hunt({ date: "2025-03-01", does: 50 }),
    ],
    cameras: [
      {
        id: "c1",
        propertyId: "p1",
        name: "Creek cam",
        cameraType: "Standard",
        manufacturer: "",
        model: "",
        status: "Active",
        locationNotes: "",
        notes: "",
      },
    ],
    cameraChecks: [],
    photos: [
      ...Array.from({ length: 6 }, (_, i) =>
        photo(`b${i}`, `2025-11-0${i + 1}T07:${10 + i}`, { deerProfileIds: ["d1"] }),
      ),
      photo("x", "2025-11-10T22:00", { buckName: "Split G2" }),
      photo("t", "2025-11-10T22:00", { species: "Turkey" }),
    ],
    deerProfiles: [profile],
  };
  const report = buildSeasonReport(input, 2025, ctx);

  it("summarizes the season only", () => {
    expect(report.summary.sits).toBe(11);
    expect(report.summary.deer).toBe(6 + 15);
    expect(report.summary.bucks).toBe(3);
    expect(report.summary.shots).toBe(3);
    expect(report.summary.deerPhotos).toBe(7);
    expect(report.summary.buckPhotos).toBe(7);
    expect(report.isEmpty).toBe(false);
  });

  it("ranks best stands only once they have enough sits", () => {
    expect(report.bestStands.map((s) => s.standName)).toEqual(["Ridge"]);
    expect(report.bestTime?.key).toBe("evening");
  });

  it("tracks bucks by profile and by name", () => {
    const big8 = report.bucks.find((b) => b.name === "Big 8")!;
    expect(big8.photos).toBe(6);
    expect(big8.profileId).toBe("d1");
    expect(big8.firstSeen).toBe("2025-11-01");
    expect(big8.lastSeen).toBe("2025-11-06");
    expect(big8.sites[0].name).toBe("Creek cam");
    expect(big8.byPeriod.morning).toBe(6);
    expect(big8.peakHourLabel).toBe("7 AM");
    expect(big8.topPhase).toBe("Chasing");
    const split = report.bucks.find((b) => b.name === "Split G2")!;
    expect(split.byPeriod.night).toBe(1);
    expect(split.profileId).toBeUndefined();
  });

  it("reports rut-phase activity from sits and photos", () => {
    const chasing = report.phases.find((p) => p.phase === "chasing")!;
    expect(chasing.buckPhotos).toBe(7);
    expect(chasing.sits).toBe(0);
  });

  it("writes rule-based advice", () => {
    const titles = report.advice.map((a) => a.title);
    expect(titles).toContain("Stop sitting Ridge on its wrong wind");
    expect(titles).toContain("Ridge was overhunted");
    expect(titles).toContain("Hunt Creek more");
    expect(titles).toContain("Be in the woods during chasing");
    expect(titles).toContain("Oak flat never got a sit");
    expect(report.advice.length).toBeLessThanOrEqual(6);
  });

  it("is empty for a season with nothing logged", () => {
    const empty = buildSeasonReport(input, 2019, ctx);
    expect(empty.isEmpty).toBe(true);
    expect(empty.advice).toEqual([]);
    expect(empty.bucks).toEqual([]);
  });
});
