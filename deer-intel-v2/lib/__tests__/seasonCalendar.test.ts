import { describe, expect, it } from "vitest";
import { getSeasonContext } from "@/lib/seasonCalendar";

const prefs = { seasonOpener: "2026-09-26", rutPeak: "2026-11-15" };

describe("season opener countdown", () => {
  it("counts the day of the season while it's open", () => {
    const context = getSeasonContext(new Date(2026, 9, 1), prefs);
    expect(context.opener?.dayOfSeason).toBe(6);
  });

  it("still counts through January", () => {
    const context = getSeasonContext(new Date(2027, 0, 31), prefs);
    expect(context.opener?.dayOfSeason).not.toBeNull();
  });

  it("counts down to next fall's opener once the season has closed", () => {
    const context = getSeasonContext(new Date(2027, 2, 1), prefs);
    expect(context.opener?.dayOfSeason).toBeNull();
    expect(context.opener?.date).toEqual(new Date(2027, 8, 26));
    expect(context.opener?.daysToOpener).toBeGreaterThan(0);
  });

  it("keeps the next opener after the peak flips to next fall", () => {
    const context = getSeasonContext(new Date(2027, 5, 1), prefs);
    expect(context.opener?.date).toEqual(new Date(2027, 8, 26));
  });
});
