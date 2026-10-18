import { describe, expect, it } from "vitest";
import { buildHuntWindows, parseWindCompass } from "@/lib/huntPlanner";
import type { ForecastDay } from "@/lib/liveWeather";
import type { Stand } from "@/types/stand";

function day(
  date: string,
  wind: string,
  pressureTrend?: ForecastDay["pressureTrend"],
): ForecastDay {
  return {
    date,
    label: date,
    high: "50",
    low: "30",
    conditions: "Clear",
    wind,
    pressureTrend,
  };
}

function stand(name: string, bestWinds: string, avoidWinds = ""): Stand {
  return {
    id: name,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds,
    avoidWinds,
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

describe("parseWindCompass", () => {
  it("pulls the leading compass point from a wind string", () => {
    expect(parseWindCompass("NW 8 mph")).toBe("NW");
  });

  it("returns null when there's no compass point", () => {
    expect(parseWindCompass("calm")).toBeNull();
  });
});

describe("buildHuntWindows", () => {
  it("ranks a front day with a matching wind above a blow-out day", () => {
    const days = [
      day("2024-11-02", "S 5 mph", "steady"),
      day("2024-11-01", "NW 8 mph", "falling"),
    ];
    const stands = [stand("Oak Ridge", "NW", "S")];

    const windows = buildHuntWindows(days, stands);

    expect(windows[0].date).toBe("2024-11-01");
    expect(windows[0].isFront).toBe(true);
    expect(windows[0].goodStandNames).toContain("Oak Ridge");
    // The wrong-wind day scores below the front day.
    expect(windows[0].score).toBeGreaterThan(windows[1].score);
  });

  it("still ranks a front day when there are no stands", () => {
    const days = [
      day("2024-11-01", "W 6 mph", "steady"),
      day("2024-11-02", "N 10 mph", "falling"),
    ];

    const windows = buildHuntWindows(days, []);

    expect(windows[0].date).toBe("2024-11-02");
    expect(windows[0].isFront).toBe(true);
  });
});
