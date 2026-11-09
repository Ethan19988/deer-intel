import { describe, expect, it } from "vitest";
import { dailyFromToday, nearestHourKey, pickHourFields } from "@/lib/liveWeather";
import { DEFAULT_UNITS } from "@/lib/units";
import { forecastClock, formatWallClock, parseForecastLocal } from "@/lib/forecastTime";

describe("dailyFromToday (past_days=1)", () => {
  const daily = {
    time: ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"],
    sunrise: ["a", "b", "c", "d"],
    temperature_2m_max: [1, 2, 3, 4],
  };

  it("drops the past day from every array so index 0 is today", () => {
    const sliced = dailyFromToday(daily, "2026-11-08T05:15");
    expect(sliced.time).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(sliced.sunrise).toEqual(["b", "c", "d"]);
    expect(sliced.temperature_2m_max).toEqual([2, 3, 4]);
  });

  it("drops the one requested past day without a current time", () => {
    expect(dailyFromToday(daily, undefined).time?.[0]).toBe("2026-11-08");
  });

  it("leaves a response that already starts today alone", () => {
    const today = { time: ["2026-11-08", "2026-11-09", "2026-11-10"] };
    expect(dailyFromToday(today, "2026-11-08T05:15")).toBe(today);
  });
});

describe("hourly lookup for a photo time", () => {
  const hourly = {
    time: ["2026-11-08T00:00", "2026-11-08T06:00", "2026-11-08T07:00", "2026-11-08T23:00"],
    temperature_2m: [30, 35, 38, 33],
  };

  it("rounds to the nearest hour", () => {
    expect(nearestHourKey(new Date(2026, 10, 8, 6, 40))).toBe("2026-11-08T07");
    expect(nearestHourKey(new Date(2026, 10, 8, 6, 20))).toBe("2026-11-08T06");
    expect(pickHourFields(hourly, new Date(2026, 10, 8, 6, 40), DEFAULT_UNITS)?.temperature).toBe("38");
  });

  it("keeps the same day's hour when rounding would cross midnight", () => {
    expect(pickHourFields(hourly, new Date(2026, 10, 8, 23, 45), DEFAULT_UNITS)?.temperature).toBe("33");
  });

  it("returns nothing (not midnight) when the hour isn't there", () => {
    expect(pickHourFields(hourly, new Date(2026, 10, 8, 14, 0), DEFAULT_UNITS)).toBeNull();
  });
});

describe("forecast clock labels", () => {
  it("labels an instant in the IANA zone, on each side of DST", () => {
    // Nov 1 2026 06:11 EST = 11:11 UTC; Oct 31 06:11 EDT = 10:11 UTC.
    expect(forecastClock(new Date(Date.UTC(2026, 10, 1, 11, 11)), -4 * 3600, "America/New_York")).toBe("6:11 AM");
    expect(forecastClock(new Date(Date.UTC(2026, 9, 31, 10, 11)), -4 * 3600, "America/New_York")).toBe("6:11 AM");
  });

  it("falls back to the fixed offset for an unknown zone", () => {
    expect(forecastClock(new Date(Date.UTC(2026, 9, 31, 10, 11)), -4 * 3600, "Not/AZone")).toBe("6:11 AM");
    expect(parseForecastLocal("2026-10-31T06:11", -4 * 3600, "Not/AZone")).toEqual(
      new Date(Date.UTC(2026, 9, 31, 10, 11)),
    );
  });

  it("shows a wall-clock time as written", () => {
    expect(formatWallClock("2026-11-01T06:41")).toMatch(/6:41/);
    expect(formatWallClock(undefined)).toBe("");
  });
});
