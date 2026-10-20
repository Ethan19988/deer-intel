import { beforeEach, describe, expect, it } from "vitest";
import {
  readForecastSnapshot,
  SNAPSHOT_MAX_AGE_MS,
  writeForecastSnapshot,
} from "@/lib/forecastSnapshot";
import type { LiveForecast } from "@/lib/liveWeather";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
};

const forecast = { current: { windDirection: "NNE" } } as unknown as LiveForecast;
const NOON = new Date(2026, 9, 20, 12, 0).getTime();

describe("forecast snapshot", () => {
  beforeEach(() => store.clear());

  it("returns today's recent forecast for the same spot", () => {
    writeForecastSnapshot("41.5,-77.5|F|mph", forecast, NOON);
    expect(readForecastSnapshot("41.5,-77.5|F|mph", NOON + 60_000)).toEqual(forecast);
  });

  it("ignores another spot, a stale one, or yesterday's", () => {
    writeForecastSnapshot("41.5,-77.5|F|mph", forecast, NOON);
    expect(readForecastSnapshot("40.0,-77.0|F|mph", NOON)).toBeNull();
    expect(readForecastSnapshot("41.5,-77.5|F|mph", NOON + SNAPSHOT_MAX_AGE_MS + 1)).toBeNull();
    const lateNight = new Date(2026, 9, 20, 23, 30).getTime();
    writeForecastSnapshot("41.5,-77.5|F|mph", forecast, lateNight);
    expect(readForecastSnapshot("41.5,-77.5|F|mph", lateNight + 60 * 60_000)).toBeNull();
  });
});
