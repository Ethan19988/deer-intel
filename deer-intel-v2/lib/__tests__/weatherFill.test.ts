import { describe, expect, it } from "vitest";
import { mergeWeatherFill, weatherFillMode, type LiveWeatherFields } from "@/lib/liveWeather";

const now = new Date(2026, 9, 31, 14, 0);
const at = (h: number, m = 0, day = 31) => new Date(2026, 9, day, h, m);

describe("weatherFillMode", () => {
  it("uses current conditions near now or with no time", () => {
    expect(weatherFillMode(null, now)).toBe("current");
    expect(weatherFillMode(at(14, 20), now)).toBe("current");
    expect(weatherFillMode(at(13, 31), now)).toBe("current");
  });

  it("uses history for any time already past, including earlier today", () => {
    expect(weatherFillMode(at(6, 30), now)).toBe("history");
    expect(weatherFillMode(at(17, 0, 29), now)).toBe("history");
  });

  it("uses the forecast for a time still ahead", () => {
    expect(weatherFillMode(at(16, 30), now)).toBe("forecast");
    expect(weatherFillMode(at(6, 0, 32), now)).toBe("forecast");
  });

  it("treats an invalid date as now", () => {
    expect(weatherFillMode(new Date(Number.NaN), now)).toBe("current");
  });
});

const empty: LiveWeatherFields = {
  temperature: "",
  windDirection: "",
  windSpeed: "",
  weather: "",
  moonPhase: "",
};
const morning: LiveWeatherFields = {
  temperature: "38",
  windDirection: "NW",
  windSpeed: "6 mph",
  weather: "Clear",
  moonPhase: "Waxing Gibbous",
};
const evening: LiveWeatherFields = {
  temperature: "47",
  windDirection: "SW",
  windSpeed: "9 mph",
  weather: "Partly cloudy",
  moonPhase: "Waxing Gibbous",
};

describe("mergeWeatherFill", () => {
  it("fills an empty form and remembers what it wrote", () => {
    const result = mergeWeatherFill({ ...empty, notes: "x" }, morning, {});

    expect(result.values).toEqual({ ...morning, notes: "x" });
    expect(result.autoFilled).toEqual(morning);
    expect(result.changed).toBe(true);
  });

  it("refreshes auto-filled fields when the time changes", () => {
    const first = mergeWeatherFill(empty, morning, {});
    const second = mergeWeatherFill(first.values, evening, first.autoFilled);

    expect(second.values).toEqual(evening);
  });

  it("keeps fields typed by hand after the fill", () => {
    const first = mergeWeatherFill(empty, morning, {});
    const typed = { ...first.values, windDirection: "W", temperature: "40" };
    const second = mergeWeatherFill(typed, evening, first.autoFilled);

    expect(second.values.windDirection).toBe("W");
    expect(second.values.temperature).toBe("40");
    expect(second.values.windSpeed).toBe("9 mph");
    // The hand-typed fields are no longer the fill's to change.
    expect(second.autoFilled.windDirection).toBeUndefined();
    const third = mergeWeatherFill(second.values, morning, second.autoFilled);
    expect(third.values.windDirection).toBe("W");
  });

  it("never overwrites pre-existing values it didn't write", () => {
    const saved = { ...morning };
    const result = mergeWeatherFill(saved, evening, {});

    expect(result.values).toEqual(morning);
    expect(result.changed).toBe(false);
  });

  it("doesn't blank a field the new fill lacks", () => {
    const first = mergeWeatherFill(empty, morning, {});
    const result = mergeWeatherFill(first.values, { ...evening, weather: "" }, first.autoFilled);

    expect(result.values.weather).toBe("Clear");
  });
});
