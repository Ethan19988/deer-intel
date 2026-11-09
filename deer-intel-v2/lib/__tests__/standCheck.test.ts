import { describe, expect, it } from "vitest";
import { buildStandChecks, standTimingMismatch } from "@/lib/standCheck";
import type { Stand } from "@/types/stand";

function stand(id: string, overrides: Partial<Stand> = {}): Stand {
  return {
    id,
    propertyId: "p1",
    name: id,
    standType: "Ladder",
    bestWinds: "NW",
    avoidWinds: "SE",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...overrides,
  };
}

const base = { hunts: [], pins: [], wind: "NW", today: "2026-11-08" };

describe("buildStandChecks best time", () => {
  const am = stand("am", { bestTime: "am" });
  const any = stand("any");

  it("doesn't pick a morning stand for an evening sit", () => {
    const check = buildStandChecks({ ...base, stands: [am, any], period: "evening" });
    expect(check.pick?.stand.id).toBe("any");
    const row = check.rows.find((r) => r.stand.id === "am");
    expect(row?.timing?.reason).toBe("Evening sit — this is a morning stand");
    expect(check.rows.at(-1)?.stand.id).toBe("am");
  });

  it("picks it for a morning (or tomorrow-morning) sit", () => {
    expect(standTimingMismatch(am, "morning")).toBeNull();
    expect(standTimingMismatch(am, "tomorrow")).toBeNull();
    expect(standTimingMismatch(stand("pm", { bestTime: "pm" }), "tomorrow")?.reason).toBe(
      "Morning sit — this is an evening stand",
    );
  });

  it("changes nothing when the period or best time is unset", () => {
    const withoutPeriod = buildStandChecks({ ...base, stands: [am, any] });
    expect(withoutPeriod.rows.every((row) => !("timing" in row))).toBe(true);
    expect(standTimingMismatch(any, "evening")).toBeNull();
    expect(standTimingMismatch(stand("all", { bestTime: "all" }), "evening")).toBeNull();
  });

  it("gives no pick when the only good-wind stand is the wrong time", () => {
    expect(buildStandChecks({ ...base, stands: [am], period: "evening" }).pick).toBeNull();
  });
});
