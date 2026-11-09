import { describe, expect, it } from "vitest";
import {
  currentSeasons,
  daysUntil,
  DEER_SEASONS,
  doeTagsLine,
  formatSeasonDay,
  isSundayHuntingDay,
  licenseYearFor,
  nextOpener,
  normalizeDoeTags,
  parseDoeTags,
  seasonOpenerReminder,
  seasonStateForPoint,
  sundayStatus,
} from "@/lib/seasonDates";
import { buildSeasonCalendarEvents } from "@/lib/calendarEvents";

// Local-time noon (or a given hour) on a calendar day.
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("season table", () => {
  it("has well-formed, ordered dates and an official source on every season", () => {
    for (const season of DEER_SEASONS) {
      expect(season.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(season.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(season.start <= season.end).toBe(true);
      expect(season.sourceUrl).toMatch(/^https:\/\/(www\.pa\.gov\/agencies\/pgc|news\.maryland\.gov\/dnr)/);
    }
    expect(new Set(DEER_SEASONS.map((s) => s.id)).size).toBe(DEER_SEASONS.length);
  });
});

describe("currentSeasons / nextOpener (PA)", () => {
  it("is in statewide archery on Nov 9 2026, rifle opens Sat Nov 28 in 19 days", () => {
    const now = day(2026, 11, 9);
    expect(currentSeasons(now, "PA").map((s) => s.id)).toEqual(["pa-archery-early"]);
    const opener = nextOpener(now, "PA");
    expect(opener?.start).toBe("2026-11-28");
    expect(opener?.days).toBe(19);
    expect(opener?.seasons.map((s) => s.shortLabel)).toEqual(["Rifle"]);
    expect(formatSeasonDay("2026-11-28")).toBe("Sat Nov 28");
  });

  it("includes opener and closer days", () => {
    expect(currentSeasons(day(2026, 11, 28), "PA").map((s) => s.id)).toContain("pa-regular-firearms");
    expect(currentSeasons(day(2026, 12, 13), "PA").map((s) => s.id)).toContain("pa-regular-firearms");
    expect(currentSeasons(day(2026, 12, 14), "PA")).toEqual([]);
  });

  it("keeps WMU-only seasons out unless asked", () => {
    const now = day(2026, 11, 24);
    expect(currentSeasons(now, "PA")).toEqual([]);
    expect(currentSeasons(now, "PA", { includeRegional: true }).map((s) => s.id)).toEqual([
      "pa-archery-early-wmu",
    ]);
  });

  it("groups same-day openers (late archery + flintlock)", () => {
    const opener = nextOpener(day(2026, 12, 20), "PA");
    expect(opener?.start).toBe("2026-12-26");
    expect(opener?.seasons.map((s) => s.id).sort()).toEqual(["pa-archery-late", "pa-flintlock"]);
  });

  it("returns null when no opener is left in the loaded year", () => {
    expect(nextOpener(day(2027, 1, 5), "PA")).toBeNull();
  });
});

describe("Maryland", () => {
  it("uses MD dates for a Maryland point, PA otherwise", () => {
    expect(seasonStateForPoint({ lat: 39.65, lng: -78.76 })).toBe("MD"); // Cumberland, MD
    expect(seasonStateForPoint({ lat: 41.2, lng: -77.2 })).toBe("PA");
    expect(seasonStateForPoint(null)).toBe("PA");
  });

  it("MD firearms opens Nov 28 and closes Dec 12", () => {
    const opener = nextOpener(day(2026, 11, 20), "MD");
    expect(opener?.seasons.map((s) => s.id)).toEqual(["md-firearms"]);
    expect(currentSeasons(day(2026, 12, 13), "MD").map((s) => s.id)).not.toContain("md-firearms");
  });
});

describe("daysUntil", () => {
  it("counts calendar days regardless of the hour", () => {
    expect(daysUntil(day(2026, 11, 9, 23), "2026-11-28")).toBe(19);
    expect(daysUntil(day(2026, 11, 9, 0), "2026-11-09")).toBe(0);
    // Across the Nov 1 DST change.
    expect(daysUntil(day(2026, 10, 31), "2026-11-02")).toBe(2);
  });
});

describe("isSundayHuntingDay", () => {
  it("PA: Sundays inside a statewide season are legal", () => {
    expect(isSundayHuntingDay(day(2026, 11, 15), "PA")).toBe(true); // archery
    expect(isSundayHuntingDay(day(2026, 11, 29), "PA")).toBe(true); // rifle
    expect(isSundayHuntingDay(day(2027, 1, 24), "PA")).toBe(true); // last day, flintlock
  });

  it("PA: Sundays between seasons and weekdays are not Sunday-hunting days", () => {
    expect(isSundayHuntingDay(day(2026, 11, 22), "PA")).toBe(false);
    expect(isSundayHuntingDay(day(2026, 11, 14), "PA")).toBe(false); // Saturday
  });

  it("MD Sundays in season can't be confirmed (county rules)", () => {
    expect(isSundayHuntingDay(day(2026, 11, 15), "MD")).toBeNull();
  });

  it("is unknown outside the verified year", () => {
    expect(isSundayHuntingDay(day(2027, 10, 3), "PA")).toBeNull();
  });
});

describe("sundayStatus", () => {
  it("names the coming Sunday", () => {
    expect(sundayStatus(day(2026, 11, 14), "PA")).toEqual({
      tone: "legal",
      text: "Sunday hunting legal tomorrow · Archery",
    });
    expect(sundayStatus(day(2026, 11, 9), "PA")?.text).toBe(
      "Sunday hunting legal Sun Nov 15 · Archery",
    );
    expect(sundayStatus(day(2026, 11, 21), "PA")).toEqual({
      tone: "closed",
      text: "No statewide deer season Sunday tomorrow",
    });
    expect(sundayStatus(day(2026, 11, 22), "MD")?.tone).toBe("check");
  });
});

describe("seasonOpenerReminder", () => {
  it("fires only the day before an opener", () => {
    expect(seasonOpenerReminder(day(2026, 11, 26), "PA")).toBeNull();
    const reminder = seasonOpenerReminder(day(2026, 11, 27), "PA");
    expect(reminder?.key).toBe("season-opener:pa-regular-firearms");
    expect(reminder?.title).toBe("Regular firearms opens tomorrow");
    expect(reminder?.body).toContain("Sat Nov 28");
    expect(seasonOpenerReminder(day(2026, 12, 25), "PA")?.title).toBe(
      "Late archery + Flintlock open tomorrow",
    );
  });
});

describe("doe tags", () => {
  it("reads the current license year and drops last year's count", () => {
    const year = licenseYearFor(day(2026, 11, 9));
    expect(year).toBe("2026-27");
    expect(licenseYearFor(day(2027, 2, 1))).toBe("2026-27");
    expect(licenseYearFor(day(2027, 7, 1))).toBe("2027-28");
    expect(parseDoeTags(JSON.stringify({ year, total: 2, filled: 1 }), year)).toEqual({
      year,
      total: 2,
      filled: 1,
    });
    expect(parseDoeTags(JSON.stringify({ year: "2025-26", total: 2, filled: 0 }), year).total).toBe(0);
    expect(parseDoeTags("not json", year).total).toBe(0);
    expect(parseDoeTags(null, year).total).toBe(0);
  });

  it("clamps filled to total", () => {
    expect(normalizeDoeTags({ year: "2026-27", total: 1, filled: 3 }).filled).toBe(1);
    expect(normalizeDoeTags({ year: "2026-27", total: -2, filled: 1 })).toEqual({
      year: "2026-27",
      total: 0,
      filled: 0,
    });
  });

  it("phrases what's left", () => {
    expect(doeTagsLine({ year: "x", total: 2, filled: 1 })).toBe("1 doe tag left");
    expect(doeTagsLine({ year: "x", total: 3, filled: 0 })).toBe("3 doe tags left");
    expect(doeTagsLine({ year: "x", total: 2, filled: 2 })).toBe("All 2 doe tags filled");
    expect(doeTagsLine({ year: "x", total: 0, filled: 0 })).toBeNull();
  });
});

describe("buildSeasonCalendarEvents", () => {
  it("marks PA statewide openers and last days, not WMU-only seasons", () => {
    const events = buildSeasonCalendarEvents(["PA"]);
    const rifleOpen = events.find((e) => e.id === "season-pa-regular-firearms-open");
    expect(rifleOpen).toMatchObject({ dayKey: "2026-11-28", kind: "season", title: "Regular firearms opens" });
    expect(events.find((e) => e.id === "season-pa-regular-firearms-close")?.dayKey).toBe("2026-12-13");
    expect(events.some((e) => e.id.includes("wmu"))).toBe(false);
    expect(events.every((e) => e.kind === "season")).toBe(true);
  });

  it("dedupes repeated states and adds MD when asked", () => {
    const events = buildSeasonCalendarEvents(["PA", "PA", "MD"]);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(events.some((e) => e.id === "season-md-firearms-open")).toBe(true);
  });
});
