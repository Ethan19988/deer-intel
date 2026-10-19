import { describe, expect, it } from "vitest";
import { averageOf, buildMovementOutlook, scoreMovement, toFahrenheit, toMph } from "@/lib/movementModel";

const ordinary = {
  tempF: 55,
  tempDepartureF: 1,
  pressureTrend: "steady" as const,
  windMph: 8,
  conditions: "Partly cloudy",
  moonIllumination: 50,
};

describe("scoreMovement calibration", () => {
  it("rates an ordinary day Fair, not Good", () => {
    const result = scoreMovement(ordinary);

    expect(result.score).toBe(3);
    expect(result.label).toBe("Fair: a normal day");
  });

  it("does not reward a normal breeze", () => {
    expect(scoreMovement({ ...ordinary, windMph: 12 }).score).toBe(3);
  });

  it("rates a cold front with a cold snap Good, not Prime on its own", () => {
    const result = scoreMovement({
      ...ordinary,
      tempDepartureF: -12,
      pressureTrend: "falling",
      pressureDropInHg: 0.09,
    });

    expect(result.score).toBe(4);
    expect(result.factors[0].text).toMatch(/cold snap/i);
  });

  it("rates the chasing phase with a cold front Prime", () => {
    expect(
      scoreMovement({
        ...ordinary,
        rutPhase: "chasing",
        tempDepartureF: -12,
        pressureTrend: "falling",
        pressureDropInHg: 0.09,
      }).score,
    ).toBe(5);
  });

  it("makes the rut the strongest factor", () => {
    const result = scoreMovement({ ...ordinary, rutPhase: "peak", tempDepartureF: -12 });

    expect(result.factors[0].text).toMatch(/peak rut/i);
  });

  it("rates a warm spell Slow", () => {
    expect(scoreMovement({ ...ordinary, tempDepartureF: 11 }).score).toBe(2);
  });

  it("rates a warm, rainy day Tough", () => {
    expect(
      scoreMovement({ ...ordinary, tempDepartureF: 10, conditions: "Heavy rain" }).score,
    ).toBe(1);
  });

  it("cuts movement for steady rain", () => {
    expect(scoreMovement({ ...ordinary, conditions: "Rain" }).score).toBe(2);
  });

  it("does not penalize strong wind but notes it, and docks dead calm slightly", () => {
    const windy = scoreMovement({ ...ordinary, windMph: 28 });
    expect(windy.score).toBe(3);
    expect(windy.factors.some((f) => /very windy/i.test(f.text))).toBe(true);
    expect(scoreMovement({ ...ordinary, windMph: 1 }).points).toBeLessThan(0);
  });

  it("gives the seeking/chasing rut a real lift", () => {
    expect(scoreMovement({ ...ordinary, rutPhase: "chasing" }).score).toBe(4);
  });

  it("gives clearing cold air behind a front a lift", () => {
    expect(
      scoreMovement({ ...ordinary, pressureTrend: "rising", tempDepartureF: -6 }).score,
    ).toBe(4);
  });

  it("judges warmth by the season when there's no recent history", () => {
    const warmOct = scoreMovement({ ...ordinary, tempDepartureF: null, tempF: 77, month: 9 });

    expect(warmOct.score).toBe(2);
    expect(warmOct.factors[0].text).toMatch(/hot for the season/i);
  });

  it("shows the moon for reference without changing the score", () => {
    const full = scoreMovement({ ...ordinary, moonIllumination: 100 });

    expect(full.points).toBe(0);
    expect(full.score).toBe(3);
    expect(full.factors.map((f) => f.text)).toContain("Full moon (collar studies show little effect)");
    expect(full.factors[0].text).toBe("Nothing unusual: a typical day");
  });
});

describe("scoreMovement time of day (map)", () => {
  it("does not make every dusk Good on an ordinary day", () => {
    expect(scoreMovement({ ...ordinary, period: "dusk" }).score).toBe(3);
  });

  it("lifts dusk to Good when the day itself is good", () => {
    expect(scoreMovement({ ...ordinary, tempDepartureF: -6, period: "dusk" }).score).toBe(4);
  });

  it("rates an ordinary midday Slow, but a chasing-phase midday Good", () => {
    expect(scoreMovement({ ...ordinary, period: "midday" }).score).toBe(2);
    // Bucks chase all day in this phase; sitting through midday pays.
    expect(scoreMovement({ ...ordinary, period: "midday", rutPhase: "chasing" }).score).toBe(4);
  });
});

describe("unit helpers", () => {
  it("converts temperatures and wind speeds", () => {
    expect(toFahrenheit("10 °C", "C")).toBe(50);
    expect(toFahrenheit("51", "F")).toBe(51);
    expect(toMph("SW 8 mph")).toBe(8);
    expect(Math.round(toMph("NW 20 km/h")!)).toBe(12);
    expect(averageOf([50, null, 60])).toBe(55);
  });
});

describe("buildMovementOutlook", () => {
  const day = (date: string, high: string, extra = {}) => ({
    date,
    label: date,
    high,
    conditions: "Clear",
    wind: "W 10 mph",
    morningWind: "W 6 mph",
    eveningWind: "W 8 mph",
    pressureTrend: "steady" as const,
    ...extra,
  });

  it("flags a cold snap and a warm spell against recent highs", () => {
    const outlook = buildMovementOutlook({
      days: [day("2026-10-19", "56"), day("2026-10-20", "44"), day("2026-10-21", "70")],
      recentHighs: ["57", "55", "58"],
      tempUnit: "F",
    });

    expect(outlook.map((d) => d.result.score)).toEqual([3, 3, 2]);
    expect(outlook[1].result.factors[0].text).toMatch(/cold snap/i);
    expect(outlook[2].result.factors[0].text).toMatch(/warm spell/i);
  });

  it("uses today's barometer drop to recognize a real front", () => {
    const [today] = buildMovementOutlook({
      days: [day("2026-10-19", "50", { pressureTrend: "falling" })],
      recentHighs: ["52", "51"],
      tempUnit: "F",
      todayPressureDropInHg: 0.08,
    });

    expect(today.result.factors.map((f) => f.text)).toContain("Front moving in (falling barometer)");
  });
});
