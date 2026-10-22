// Movement timeline: the next day and a half split into the time-of-day
// windows the movement model scores (dawn, midday, dusk, night), each with the
// wind forecast for that window. The map uses the selected window to redraw
// the Movement layer, the stand scent cones and the thermal cue, so a hunter
// can scrub tonight and tomorrow morning instead of only seeing "right now".

import type { ForecastDay } from "@/lib/liveWeather";
import type { MovementPeriod } from "@/lib/movementPrediction";
import { clockToMinutes, parseWindSpeed, thermalCue, type ThermalCue } from "@/lib/windViz";

export type TimelineSlot = {
  /** Stable id, e.g. "2026-10-21-dusk". */
  key: string;
  /** 0 = today, 1 = tomorrow, ... */
  dayIndex: number;
  /** Short day label for the strip: "TONIGHT", "TODAY", "THU". */
  dayLabel: string;
  period: MovementPeriod;
  /** True for the window happening right now (uses live conditions). */
  isNow: boolean;
  windFromCompass: string;
  windMph: number | null;
  /** Day high as the forecast string (e.g. "58°F"), for the movement score. */
  temperature?: string;
  pressureTrend?: "rising" | "steady" | "falling";
  conditions?: string;
  thermal: ThermalCue;
};

const PERIOD_ORDER: MovementPeriod[] = ["dawn", "midday", "dusk", "night"];

export const PERIOD_SHORT: Record<MovementPeriod, string> = {
  dawn: "DAWN",
  midday: "MID",
  dusk: "DUSK",
  night: "NIGHT",
};

/** "NW 8 mph" → { compass: "NW", mph: 8 }; tolerates "Calm" and blanks. */
export function parseWindText(text: string | undefined): { compass: string; mph: number | null } {
  const value = (text ?? "").trim();
  if (!value) return { compass: "", mph: null };
  const compass = /^([NESW]{1,3})\b/i.exec(value)?.[1]?.toUpperCase() ?? "";
  return { compass, mph: parseWindSpeed(value) };
}

/** A representative clock time inside a window, for the thermal cue. */
function representativeMinutes(
  period: MovementPeriod,
  sunriseMin: number,
  sunsetMin: number,
): number {
  switch (period) {
    case "dawn":
      return sunriseMin + 30;
    case "midday":
      return Math.round((sunriseMin + sunsetMin) / 2);
    case "dusk":
      return sunsetMin - 30;
    case "night":
      return Math.min(sunsetMin + 120, 23 * 60 + 30);
  }
}

function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

type BuildInput = {
  /** The window happening now (from currentMovementPeriod). */
  currentPeriod: MovementPeriod;
  /** Forecast days, today first. */
  days: ForecastDay[];
  /** Today's sunrise / sunset as the forecast gives them ("6:12 AM" or ISO). */
  sunrise: string;
  sunset: string;
  /** Live conditions for the current window. */
  liveWindFromCompass: string;
  liveWindMph: number | null;
  liveTemperature?: string;
  livePressureTrend?: "rising" | "steady" | "falling";
  liveConditions?: string;
  /** How many windows to show. */
  count?: number;
};

/**
 * Build the strip of windows starting at the one happening now. Dawn uses the
 * day's morning-sit wind, dusk and night the evening-sit wind, midday the
 * day's dominant wind; the current window uses the live reading.
 */
export function buildMovementTimeline(input: BuildInput): TimelineSlot[] {
  const count = input.count ?? 7;
  const sunriseMin = clockToMinutes(input.sunrise);
  const sunsetMin = clockToMinutes(input.sunset);
  if (sunriseMin === null || sunsetMin === null || input.days.length === 0) return [];

  const slots: TimelineSlot[] = [];
  let dayIndex = 0;
  let periodIndex = PERIOD_ORDER.indexOf(input.currentPeriod);
  // Before dawn, "night" is the night that's ending: lead with today's dawn.
  if (input.currentPeriod === "night") {
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < sunriseMin) {
      periodIndex = PERIOD_ORDER.indexOf("dawn");
    }
  }

  while (slots.length < count && dayIndex < input.days.length) {
    const day = input.days[dayIndex];
    const period = PERIOD_ORDER[periodIndex];
    const isNow = slots.length === 0;

    const windText =
      period === "dawn"
        ? day.morningWind ?? day.wind
        : period === "midday"
          ? day.wind
          : day.eveningWind ?? day.wind;
    const parsed = parseWindText(windText);
    const windFromCompass = isNow && input.liveWindFromCompass ? input.liveWindFromCompass : parsed.compass;
    const windMph = isNow && input.liveWindMph !== null ? input.liveWindMph : parsed.mph;

    // A clock time inside the window, used only to read the thermal phase.
    const minutes = representativeMinutes(period, sunriseMin, sunsetMin);
    const at = new Date();
    at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const thermal = thermalCue(at, input.sunrise, input.sunset);

    const dayLabel =
      dayIndex === 0
        ? period === "dusk" || period === "night"
          ? "TONIGHT"
          : "TODAY"
        : weekdayLabel(day.date) || `DAY ${dayIndex + 1}`;

    slots.push({
      key: `${day.date}-${period}`,
      dayIndex,
      dayLabel,
      period,
      isNow,
      windFromCompass,
      windMph,
      temperature: isNow ? input.liveTemperature ?? day.high : day.high,
      pressureTrend: isNow ? input.livePressureTrend ?? day.pressureTrend : day.pressureTrend,
      conditions: isNow ? input.liveConditions ?? day.conditions : day.conditions,
      thermal,
    });

    periodIndex += 1;
    if (periodIndex >= PERIOD_ORDER.length) {
      periodIndex = 0;
      dayIndex += 1;
    }
  }

  return slots;
}

/** "Above normal" style read from the 1-5 movement score. */
export function movementDayRead(score: number): string {
  if (score >= 4.5) return "Above normal";
  if (score >= 3.5) return "Normal+";
  if (score <= 1.5) return "Well below normal";
  if (score <= 2.5) return "Below normal";
  return "Normal";
}
