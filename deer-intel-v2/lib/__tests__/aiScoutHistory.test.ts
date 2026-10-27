import { beforeEach, describe, expect, it } from "vitest";
import {
  formatSavedAgo,
  parseSavedAiScoutReport,
  readSavedAiScoutReport,
  savedAiScoutKey,
  writeSavedAiScoutReport,
  type SavedAiScoutReport,
} from "@/lib/aiScoutHistory";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
};

const NOON = new Date(2026, 9, 20, 12, 0).getTime();

function saved(propertyId: string, stand: string, savedAt = NOON): SavedAiScoutReport {
  return {
    propertyId,
    savedAt,
    conditions: { windDirection: "NW", windSpeed: "8 mph", temperature: "41", moonPhase: "", notes: "" },
    report: {
      headline: "",
      recommendedStandName: stand,
      recommendedStandReasoning: "",
      keyFactors: [],
      risks: [],
      confidence: "medium",
    },
  };
}

describe("saved AI Scout report", () => {
  beforeEach(() => store.clear());

  it("keeps only the latest report per property under a deer-intel: key", () => {
    writeSavedAiScoutReport(saved("p1", "Ridge"));
    writeSavedAiScoutReport(saved("p1", "Creek", NOON + 1000));
    writeSavedAiScoutReport(saved("p2", "Saddle"));

    expect(savedAiScoutKey("p1")).toMatch(/^deer-intel:/);
    expect(store.size).toBe(2);
    expect(readSavedAiScoutReport("p1")?.report.recommendedStandName).toBe("Creek");
    expect(readSavedAiScoutReport("p2")?.report.recommendedStandName).toBe("Saddle");
    expect(readSavedAiScoutReport("p3")).toBeNull();
  });

  it("drops malformed or mismatched values", () => {
    expect(parseSavedAiScoutReport("not json", "p1")).toBeNull();
    expect(parseSavedAiScoutReport(JSON.stringify({ propertyId: "p1" }), "p1")).toBeNull();
    expect(parseSavedAiScoutReport(JSON.stringify(saved("p2", "X")), "p1")).toBeNull();
  });
});

describe("formatSavedAgo", () => {
  it("reads as a short relative time", () => {
    expect(formatSavedAgo(NOON, NOON + 20_000)).toBe("just now");
    expect(formatSavedAgo(NOON, NOON + 12 * 60_000)).toBe("12 min ago");
    expect(formatSavedAgo(NOON, NOON + 3 * 3_600_000)).toBe("3 h ago");
    expect(formatSavedAgo(NOON, NOON + 30 * 3_600_000)).toBe("yesterday");
    expect(formatSavedAgo(NOON, NOON + 4 * 86_400_000)).toBe("4 days ago");
    expect(formatSavedAgo(NOON + 5000, NOON)).toBe("just now");
  });
});
