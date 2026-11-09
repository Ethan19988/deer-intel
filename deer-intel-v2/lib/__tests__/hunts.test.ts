import { describe, expect, it } from "vitest";
import {
  deerSeenShort,
  huntOneLineSummary,
  recentStandIds,
  sortHuntsNewestFirst,
} from "@/lib/hunts";
import type { HuntLogEntry } from "@/types/hunt";

function hunt(id: string, overrides: Partial<HuntLogEntry> = {}): HuntLogEntry {
  return {
    id,
    propertyId: "p1",
    standId: "s1",
    standName: "My Tree",
    date: "2026-11-08",
    startTime: "15:30",
    endTime: "17:45",
    windDirection: "",
    windSpeed: "",
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
  };
}

describe("hunt history helpers", () => {
  it("sorts newest first", () => {
    const sorted = sortHuntsNewestFirst([
      hunt("old", { date: "2026-11-01" }),
      hunt("am", { date: "2026-11-08", startTime: "06:10" }),
      hunt("pm", { date: "2026-11-08", startTime: "15:30" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["pm", "am", "old"]);
  });

  it("summarizes a sit on one line", () => {
    expect(huntOneLineSummary(hunt("h", { bucks: 2, does: 1 }))).toBe(
      "Sun Nov 8 · PM · My Tree · 2 bucks, 1 doe",
    );
    expect(huntOneLineSummary(hunt("h", { startTime: "", endTime: "" }))).toBe(
      "Sat Nov 8 · My Tree · nothing seen",
    );
    expect(deerSeenShort({ bucks: 1, does: 0, fawns: 3 })).toBe("1 buck, 3 fawns");
  });

  it("lists recent stands on the property, newest first, skipping deleted ones", () => {
    const hunts = [
      hunt("a", { date: "2026-11-01", standId: "s1" }),
      hunt("b", { date: "2026-11-02", standId: "s2" }),
      hunt("c", { date: "2026-11-03", standId: "gone" }),
      hunt("d", { date: "2026-11-04", standId: "s2" }),
      hunt("e", { date: "2026-11-05", standId: "s9", propertyId: "p2" }),
      hunt("f", { date: "2026-10-01", standId: "s3" }),
    ];

    expect(recentStandIds(hunts, "p1", new Set(["s1", "s2", "s3"]))).toEqual([
      "s2",
      "s1",
      "s3",
    ]);
    expect(recentStandIds(hunts, "p1", new Set(["s1", "s2", "s3"]), 1)).toEqual(["s2"]);
    expect(recentStandIds(hunts, "p3", new Set(["s1"]))).toEqual([]);
  });
});
