import { beforeEach, describe, expect, it } from "vitest";
import {
  forecastAsOfLabel,
  readForecastSnapshot,
  readForecastSnapshotEntry,
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
const withDays = {
  current: { windDirection: "NNE" },
  sunriseIso: "2026-10-20T07:21",
  sunsetIso: "2026-10-20T18:19",
  days: [
    { date: "2026-10-20", eveningWind: "SW 6 mph" },
    { date: "2026-10-21", morningWind: "NW 8 mph" },
    { date: "2026-10-22", morningWind: "N 5 mph" },
  ],
} as unknown as LiveForecast;
const NOON = new Date(2026, 9, 20, 12, 0).getTime();
const KEY = "41.5,-77.5|F|mph";

describe("forecast snapshot", () => {
  beforeEach(() => store.clear());

  it("returns today's recent forecast for the same spot", () => {
    writeForecastSnapshot(KEY, forecast, NOON);
    expect(readForecastSnapshot(KEY, NOON + 60_000)).toEqual(forecast);
    expect(readForecastSnapshotEntry(KEY, NOON + 60_000)?.savedAt).toBe(NOON);
  });

  it("ignores another spot", () => {
    writeForecastSnapshot(KEY, forecast, NOON);
    expect(readForecastSnapshot("40.0,-77.0|F|mph", NOON)).toBeNull();
  });

  it("keeps a forecast without days until the age cap", () => {
    writeForecastSnapshot(KEY, forecast, NOON);
    expect(readForecastSnapshot(KEY, NOON + 6 * 60 * 60_000)).toEqual(forecast);
    expect(readForecastSnapshot(KEY, NOON + SNAPSHOT_MAX_AGE_MS + 1)).toBeNull();
  });

  it("stays usable offline through the last day it covers", () => {
    writeForecastSnapshot(KEY, withDays, NOON);
    // Well past the old 3h cutoff, same day: unchanged.
    const evening = new Date(2026, 9, 20, 18, 0).getTime();
    expect(readForecastSnapshot(KEY, evening)).toEqual(withDays);
    // Last day it covers, late.
    const lastDay = new Date(2026, 9, 22, 23, 0).getTime();
    expect(readForecastSnapshot(KEY, lastDay)?.days.map((d) => d.date)).toEqual([
      "2026-10-22",
    ]);
    // The day after: run out.
    expect(readForecastSnapshot(KEY, new Date(2026, 9, 23, 0, 30).getTime())).toBeNull();
  });

  it("rolls past days off so days[0] is today", () => {
    writeForecastSnapshot(KEY, withDays, NOON);
    const nextMorning = new Date(2026, 9, 21, 5, 30).getTime();
    const rolled = readForecastSnapshot(KEY, nextMorning);
    expect(rolled?.days.map((d) => d.date)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(rolled?.sunriseIso).toBe("2026-10-21T07:21");
    expect(rolled?.sunsetIso).toBe("2026-10-21T18:19");
  });

  it("rolls onto the kept day's own sun times across a DST change", () => {
    const acrossDst = {
      current: { windDirection: "NNE" },
      sunriseIso: "2026-10-31T07:40",
      sunsetIso: "2026-10-31T18:05",
      utcOffsetSeconds: -4 * 3600,
      timezone: "America/New_York",
      days: [
        { date: "2026-10-31", sunriseIso: "2026-10-31T07:40", sunsetIso: "2026-10-31T18:05" },
        { date: "2026-11-01", sunriseIso: "2026-11-01T06:41", sunsetIso: "2026-11-01T17:04" },
      ],
    } as unknown as LiveForecast;
    writeForecastSnapshot(KEY, acrossDst, new Date(2026, 9, 31, 12).getTime());
    const rolled = readForecastSnapshot(KEY, new Date(2026, 10, 1, 5).getTime());
    expect(rolled?.sunriseIso).toBe("2026-11-01T06:41");
    expect(rolled?.sunsetIso).toBe("2026-11-01T17:04");
    expect(rolled?.timezone).toBe("America/New_York");
  });

  it("drops a possibly stale UTC offset when rolling a snapshot with no zone name", () => {
    writeForecastSnapshot(KEY, { ...withDays, utcOffsetSeconds: -4 * 3600 }, NOON);
    const rolled = readForecastSnapshot(KEY, new Date(2026, 9, 21, 5, 30).getTime());
    expect(rolled?.utcOffsetSeconds).toBeUndefined();
  });
});

describe("forecast as-of label", () => {
  const saved = new Date(2026, 9, 20, 6, 12).getTime();

  it("is hidden while the forecast is under an hour old, live or saved", () => {
    expect(forecastAsOfLabel(saved, saved + 30 * 60_000, false)).toBeNull();
    expect(forecastAsOfLabel(saved, saved + 5 * 60_000, true)).toBeNull();
  });

  it("shows the saved time once the forecast is over an hour old", () => {
    expect(forecastAsOfLabel(saved, saved + 2 * 60 * 60_000, true)).toBe("Forecast as of 6:12 AM");
    expect(forecastAsOfLabel(saved, saved + 2 * 60 * 60_000, false)).toBe(
      "Forecast as of 6:12 AM",
    );
  });

  it("adds the weekday when saved on another day", () => {
    const nextDay = new Date(2026, 9, 21, 7, 0).getTime();
    expect(forecastAsOfLabel(saved, nextDay, true)).toBe("Forecast as of Tue 6:12 AM");
  });
});
