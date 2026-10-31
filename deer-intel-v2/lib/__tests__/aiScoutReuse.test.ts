import { describe, expect, it } from "vitest";
import {
  AI_SCOUT_REUSE_MAX_AGE_MS,
  findReusableAiScoutReport,
  hashAiScoutContext,
  stableStringify,
} from "@/lib/aiScoutReuse";
import type { SavedAiScoutReport } from "@/lib/aiScoutHistory";
import type { AiScoutRequestContext } from "@/types/aiScout";

function context(overrides: Partial<AiScoutRequestContext> = {}): AiScoutRequestContext {
  return {
    property: { name: "Ridge", county: "Tioga", acres: "80", notes: "" },
    conditions: { windDirection: "NW", windSpeed: "8 mph", temperature: "41", moonPhase: "Full", notes: "" },
    stands: [],
    recentHunts: [],
    recentCameraChecks: [],
    deerProfiles: [],
    recentBuckPhotos: [],
    terrainPicks: [],
    ...overrides,
  };
}

const NOW = new Date(2026, 9, 31, 12, 0).getTime();

function saved(hash: string | undefined, savedAt = NOW - 60_000): SavedAiScoutReport {
  return {
    propertyId: "p1",
    savedAt,
    conditions: context().conditions,
    report: {
      headline: "",
      recommendedStandName: "Ridge Ladder",
      recommendedStandReasoning: "",
      keyFactors: [],
      risks: [],
      confidence: "low",
    },
    contextHash: hash,
  };
}

describe("stableStringify / hash", () => {
  it("ignores key order, surrounding whitespace and undefined fields", () => {
    expect(stableStringify({ b: 1, a: " x ", c: undefined })).toBe(stableStringify({ a: "x", b: 1 }));
  });

  it("keeps array order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("changes when conditions or data change", () => {
    const base = hashAiScoutContext(context());
    expect(hashAiScoutContext(context())).toBe(base);
    expect(
      hashAiScoutContext(context({ conditions: { ...context().conditions, windDirection: "SW" } })),
    ).not.toBe(base);
    expect(
      hashAiScoutContext(context({ property: { ...context().property, notes: "acorns" } })),
    ).not.toBe(base);
  });
});

describe("findReusableAiScoutReport", () => {
  const hash = hashAiScoutContext(context());

  it("reuses a fresh report for the same payload", () => {
    expect(findReusableAiScoutReport(saved(hash), hash, NOW)).not.toBeNull();
  });

  it("refuses a different payload, missing hash, or nothing saved", () => {
    expect(findReusableAiScoutReport(saved("v1:other"), hash, NOW)).toBeNull();
    expect(findReusableAiScoutReport(saved(undefined), hash, NOW)).toBeNull();
    expect(findReusableAiScoutReport(null, hash, NOW)).toBeNull();
  });

  it("refuses once it's ~3 hours old, or from the far future", () => {
    expect(
      findReusableAiScoutReport(saved(hash, NOW - AI_SCOUT_REUSE_MAX_AGE_MS + 1000), hash, NOW),
    ).not.toBeNull();
    expect(findReusableAiScoutReport(saved(hash, NOW - AI_SCOUT_REUSE_MAX_AGE_MS), hash, NOW)).toBeNull();
    expect(findReusableAiScoutReport(saved(hash, NOW + 60 * 60_000), hash, NOW)).toBeNull();
  });
});
