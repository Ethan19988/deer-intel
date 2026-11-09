// What AI Scout is planning for: today's date, the next sit (the same call
// Today makes, via lib/todayVerdict), that sit's forecast wind and legal light,
// and where the rut stands. Pure so it can be unit-tested.

import type { LiveForecast } from "@/lib/liveWeather";
import type { SeasonContext } from "@/lib/seasonCalendar";
import { localDateKey } from "@/lib/standPressure";
import type { TodayVerdict } from "@/lib/todayVerdict";
import type { AiScoutSeasonContext, AiScoutTargetSit } from "@/types/aiScout";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-09 (Mon)" on the device clock. */
export function aiScoutToday(now: Date): string {
  return `${localDateKey(now)} (${WEEKDAY[now.getDay()]})`;
}

/** A bare forecast number ("44") with its unit ("44°F"); text passes through. */
export function withTemperatureUnit(value: string | undefined, unitLabel: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}${unitLabel}` : trimmed;
}

/**
 * The planned sit from the Today verdict: which sit, the forecast wind
 * averaged over that sit window, the day's high/low, and that day's sun and
 * legal-light times (tomorrow's own for a tomorrow-morning sit).
 */
export function buildAiScoutTargetSit(input: {
  verdict: Pick<TodayVerdict, "period" | "periodLabel" | "wind" | "windSpeed" | "calm" | "daylight">;
  forecast: LiveForecast | null;
  temperatureUnitLabel: string;
}): AiScoutTargetSit {
  const { verdict, forecast, temperatureUnitLabel } = input;
  const day = verdict.period === "tomorrow" ? "tomorrow" : "today";
  const period = verdict.period === "evening" ? "evening" : "morning";
  const forecastDay = forecast?.days?.[day === "tomorrow" ? 1 : 0];
  const daylight = verdict.daylight;

  const sit: AiScoutTargetSit = { period, day, label: verdict.periodLabel };
  if (forecastDay?.date) sit.date = forecastDay.date;
  if (verdict.wind) sit.forecastWind = verdict.wind;
  if (verdict.windSpeed) sit.forecastWindSpeed = verdict.windSpeed;
  if (verdict.calm) sit.calmWind = true;
  const high = withTemperatureUnit(forecastDay?.high, temperatureUnitLabel);
  const low = withTemperatureUnit(forecastDay?.low, temperatureUnitLabel);
  if (high) sit.dayHigh = high;
  if (low) sit.dayLow = low;
  if (daylight) {
    sit.sunrise = daylight.sunriseLabel;
    sit.sunset = daylight.sunsetLabel;
    sit.legalStart = daylight.legalStartLabel;
    sit.legalEnd = daylight.legalEndLabel;
  }
  return sit;
}

/** Rut phase and countdown for the scout. */
export function buildAiScoutSeason(
  season: Pick<SeasonContext, "phaseLabel" | "phaseHint" | "daysToPeak" | "peakIsCustom">,
): AiScoutSeasonContext {
  return {
    rutPhase: season.phaseLabel,
    ...(season.phaseHint ? { rutPhaseHint: season.phaseHint } : {}),
    daysToPeak: season.daysToPeak,
    peakIsEstimate: !season.peakIsCustom,
  };
}
