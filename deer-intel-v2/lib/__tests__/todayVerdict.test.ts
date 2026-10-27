import { describe, expect, it } from "vitest";
import type { LiveForecast } from "@/lib/liveWeather";
import {
  buildDaylight,
  buildTodayVerdict,
  legalEnd,
  legalStart,
  PA_LEGAL_LIGHT_MINUTES,
} from "@/lib/todayVerdict";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

const forecast: LiveForecast = {
  current: { temperature: "51", windDirection: "S", windSpeed: "4 mph", weather: "Clear", moonPhase: "" },
  sunrise: "7:28 AM",
  sunset: "6:27 PM",
  sunriseIso: "2026-10-18T07:28",
  sunsetIso: "2026-10-18T18:27",
  days: [
    { date: "2026-10-18", label: "Today", high: "", low: "", conditions: "", wind: "S 5 mph", morningWind: "S 3 mph", eveningWind: "SW 7 mph" },
    { date: "2026-10-19", label: "Mon", high: "", low: "", conditions: "", wind: "N 7 mph", morningWind: "NW 6 mph", eveningWind: "N 8 mph" },
  ],
};

function stand(id: string, bestWinds: string): Stand {
  return { id, propertyId: "p", name: id, standType: "Ladder", bestWinds, avoidWinds: "", accessRouteNotes: "", exitRouteNotes: "", notes: "" };
}

const at = (h: number, m = 0) => new Date(2026, 9, 18, h, m);
const base = { forecast, hunts: [] as HuntLogEntry[], pins: [] };

describe("buildTodayVerdict", () => {
  it("plans the evening sit on the evening wind in the afternoon", () => {
    const verdict = buildTodayVerdict({ ...base, now: at(14), stands: [stand("Ridge", "SW"), stand("Creek", "S")] });

    expect(verdict.period).toBe("evening");
    expect(verdict.wind).toBe("SW");
    expect(verdict.headline).toBe("Sit Ridge");
    expect(verdict.detail).toBe("SW wind. Head in by 4:27 PM to be settled.");
  });

  it("plans the morning sit on the morning wind before sunrise", () => {
    const verdict = buildTodayVerdict({ ...base, now: at(5, 30), stands: [stand("Ridge", "SW"), stand("Creek", "S")] });

    expect(verdict.period).toBe("morning");
    expect(verdict.headline).toBe("Sit Creek");
    expect(verdict.detail).toBe("S wind. Be in the stand by 6:43 AM; legal light 6:58 AM.");
  });

  it("plans tomorrow morning after last light", () => {
    const verdict = buildTodayVerdict({ ...base, now: at(19, 30), stands: [stand("Saddle", "NW")] });

    expect(verdict.period).toBe("tomorrow");
    expect(verdict.wind).toBe("NW");
    expect(verdict.headline).toBe("Sit Saddle");
  });

  it("says to head in now when it's past the settle time", () => {
    const verdict = buildTodayVerdict({ ...base, now: at(17, 15), stands: [stand("Ridge", "SW")] });

    expect(verdict.detail).toBe("SW wind. Head in now; legal light ends 6:57 PM.");
  });

  it("recommends resting when no stand fits", () => {
    const verdict = buildTodayVerdict({ ...base, now: at(14), stands: [stand("Ridge", "E")] });

    expect(verdict.headline).toBe("Give the stands a rest");
    expect(verdict.check.pick).toBeNull();
  });

  it("asks for stands when there are none", () => {
    expect(buildTodayVerdict({ ...base, now: at(14), stands: [] }).headline).toBe("Add your stands");
  });

  it("waits for the forecast", () => {
    const verdict = buildTodayVerdict({ ...base, forecast: null, now: at(14), stands: [stand("Ridge", "SW")] });

    expect(verdict.headline).toBe("Reading the wind");
  });
});

describe("buildDaylight", () => {
  it("counts legal light left to legal end (sunset + 30 min)", () => {
    const light = buildDaylight(at(16, 10), forecast.sunriseIso, forecast.sunsetIso);

    expect(light?.label).toBe("2 h 47 m of legal light left");
    expect(light?.legalStartLabel).toBe("6:58 AM");
    expect(light?.legalEndLabel).toBe("6:57 PM");
    expect(light?.sunsetLabel).toBe("6:27 PM");
    expect(light?.isDark).toBe(false);
  });

  it("counts down to legal light before dawn and clamps progress", () => {
    const light = buildDaylight(at(6, 0), forecast.sunriseIso, forecast.sunsetIso);

    expect(light?.label).toBe("Legal light in 58 min");
    expect(light?.progress).toBe(0);
    expect(light?.isDark).toBe(true);
  });

  it("is shootable between legal light and sunrise", () => {
    const light = buildDaylight(at(7, 10), forecast.sunriseIso, forecast.sunsetIso);

    expect(light?.isDark).toBe(false);
    expect(light?.progress).toBeGreaterThan(0);
  });

  it("is still legal just after sunset, gone after legal end", () => {
    expect(buildDaylight(at(18, 45), forecast.sunriseIso, forecast.sunsetIso)?.label).toBe(
      "12 min of legal light left",
    );
    expect(buildDaylight(at(18, 58), forecast.sunriseIso, forecast.sunsetIso)?.label).toBe(
      "Light's gone for today",
    );
  });

  it("reports dark after last light", () => {
    const light = buildDaylight(at(20), forecast.sunriseIso, forecast.sunsetIso);

    expect(light?.label).toBe("Light's gone for today");
    expect(light?.progress).toBe(1);
  });
});

describe("legal shooting light (PA)", () => {
  it("starts 30 min before sunrise and ends 30 min after sunset", () => {
    expect(PA_LEGAL_LIGHT_MINUTES).toEqual({ beforeSunrise: 30, afterSunset: 30 });
    expect(legalStart(at(7, 28))).toEqual(at(6, 58));
    expect(legalEnd(at(18, 27))).toEqual(at(18, 57));
  });
});
