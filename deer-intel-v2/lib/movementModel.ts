// One deer-movement model for the whole app (Today's gauge and outlook, and the
// map's period forecast), so they can't disagree and can't drift optimistic.
//
// Calibration: an ordinary day scores 0 points and reads "Fair". Weights follow
// the GPS-collar research rather than hunting lore:
// - The rut is the biggest driver (Mississippi State, 48 collared bucks: peak-
//   rut bucks traveled ~142 yd/hr more and bedded ~12% less).
// - Temperature swings and fronts have real but modest effects (Penn State's
//   Deer-Forest Study and Auburn found little change), so they're scaled down.
// - Rain cuts buck movement (Deer-Forest: up to half on rainy days).
// - Wind: PA bucks moved least in dead-calm air and more as wind rose, so
//   strong wind is not penalized; calm is a small minus.
// - Moon phase showed no measurable effect (Mississippi State), so it's shown
//   for reference but doesn't change the score.

import type { RutPhase } from "@/lib/seasonCalendar";

export type MovementPeriodInput = "dawn" | "midday" | "dusk" | "night";

export type MovementModelInput = {
  /** Air temperature in °F (current, or the day's high for an outlook day). */
  tempF: number | null;
  /** Today's high minus the average high of the last few days, in °F. */
  tempDepartureF?: number | null;
  pressureTrend?: "rising" | "steady" | "falling";
  /** Barometer drop over the recent window in inHg (positive = falling). */
  pressureDropInHg?: number | null;
  windMph: number | null;
  /** Sky/precip text from the forecast, e.g. "Heavy rain", "Overcast". */
  conditions?: string;
  moonIllumination?: number | null;
  rutPhase?: RutPhase;
  /** Only for time-of-day forecasts (the map); omit for a whole-day rating. */
  period?: MovementPeriodInput;
  /** Extra points from the property's own camera history (about -1.5..+1.5). */
  propertyBump?: number;
  /** Month 0-11, for "warm for the season" when no departure is known. */
  month?: number;
};

export type MovementFactor = {
  text: string;
  effect: "up" | "down" | "neutral";
  /** Points this factor added or removed. */
  weight: number;
};

export type MovementModelResult = {
  /** 1 (tough) to 5 (prime). */
  score: number;
  points: number;
  label: string;
  tone: "good" | "fair" | "slow";
  factors: MovementFactor[];
};

const FRONT_DROP_INHG = 0.06;

function push(factors: MovementFactor[], text: string, points: number) {
  factors.push({
    text,
    effect: points > 0 ? "up" : points < 0 ? "down" : "neutral",
    weight: points,
  });
}

/** Typical PA fall daytime highs by month, for judging "warm" without history. */
const WARM_FOR_MONTH_F: Record<number, number> = {
  8: 80, // Sep
  9: 68, // Oct
  10: 58, // Nov
  11: 48, // Dec
  0: 45, // Jan
};

export function scoreMovement(input: MovementModelInput): MovementModelResult {
  let points = 0;
  const factors: MovementFactor[] = [];
  const add = (delta: number, text: string) => {
    points += delta;
    push(factors, text, delta);
  };

  // --- Temperature: the strongest daily signal -------------------------------
  const departure = input.tempDepartureF;
  if (departure !== null && departure !== undefined && Number.isFinite(departure)) {
    const d = Math.round(Math.abs(departure));
    if (departure <= -10) add(0.75, `Cold snap, ${d}° cooler than recent days`);
    else if (departure <= -5) add(0.5, `Cooler than recent days (${d}°)`);
    else if (departure >= 10) add(-0.75, `Warm spell, ${d}° above recent days`);
    else if (departure >= 5) add(-0.5, `Warmer than recent days (${d}°)`);
  } else if (input.tempF !== null && input.month !== undefined) {
    const warm = WARM_FOR_MONTH_F[input.month];
    if (warm !== undefined) {
      if (input.tempF >= warm + 8) add(-0.75, `Hot for the season (${Math.round(input.tempF)}°)`);
      else if (input.tempF >= warm) add(-0.4, `Warm for the season (${Math.round(input.tempF)}°)`);
      else if (input.tempF <= warm - 20) add(0.4, `Cold for the season (${Math.round(input.tempF)}°)`);
    }
  }

  // --- Pressure / fronts ------------------------------------------------------
  const drop = input.pressureDropInHg;
  if (input.pressureTrend === "falling") {
    if (drop !== null && drop !== undefined && drop >= FRONT_DROP_INHG) {
      add(0.5, "Front moving in (falling barometer)");
    } else {
      add(0.25, "Barometer easing down");
    }
  } else if (input.pressureTrend === "rising" && (departure ?? 0) <= -5) {
    // Cold, clearing high pressure right behind a front is a classic good sit.
    add(0.5, "Cool, clearing air behind the front");
  }

  // --- Rut ----------------------------------------------------------------------
  switch (input.rutPhase) {
    case "seeking":
      add(1.25, "Seeking phase: bucks cruising in daylight");
      break;
    case "chasing":
      add(1.5, "Chasing phase: bucks on their feet all day");
      break;
    case "peak":
      add(1.25, "Peak rut: bucks covering the most ground of the year");
      break;
    case "lockdown":
      add(-0.5, "Lockdown: bucks tied up with does");
      break;
    case "pre-rut":
      add(0.25, "Pre-rut: scraping and rubbing picking up");
      break;
    default:
      break;
  }

  // --- Wind -----------------------------------------------------------------
  if (input.windMph !== null) {
    if (input.windMph < 3) add(-0.25, "Dead calm: bucks moved least in calm air (Penn State)");
    else if (input.windMph > 25) {
      // Collar data doesn't show strong wind stopping movement; it mostly makes
      // deer harder to hear and see, so it's a note, not a penalty.
      push(factors, `Very windy (${Math.round(input.windMph)} mph): harder hunting, deer still move`, 0);
    }
  }

  // --- Precipitation ------------------------------------------------------------
  const sky = (input.conditions ?? "").toLowerCase();
  if (/thunder|heavy rain|violent|heavy showers/.test(sky)) add(-1, "Heavy rain or storms");
  else if (/rain|showers/.test(sky) && !/light|drizzle/.test(sky)) add(-0.75, "Steady rain: bucks cut movement");

  // --- Moon (weak signal) -------------------------------------------------------
  const moon = input.moonIllumination;
  if (moon !== null && moon !== undefined) {
    // Shown for reference only: collar studies found no measurable effect.
    if (moon >= 85) push(factors, "Full moon (collar studies show little effect)", 0);
    else if (moon <= 15) push(factors, "New moon (collar studies show little effect)", 0);
  }

  // --- Time of day (map period forecasts only) ------------------------------
  if (input.period) {
    const rutDay = input.rutPhase === "seeking" || input.rutPhase === "chasing" || input.rutPhase === "peak";
    if (input.period === "dawn" || input.period === "dusk") {
      add(0.75, `${input.period === "dawn" ? "Dawn" : "Dusk"}: prime low-light window`);
    } else if (input.period === "midday") {
      add(rutDay ? -0.25 : -1, rutDay ? "Midday (rut keeps some bucks moving)" : "Midday lull");
    } else {
      add(-1, "After dark: outside shooting hours");
    }
  }

  // --- The property's own camera history ------------------------------------------
  if (input.propertyBump) {
    const bump = input.propertyBump * 0.75;
    points += bump;
    push(
      factors,
      bump > 0 ? "Your cameras: busier than usual at this time" : "Your cameras: quieter than usual at this time",
      bump,
    );
  }

  const score =
    points >= 2 ? 5 : points >= 1 ? 4 : points >= -0.5 ? 3 : points >= -1.5 ? 2 : 1;

  if (!factors.some((factor) => factor.weight !== 0)) {
    factors.unshift({ text: "Nothing unusual: a typical day", effect: "neutral", weight: 0 });
  }

  return {
    score,
    points,
    label: LABELS[score],
    tone: score >= 4 ? "good" : score === 3 ? "fair" : "slow",
    // Strongest effects first.
    factors: [...factors].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
  };
}

const LABELS: Record<number, string> = {
  5: "Prime: deer on their feet",
  4: "Good movement likely",
  3: "Fair: a normal day",
  2: "Slow going",
  1: "Tough sit",
};

/** °F from a forecast temperature string in the given unit ("51", "11 °C"). */
export function toFahrenheit(value: string | undefined, unit: "F" | "C"): number | null {
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return unit === "C" ? n * 1.8 + 32 : n;
}

/** mph from a forecast wind string ("SW 8 mph", "12 km/h"). */
export function toMph(value: string | undefined): number | null {
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return /km/i.test(String(value)) ? n * 0.621 : n;
}

/** Average of numeric values, or null when there are none. */
export function averageOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

// --- Day-by-day outlook from the forecast ---------------------------------------

export type OutlookDayInput = {
  date: string;
  label: string;
  high: string;
  conditions: string;
  wind: string;
  morningWind?: string;
  eveningWind?: string;
  pressureTrend?: "rising" | "steady" | "falling";
};

export type MovementOutlookDay = { date: string; label: string; result: MovementModelResult };

/**
 * Rate each forecast day. Temperature is judged against the average high of
 * the days before today (from weather history), which is what makes a cold
 * snap or a warm spell show up. Wind is the average of the dawn and dusk sit
 * winds when known (that's when you're hunting), else most of the daily max.
 */
export function buildMovementOutlook(input: {
  days: OutlookDayInput[];
  /** Recent daily highs before today, in the same unit as the forecast. */
  recentHighs: Array<string | undefined>;
  tempUnit: "F" | "C";
  /** Today's barometer drop (inHg), from the hourly trace. */
  todayPressureDropInHg?: number | null;
  rutPhaseFor?: (dateISO: string) => RutPhase | undefined;
  moonFor?: (dateISO: string) => number | null;
}): MovementOutlookDay[] {
  const baseline = averageOf(input.recentHighs.map((high) => toFahrenheit(high, input.tempUnit)));

  return input.days.map((day, index) => {
    const highF = toFahrenheit(day.high, input.tempUnit);
    const sitWinds = [toMph(day.morningWind), toMph(day.eveningWind)];
    const dailyMax = toMph(day.wind);
    const windMph =
      averageOf(sitWinds) ?? (dailyMax === null ? null : dailyMax * 0.75);
    const month = Number(day.date.slice(5, 7)) - 1;

    return {
      date: day.date,
      label: day.label,
      result: scoreMovement({
        tempF: highF,
        tempDepartureF: highF !== null && baseline !== null ? highF - baseline : null,
        pressureTrend: day.pressureTrend,
        pressureDropInHg: index === 0 ? input.todayPressureDropInHg : null,
        windMph,
        conditions: day.conditions,
        moonIllumination: input.moonFor?.(day.date) ?? null,
        rutPhase: input.rutPhaseFor?.(day.date),
        month: Number.isFinite(month) ? month : undefined,
      }),
    };
  });
}
