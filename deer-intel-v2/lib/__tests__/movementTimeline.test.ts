import { describe, expect, it } from "vitest";
import {
  buildMovementTimeline,
  movementDayRead,
  parseWindText,
} from "@/lib/movementTimeline";
import type { ForecastDay } from "@/lib/liveWeather";

const day = (date: string, extra: Partial<ForecastDay> = {}): ForecastDay => ({
  date,
  label: date,
  high: "60°F",
  low: "40°F",
  conditions: "Clear",
  wind: "N 6 mph",
  morningWind: "NNW 4 mph",
  eveningWind: "NE 9 mph",
  ...extra,
});

describe("parseWindText", () => {
  it("splits compass and speed", () => {
    expect(parseWindText("NW 8 mph")).toEqual({ compass: "NW", mph: 8 });
    expect(parseWindText("")).toEqual({ compass: "", mph: null });
  });
});

describe("buildMovementTimeline", () => {
  const base = {
    days: [day("2026-10-21"), day("2026-10-22"), day("2026-10-23")],
    sunrise: "7:30 AM",
    sunset: "6:50 PM",
    liveWindFromCompass: "N",
    liveWindMph: 4,
  };

  it("starts at the current window and walks forward through the days", () => {
    const slots = buildMovementTimeline({ ...base, currentPeriod: "dusk" });
    expect(slots.map((slot) => `${slot.dayIndex}-${slot.period}`)).toEqual([
      "0-dusk",
      "0-night",
      "1-dawn",
      "1-midday",
      "1-dusk",
      "1-night",
      "2-dawn",
    ]);
    expect(slots[0].isNow).toBe(true);
    expect(slots[0].dayLabel).toBe("TONIGHT");
  });

  it("uses live wind now and the sit-window forecast wind later", () => {
    const slots = buildMovementTimeline({ ...base, currentPeriod: "dusk" });
    expect(slots[0].windFromCompass).toBe("N");
    expect(slots[0].windMph).toBe(4);
    expect(slots[2].windFromCompass).toBe("NNW"); // dawn → morning-sit wind
    expect(slots[3].windFromCompass).toBe("N"); // midday → daily wind
    expect(slots[4].windFromCompass).toBe("NE"); // dusk → evening-sit wind
  });

  it("reads thermals rising at midday and falling at dawn and dusk", () => {
    const slots = buildMovementTimeline({ ...base, currentPeriod: "dusk" });
    expect(slots.find((slot) => slot.period === "midday")?.thermal.phase).toBe("uphill");
    expect(slots.find((slot) => slot.period === "dawn")?.thermal.phase).toBe("downhill");
  });

  it("returns nothing without forecast days", () => {
    expect(buildMovementTimeline({ ...base, days: [], currentPeriod: "dusk" })).toEqual([]);
  });
});

describe("movementDayRead", () => {
  it("maps the score to a plain read", () => {
    expect(movementDayRead(5)).toBe("Above normal");
    expect(movementDayRead(3)).toBe("Normal");
    expect(movementDayRead(2)).toBe("Below normal");
  });
});
