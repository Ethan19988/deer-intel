import { coldFrontStatus, type LiveForecast } from "@/lib/liveWeather";
import { parseWindCompass } from "@/lib/huntPlanner";
import { buildStandChecks, type StandCheckResult } from "@/lib/standCheck";
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
  /** 0-1 position of "now" between sunrise and last light, clamped. */
  progress: number;
  /** Plain-language status, e.g. "2 h 33 m of light left". */
  label: string;
  sunriseLabel: string;
  lastLightLabel: string;
  isDark: boolean;
};

export type TodayVerdict = {
  period: SitPeriodKey;
  periodLabel: string;
  /** Compass point the sit is planned against, e.g. "SW". */
  wind: string | undefined;
  headline: string;
  detail: string;
  chips: VerdictChip[];
  check: StandCheckResult;
  daylight: DaylightState | null;
};

// Last light is taken as 30 minutes after sunset (deer hunting hours in
// Pennsylvania and most states end then). Check your state's regulations.
export const LAST_LIGHT_MINUTES = 30;
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

/** Parse an Open-Meteo local "YYYY-MM-DDTHH:MM" as a device-local Date. */
function parseLocal(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [date, time = "00:00"] = iso.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

function clock(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
}

export function buildDaylight(
  now: Date,
  sunriseIso: string | undefined,
  sunsetIso: string | undefined,
): DaylightState | null {
  const sunrise = parseLocal(sunriseIso);
  const sunset = parseLocal(sunsetIso);
  if (!sunrise || !sunset) return null;

  const lastLight = new Date(sunset.getTime() + LAST_LIGHT_MINUTES * 60_000);
  const span = lastLight.getTime() - sunrise.getTime();
  const elapsed = now.getTime() - sunrise.getTime();
  const progress = Math.min(1, Math.max(0, elapsed / span));
  const minutesLeft = (lastLight.getTime() - now.getTime()) / 60_000;
  const minutesToSunrise = (sunrise.getTime() - now.getTime()) / 60_000;

  let label: string;
  if (minutesToSunrise > 0) {
    label = `Sunrise in ${duration(minutesToSunrise)}`;
  } else if (minutesLeft > 0) {
    label = `${duration(minutesLeft)} of light left`;
  } else {
    label = "Light's gone for today";
  }

  return {
    progress,
    label,
    sunriseLabel: clock(sunrise),
    lastLightLabel: clock(lastLight),
    isDark: minutesLeft <= 0 || minutesToSunrise > 0,
  };
}

function pickPeriod(now: Date, forecast: LiveForecast | null): SitPeriodKey {
  const sunrise = parseLocal(forecast?.sunriseIso);
  const sunset = parseLocal(forecast?.sunsetIso);

  if (!sunrise || !sunset) {
    const hour = now.getHours();
    return hour < 10 ? "morning" : hour < 19 ? "evening" : "tomorrow";
  }

  const morningOver = sunrise.getTime() + MORNING_SIT_MINUTES * 60_000;
  const lastLight = sunset.getTime() + LAST_LIGHT_MINUTES * 60_000;

  if (now.getTime() < morningOver) return "morning";
  if (now.getTime() < lastLight) return "evening";
  return "tomorrow";
}

function periodWind(
  period: SitPeriodKey,
  forecast: LiveForecast | null,
): string | undefined {
  if (!forecast) return undefined;

  const today = forecast.days[0];
  const tomorrow = forecast.days[1];
  const fromText = (text: string | undefined) =>
    text ? (parseWindCompass(text) ?? undefined) : undefined;

  if (period === "morning") {
    return fromText(today?.morningWind) ?? forecast.current.windDirection;
  }
  if (period === "evening") {
    return fromText(today?.eveningWind) ?? forecast.current.windDirection;
  }
  return fromText(tomorrow?.morningWind) ?? fromText(tomorrow?.wind);
}

/** When to walk in for the planned sit, e.g. "Head in by 4:27 to be settled." */
export function entryAdvice(
  period: SitPeriodKey,
  now: Date,
  forecast: LiveForecast | null,
  wind: string | undefined,
): string {
  const windPart = wind ? `${wind} wind` : "Wind unknown";
  const sunrise = parseLocal(forecast?.sunriseIso);
  const sunset = parseLocal(forecast?.sunsetIso);

  if (period === "evening" && sunset) {
    const settleBy = new Date(sunset.getTime() - EVENING_SETTLE_MINUTES * 60_000);
    return now.getTime() < settleBy.getTime()
      ? `${windPart}. Head in by ${clock(settleBy)} to be settled.`
      : `${windPart}. Head in now; light ends ${clock(new Date(sunset.getTime() + LAST_LIGHT_MINUTES * 60_000))}.`;
  }

  if (sunrise) {
    // Tomorrow's sunrise is within a minute or two of today's.
    const arriveBy = new Date(sunrise.getTime() - MORNING_ARRIVE_MINUTES * 60_000);
    if (period === "tomorrow" || now.getTime() < arriveBy.getTime()) {
      return `${windPart}. Be in the stand by ${clock(arriveBy)}.`;
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
  const wind = periodWind(period, forecast);
  const check = buildStandChecks({
    stands,
    hunts,
    pins,
    wind,
    today: localDateKey(now),
  });
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
    headline,
    detail,
    chips,
    check,
    daylight: buildDaylight(now, forecast?.sunriseIso, forecast?.sunsetIso),
  };
}
