import { describe, expect, it } from "vitest";
import {
  bestSitsLine,
  bestSitsThisWeek,
  buildHuntWindows,
  buildWindMatrix,
  parseWindCompass,
} from "@/lib/huntPlanner";
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

describe("buildHuntWindows with AM/PM sit winds", () => {
  it("splits a day into morning and evening sits with their own stands", () => {
    const days: ForecastDay[] = [
      {
        ...day("2024-11-05", "S 6 mph"),
        morningWind: "SE 4 mph",
        eveningWind: "NW 9 mph",
      },
    ];
    const stands = [stand("Oak Ridge", "NW", "S"), stand("Creek Bottom", "SE")];

    const [window] = buildHuntWindows(days, stands);

    expect(window.sits).toEqual([
      { period: "AM", windCompass: "SE", goodStandNames: ["Creek Bottom"] },
      { period: "PM", windCompass: "NW", goodStandNames: ["Oak Ridge"] },
    ]);
  });

  it("scores the day by its best sit, not the daily dominant wind", () => {
    // The dominant wind (S) is wrong for the stand, but the evening swings NW.
    const swing: ForecastDay = {
      ...day("2024-11-06", "S 6 mph"),
      morningWind: "S 5 mph",
      eveningWind: "NW 8 mph",
    };
    const steadyWrong = day("2024-11-07", "S 6 mph");
    const stands = [stand("Oak Ridge", "NW", "S")];

    const windows = buildHuntWindows([steadyWrong, swing], stands);

    expect(windows[0].date).toBe("2024-11-06");
    expect(windows[0].windCompass).toBe("NW");
    expect(windows[0].goodStandNames).toEqual(["Oak Ridge"]);
    expect(windows[0].reasons.join(" ")).toContain("(PM)");
  });

  it("falls back to the daily wind when no sit winds are present", () => {
    const [window] = buildHuntWindows(
      [day("2024-11-08", "NW 8 mph")],
      [stand("Oak Ridge", "NW")],
    );

    expect(window.sits).toEqual([]);
    expect(window.goodStandNames).toEqual(["Oak Ridge"]);
  });
});

describe("buildWindMatrix", () => {
  it("makes AM/PM columns per day and grades each stand per sit", () => {
    const days: ForecastDay[] = [
      { ...day("2024-11-05", "S 6 mph", "falling"), morningWind: "SE 4 mph", eveningWind: "NW 9 mph" },
      day("2024-11-06", "NW 8 mph"),
    ];
    const matrix = buildWindMatrix(days, [stand("Oak Ridge", "NW", "SE")]);

    expect(matrix.columns.map((c) => `${c.dayLabel} ${c.period} ${c.windCompass}`)).toEqual([
      "2024-11-05 AM SE",
      "2024-11-05 PM NW",
      "2024-11-06 AM NW",
      "2024-11-06 PM NW",
    ]);
    expect(matrix.columns[0].isFront).toBe(true);
    expect(matrix.rows[0].cells).toEqual(["avoid", "good", "good", "good"]);
  });

  it("marks sits before the next sit as past", () => {
    const days = [day("2024-11-05", "NW 8 mph"), day("2024-11-06", "NW 8 mph")];
    const matrix = buildWindMatrix(days, [stand("Oak Ridge", "NW")], "2024-11-05-PM");

    expect(matrix.columns.map((c) => c.isPast)).toEqual([true, false, false, false]);
    expect(buildWindMatrix(days, []).columns.every((c) => !c.isPast)).toBe(true);
  });

  it("marks cells unknown when a sit has no wind", () => {
    const matrix = buildWindMatrix([day("2024-11-07", "calm")], [stand("Oak Ridge", "NW")]);

    expect(matrix.rows[0].cells).toEqual(["unknown", "unknown"]);
  });
});

describe("calm sit winds", () => {
  it("grades a sub-3 mph sit as marginal in the wind grid", () => {
    const matrix = buildWindMatrix(
      [{ ...day("2024-11-05", "S 6 mph"), morningWind: "NW 2 mph", eveningWind: "NW 9 mph" }],
      [stand("Oak Ridge", "NW")],
    );

    expect(matrix.columns[0].windText).toBe("NW 2 mph");
    expect(matrix.rows[0].cells).toEqual(["marginal", "good"]);
  });

  it("doesn't count a calm sit's stands as good", () => {
    const [window] = buildHuntWindows(
      [{ ...day("2024-11-05", "NW 2 mph"), morningWind: "NW 1 mph", eveningWind: "NW 2 mph" }],
      [stand("Oak Ridge", "NW")],
    );

    expect(window.goodStandNames).toEqual([]);
  });
});

describe("bestSitsThisWeek", () => {
  const days: ForecastDay[] = [
    { ...day("Mon", "S 6 mph"), morningWind: "NW 8 mph", eveningWind: "S 6 mph" },
    { ...day("Tue", "NW 8 mph"), morningWind: "S 6 mph", eveningWind: "NW 9 mph" },
    { ...day("Thu", "N 8 mph"), morningWind: "W 7 mph", eveningWind: "S 6 mph" },
  ];
  const stands = [
    stand("Oak Ridge", "NW"),
    stand("Creek Bottom", "NW, W"),
    stand("Pine Saddle", "N, NW"),
    stand("West Edge", "W"),
    stand("No Notes", ""),
  ];

  it("ranks upcoming sits by good-wind stands and skips past sits", () => {
    const sits = bestSitsThisWeek(days, stands, "Mon-PM");

    expect(sits.map((s) => `${s.dayLabel} ${s.period} ${s.goodCount}`)).toEqual([
      "Tue PM 3",
      "Thu AM 2",
    ]);
    expect(bestSitsLine(sits)).toBe("Best this week: Tue PM (3 stands) · Thu AM (2)");
  });

  it("counts Monday morning when it is still ahead", () => {
    // Ties on count go to the sooner sit.
    expect(bestSitsThisWeek(days, stands, undefined, 3).map((s) => s.key)).toEqual([
      "Mon-AM",
      "Tue-PM",
      "Thu-AM",
    ]);
  });

  it("is empty (no line) when no stand has winds set", () => {
    const sits = bestSitsThisWeek(days, [stand("No Notes", "")]);

    expect(sits).toEqual([]);
    expect(bestSitsLine(sits)).toBeNull();
  });

  it("singular stand wording", () => {
    expect(
      bestSitsLine([{ key: "k", dayLabel: "Fri", period: "AM", goodCount: 1, isFront: false }]),
    ).toBe("Best this week: Fri AM (1 stand)");
  });
});
