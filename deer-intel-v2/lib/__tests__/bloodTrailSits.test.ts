import { describe, expect, it } from "vitest";
import {
  buildPropertyStandStats,
  buildStandStats,
  isSitHunt,
  type StatsContext,
} from "@/lib/standStats";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

// A blood trail saved from the map is filed under the nearest stand but is
// not a sit: it must not add sits, hours or "harvests" to that stand.
const ctx: StatsContext = {
  sunFor: () => ({ sunrise: 390, sunset: 1080 }),
  phaseFor: () => "pre-rut",
};

function hunt(overrides: Partial<HuntLogEntry>): HuntLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId: "p1",
    standId: "s1",
    standName: "Ridge",
    date: "2025-10-20",
    startTime: "15:00",
    endTime: "18:30",
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
    does: 2,
    fawns: 0,
    shotOpportunity: false,
    harvest: false,
    notes: "",
    ...overrides,
  };
}

const ridge: Stand = {
  id: "s1",
  propertyId: "p1",
  name: "Ridge",
  standType: "Hang-on",
  bestWinds: "NW",
  avoidWinds: "SE",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
};

describe("blood-trail entries in stand stats", () => {
  const hunts = [
    hunt({}),
    hunt({}),
    hunt({ kind: "blood-trail", harvest: true, shotOpportunity: true, endTime: "23:59" }),
  ];

  it("tells sits from recoveries", () => {
    expect(isSitHunt(hunts[0])).toBe(true);
    expect(isSitHunt({ kind: "sit" })).toBe(true);
    expect(isSitHunt(hunts[2])).toBe(false);
  });

  it("leaves recoveries out of a stand's sits and the property roll-up", () => {
    expect(buildStandStats(ridge, hunts, ctx).overall.sits).toBe(2);
    const property = buildPropertyStandStats([ridge], hunts, ctx);
    expect(property.property.overall.sits).toBe(2);
    expect(property.stands[0].overall.sits).toBe(2);
  });
});
