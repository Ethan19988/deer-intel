import { describe, expect, it } from "vitest";
import { buildStandStats, buildPropertyStandStats, type StatsContext } from "@/lib/standStats";
import { getStandPressure } from "@/lib/standPressure";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import { countHuntedStands, huntMatchesStand, huntsForStand } from "@/lib/standHunts";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

function stand(id: string, name: string, propertyId = "p1"): Stand {
  return {
    id,
    propertyId,
    name,
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId: "p1",
    standId: "",
    standName: "",
    date: "2026-11-05",
    startTime: "06:00",
    endTime: "09:00",
    windDirection: "NW",
    windSpeed: "8 mph",
    temperature: "",
    weather: "",
    moonPhase: "",
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
  } as HuntLogEntry;
}

const ctx: StatsContext = {
  sunFor: () => ({ sunrise: 390, sunset: 1080 }),
  phaseFor: () => "pre-rut",
};

describe("huntsForStand", () => {
  const ridge = stand("s1", "Ridge Oak");
  const hunts = [
    hunt({ standId: "s1", standName: "Renamed later" }),
    hunt({ standId: "", standName: "  ridge oak " }),
    hunt({ standId: "", standName: "Ridge Oak", propertyId: "p2" }),
    hunt({ standId: "s9", standName: "Ridge Oak" }),
    hunt({ standId: "", standName: "Creek" }),
  ];

  it("matches by id, or an id-less sit on the same property with the same name", () => {
    expect(huntsForStand(ridge, hunts)).toHaveLength(2);
  });

  it("never name-matches without a property", () => {
    expect(huntMatchesStand({ id: "s1", name: "Ridge Oak" }, hunts[1])).toBe(false);
  });

  it("tolerates sits with no stand name", () => {
    expect(huntMatchesStand(ridge, { standId: "" })).toBe(false);
  });

  it("counts hunted stands with the same rule", () => {
    expect(countHuntedStands([ridge, stand("s2", "Creek"), stand("s3", "Pines")], hunts)).toBe(2);
  });

  it("stats, pressure and intelligence all agree on the sit count", () => {
    const sits = huntsForStand(ridge, hunts).length;
    expect(buildStandStats(ridge, hunts, ctx).overall.sits).toBe(sits);
    expect(getStandPressure(ridge, hunts, "2026-11-05").recentSits).toBe(sits);
    const summary = getStandIntelligenceSummary({
      stand: ridge,
      propertyId: "p1",
      cameras: [],
      cameraChecks: [],
      hunts,
      pins: [],
      now: new Date(2026, 10, 5, 12),
    });
    expect(summary.recentHunts).toHaveLength(sits);
  });

  it("files an id-less sit under the listed stand with its name", () => {
    const result = buildPropertyStandStats(
      [ridge],
      [hunt({ standId: "", standName: "Ridge Oak" }), hunt({ standId: "", standName: "Old oak" })],
      ctx,
    );
    expect(result.stands.find((row) => row.standName === "Ridge Oak")?.overall.sits).toBe(1);
    expect(result.stands.find((row) => row.standName === "Old oak")?.overall.sits).toBe(1);
  });
});
