import {
  coldFrontStatus,
  PA_LEGAL_LIGHT_MINUTES,
  type LiveForecast,
} from "@/lib/liveWeather";
import { parseWindCompass } from "@/lib/huntPlanner";
import { buildStandChecks, type StandCheckResult } from "@/lib/standCheck";
import {
  CALM_WIND_MPH,
  getStandWindCheck,
  isCalmWind,
} from "@/lib/standWind";
import { localDateKey } from "@/lib/standPressure";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// The Today headline: which sit is next (this morning, this evening, or
// tomorrow morning), the wind forecast for that sit, the stand to be in, and
// how much light is left. Pure derivation so it can be tested without a clock.

export type SitPeriodKey = "morning" | "evening" | "tomorrow";

export type VerdictChip = { label: string; tone: "good" | "warn" | "info" };

export type DaylightState = {
  /** 0-1 position of "now" between legal start and legal end, clamped. */
  progress: number;
  /** Plain-language status, e.g. "2 h 33 m of legal light left". */
  label: string;
  sunriseLabel: string;
  sunsetLabel: string;
  /** First legal shooting light (sunrise minus the PA offset). */
  legalStartLabel: string;
  /** Last legal shooting light (sunset plus the PA offset). */
  legalEndLabel: string;
  isDark: boolean;
};

export type TodayVerdict = {
  period: SitPeriodKey;
  periodLabel: string;
  /** Compass point the sit is planned against, e.g. "SW". */
  wind: string | undefined;
  /** Speed label that came with that wind, e.g. "7 mph". */
  windSpeed: string | undefined;
  /** The sit wind is under CALM_WIND_MPH: stands grade "Light & variable". */
  calm: boolean;
  headline: string;
  detail: string;
  chips: VerdictChip[];
  check: StandCheckResult;
  daylight: DaylightState | null;
};

// Legal shooting hours (PA: 30 min before sunrise to 30 min after sunset).
// The constant lives in lib/liveWeather so the sit-window winds use it too.
export { PA_LEGAL_LIGHT_MINUTES };
// After this long past sunrise the morning sit is over; plan the evening.
const MORNING_SIT_MINUTES = 150;
// Be settled this long before sunset for an evening sit, and in the stand this
// long before sunrise for a morning sit.
const EVENING_SETTLE_MINUTES = 120;
const MORNING_ARRIVE_MINUTES = 45;

const PERIOD_LABEL: Record<SitPeriodKey, string> = {
  morning: "This morning",
  evening: "This evening",
  tomorrow: "Tomorrow morning",
};

/**
 * Parse an Open-Meteo local "YYYY-MM-DDTHH:MM" (the property's wall clock).
 * With the response's UTC offset it becomes the real instant, so comparisons
 * against `now` hold even when the phone is set to another time zone; without
 * one (older cached snapshots, tests) it falls back to device-local time.
 */
function parseLocal(
  iso: string | undefined,
  utcOffsetSeconds?: number,
): Date | null {
  if (!iso) return null;
  const [date, time = "00:00"] = iso.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (!year || !month || !day) return null;
  if (typeof utcOffsetSeconds === "number" && Number.isFinite(utcOffsetSeconds)) {
    return new Date(
      Date.UTC(year, month - 1, day, hours || 0, minutes || 0) -
        utcOffsetSeconds * 1000,
    );
  }
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

/**
 * "4:27 PM". With the property's UTC offset the time is shown on the
 * property's clock (shift the instant, then format as UTC); otherwise on the
 * device's.
 */
function clock(date: Date, utcOffsetSeconds?: number): string {
  if (typeof utcOffsetSeconds === "number" && Number.isFinite(utcOffsetSeconds)) {
    return new Date(date.getTime() + utcOffsetSeconds * 1000).toLocaleTimeString(
      "en-US",
      { hour: "numeric", minute: "2-digit", timeZone: "UTC" },
    );
  }
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
}

/** First legal shooting light for a sunrise, per PA_LEGAL_LIGHT_MINUTES. */
export function legalStart(sunrise: Date): Date {
  return new Date(sunrise.getTime() - PA_LEGAL_LIGHT_MINUTES.beforeSunrise * 60_000);
}

/** Last legal shooting light for a sunset, per PA_LEGAL_LIGHT_MINUTES. */
export function legalEnd(sunset: Date): Date {
  return new Date(sunset.getTime() + PA_LEGAL_LIGHT_MINUTES.afterSunset * 60_000);
}

export function buildDaylight(
  now: Date,
  sunriseIso: string | undefined,
  sunsetIso: string | undefined,
  utcOffsetSeconds?: number,
): DaylightState | null {
  const sunrise = parseLocal(sunriseIso, utcOffsetSeconds);
  const sunset = parseLocal(sunsetIso, utcOffsetSeconds);
  if (!sunrise || !sunset) return null;

  const legal = { start: legalStart(sunrise), end: legalEnd(sunset) };
  const span = legal.end.getTime() - legal.start.getTime();
  const elapsed = now.getTime() - legal.start.getTime();
  const progress = Math.min(1, Math.max(0, elapsed / span));
  const minutesLeft = (legal.end.getTime() - now.getTime()) / 60_000;
  const minutesToLegal = (legal.start.getTime() - now.getTime()) / 60_000;

  let label: string;
  if (minutesToLegal > 0) {
    label = `Legal light in ${duration(minutesToLegal)}`;
  } else if (minutesLeft > 0) {
    label = `${duration(minutesLeft)} of legal light left`;
  } else {
    label = "Light's gone for today";
  }

  return {
    progress,
    label,
    sunriseLabel: clock(sunrise, utcOffsetSeconds),
    sunsetLabel: clock(sunset, utcOffsetSeconds),
    legalStartLabel: clock(legal.start, utcOffsetSeconds),
    legalEndLabel: clock(legal.end, utcOffsetSeconds),
    isDark: minutesLeft <= 0 || minutesToLegal > 0,
  };
}

function pickPeriod(now: Date, forecast: LiveForecast | null): SitPeriodKey {
  const sunrise = parseLocal(forecast?.sunriseIso, forecast?.utcOffsetSeconds);
  const sunset = parseLocal(forecast?.sunsetIso, forecast?.utcOffsetSeconds);

  if (!sunrise || !sunset) {
    const hour = now.getHours();
    return hour < 10 ? "morning" : hour < 19 ? "evening" : "tomorrow";
  }

  const morningOver = sunrise.getTime() + MORNING_SIT_MINUTES * 60_000;
  const lightEnds = legalEnd(sunset).getTime();

  if (now.getTime() < morningOver) return "morning";
  if (now.getTime() < lightEnds) return "evening";
  return "tomorrow";
}

/**
 * The forecast wind for the planned sit: its compass point and the speed
 * label it came with ("SW 7 mph"). Falls back to current conditions for a sit
 * today without hourly data, and to the daily wind for tomorrow.
 */
function periodWind(
  period: SitPeriodKey,
  forecast: LiveForecast | null,
): { wind: string | undefined; speed: string | undefined } {
  if (!forecast) return { wind: undefined, speed: undefined };

  const today = forecast.days[0];
  const tomorrow = forecast.days[1];
  const fromText = (text: string | undefined) => {
    const wind = text ? (parseWindCompass(text) ?? undefined) : undefined;
    if (!wind) return null;
    // "SW 7 mph" → "7 mph": the point is carried separately. A bare "SW" has
    // no speed at all, so none is shown (not the direction again).
    const rest = (text ?? "").replace(/^\s*[NSEW]{1,3}(?:\s+|$)/i, "").trim();
    return { wind, speed: /\d/.test(rest) ? rest : undefined };
  };
  const current = {
    wind: forecast.current.windDirection || undefined,
    speed: forecast.current.windSpeed || undefined,
  };

  if (period === "morning") return fromText(today?.morningWind) ?? current;
  if (period === "evening") return fromText(today?.eveningWind) ?? current;
  return (
    fromText(tomorrow?.morningWind) ??
    fromText(tomorrow?.wind) ?? { wind: undefined, speed: undefined }
  );
}

/** When to walk in for the planned sit, e.g. "Head in by 4:27 to be settled." */
export function entryAdvice(
  period: SitPeriodKey,
  now: Date,
  forecast: LiveForecast | null,
  wind: string | undefined,
): string {
  const windPart = wind ? `${wind} wind` : "Wind unknown";
  const offset = forecast?.utcOffsetSeconds;
  const sunrise = parseLocal(forecast?.sunriseIso, offset);
  const sunset = parseLocal(forecast?.sunsetIso, offset);

  if (period === "evening" && sunset) {
    const settleBy = new Date(sunset.getTime() - EVENING_SETTLE_MINUTES * 60_000);
    return now.getTime() < settleBy.getTime()
      ? `${windPart}. Head in by ${clock(settleBy, offset)} to be settled.`
      : `${windPart}. Head in now; legal light ends ${clock(legalEnd(sunset), offset)}.`;
  }

  if (sunrise) {
    // Tomorrow's sunrise is within a minute or two of today's.
    const arriveBy = new Date(sunrise.getTime() - MORNING_ARRIVE_MINUTES * 60_000);
    if (period === "tomorrow" || now.getTime() < arriveBy.getTime()) {
      return `${windPart}. Be in the stand by ${clock(arriveBy, offset)}; legal light ${clock(legalStart(sunrise), offset)}.`;
    }
    return `${windPart}. Still good for a late-morning sit.`;
  }

  return `${windPart}.`;
}

export function buildTodayVerdict(input: {
  now: Date;
  forecast: LiveForecast | null;
  stands: Stand[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  rutLabel?: string | null;
  rutActive?: boolean;
}): TodayVerdict {
  const { now, forecast, stands, hunts, pins, rutLabel, rutActive } = input;
  const period = pickPeriod(now, forecast);
  const { wind, speed: windSpeed } = periodWind(period, forecast);
  const calm = Boolean(wind) && isCalmWind(windSpeed);
  const graded = buildStandChecks({
    stands,
    hunts,
    pins,
    wind,
    today: localDateKey(now),
  });
  // A light & variable wind has no dependable direction, so no stand can be
  // the "good wind" pick; every graded stand reads marginal instead.
  const check: StandCheckResult = calm
    ? {
        rows: graded.rows.map((row) => ({
          ...row,
          wind: getStandWindCheck(row.stand, wind, windSpeed),
        })),
        pick: null,
      }
    : graded;
  const pick = check.pick;
  const periodLabel = PERIOD_LABEL[period];

  const chips: VerdictChip[] = [];
  if (pick && wind) chips.push({ label: "Wind fits", tone: "good" });
  if (pick) {
    chips.push({
      label: pick.pressure.label,
      tone: pick.pressure.level === "fresh" ? "good" : "warn",
    });
  }
  if (pick?.scent.status === "clear") {
    chips.push({ label: "Clean walk in", tone: "good" });
  }
  if (coldFrontStatus(forecast?.pressure).isFront) {
    chips.push({ label: "Front moving in", tone: "info" });
  }
  if (rutActive && rutLabel) chips.push({ label: rutLabel, tone: "info" });

  let headline: string;
  let detail: string;

  if (stands.length === 0) {
    headline = "Add your stands";
    detail = "Save stands with their best winds to get a daily pick here.";
  } else if (!forecast) {
    headline = "Reading the wind";
    detail = "Today's pick shows up once the forecast loads.";
  } else if (pick) {
    headline = `Sit ${pick.stand.name}`;
    detail = entryAdvice(period, now, forecast, wind);
  } else if (calm) {
    headline = "Light & variable wind";
    detail = `Under ${CALM_WIND_MPH} mph ${periodLabel.toLowerCase()}, scent drifts with the thermals instead of one way. Pick a stand you can slip into clean, or glass.`;
  } else {
    headline = "Give the stands a rest";
    detail = wind
      ? `No rested stand has a clean ${wind} wind ${periodLabel.toLowerCase()}. Scout or glass instead.`
      : "Wind for the next sit isn't in yet.";
  }

  return {
    period,
    periodLabel,
    wind,
    windSpeed,
    calm,
    headline,
    detail,
    chips,
    check,
    daylight: buildDaylight(
      now,
      forecast?.sunriseIso,
      forecast?.sunsetIso,
      forecast?.utcOffsetSeconds,
    ),
  };
}

// --- Good-wind alert ---------------------------------------------------------

/** Alert at most this long before the planned sit starts... */
export const GOOD_WIND_ALERT_LEAD_MINUTES = 4 * 60;
/** ...and up to this long after it starts (still walking in). */
const GOOD_WIND_ALERT_GRACE_MINUTES = 60;
// The evening sit's wind is averaged from 3 h before sunset (sitWindowHours).
const EVENING_SIT_LEAD_MINUTES = 3 * 60;

/**
 * When the planned sit starts: legal light for a morning sit (tomorrow's is
 * taken as today's + 24 h, within a minute or two), 3 h before sunset for an
 * evening sit. Null without sun times.
 */
export function sitStartTime(
  period: SitPeriodKey,
  forecast: LiveForecast | null,
): Date | null {
  const offset = forecast?.utcOffsetSeconds;

  if (period === "evening") {
    const sunset = parseLocal(forecast?.sunsetIso, offset);
    return sunset
      ? new Date(sunset.getTime() - EVENING_SIT_LEAD_MINUTES * 60_000)
      : null;
  }

  const sunrise = parseLocal(forecast?.sunriseIso, offset);
  if (!sunrise) return null;
  const start = legalStart(sunrise);
  return period === "tomorrow"
    ? new Date(start.getTime() + 24 * 60 * 60_000)
    : start;
}

export type GoodWindAlert = {
  /** Dedupe key: one alert per sit day + AM/PM + stand. */
  key: string;
  title: string;
  body: string;
};

/**
 * The "good wind for a stand" notification for the verdict's next sit, or
 * null when it shouldn't fire: no stand has a good sit wind, or `now` is
 * outside the window from GOOD_WIND_ALERT_LEAD_MINUTES before the sit to an
 * hour after it starts. Uses the verdict's graded rows, so the alert, the
 * headline and the dial agree; the current wind never drives it.
 */
export function buildGoodWindAlert(input: {
  verdict: TodayVerdict;
  forecast: LiveForecast | null;
  now: Date;
  propertyId: string;
  propertyName: string;
}): GoodWindAlert | null {
  const { verdict, forecast, now, propertyId, propertyName } = input;
  if (!forecast || !verdict.wind || verdict.calm) return null;

  const start = sitStartTime(verdict.period, forecast);
  if (!start) return null;

  const minutesToStart = (start.getTime() - now.getTime()) / 60_000;
  if (
    minutesToStart > GOOD_WIND_ALERT_LEAD_MINUTES ||
    minutesToStart < -GOOD_WIND_ALERT_GRACE_MINUTES
  ) {
    return null;
  }

  const good = verdict.check.rows.filter((row) => row.wind.status === "good");
  if (good.length === 0) return null;

  // The pick leads when there is one; rows are already ranked best first.
  const lead = verdict.check.pick ?? good[0];
  const names = [lead, ...good.filter((row) => row.stand.id !== lead.stand.id)]
    .slice(0, 3)
    .map((row) => row.stand.name)
    .join(", ");
  const extra = good.length > 3 ? " and more" : "";
  const sitDay = sitDateKey(verdict.period, forecast, now);
  const sit = verdict.period === "evening" ? "PM" : "AM";
  const when = verdict.period === "evening"
    ? "tonight"
    : verdict.period === "tomorrow"
      ? "tomorrow morning"
      : "this morning";

  return {
    key: `goodwind:${propertyId}:${sitDay}:${sit}:${lead.stand.id}`,
    title: "Good wind for a stand",
    body: `${propertyName}: a ${verdict.wind} wind ${when} favors ${names}${extra}.`,
  };
}

/** "YYYY-MM-DD" of the planned sit (the forecast's day, +1 for tomorrow). */
function sitDateKey(
  period: SitPeriodKey,
  forecast: LiveForecast,
  now: Date,
): string {
  const index = period === "tomorrow" ? 1 : 0;
  const fromForecast = forecast.days[index]?.date;
  if (fromForecast) return fromForecast;

  const day = new Date(now);
  if (period === "tomorrow") day.setDate(day.getDate() + 1);
  return localDateKey(day);
}
