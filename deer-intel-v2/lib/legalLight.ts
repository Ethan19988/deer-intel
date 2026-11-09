import { legalEnd, legalStart, parseForecastLocal } from "@/lib/todayVerdict";
import { forecastClock } from "@/lib/forecastTime";

// The map's legal-light chip: "Legal light in 9h 40m", "Legal end in 32m" or
// "Legal now · ends 5:32 PM", from the forecast's sunrise/sunset and the PA
// legal-light offsets (PA_LEGAL_LIGHT_MINUTES via legalStart/legalEnd).

const DAY_MS = 24 * 60 * 60_000;
/** Inside this many minutes of the end, the chip counts down instead. */
export const LEGAL_END_COUNTDOWN_MINUTES = 60;

export type LegalLightChip = {
  label: string;
  tone: "dark" | "legal" | "ending";
};

// The forecast's local times are read the same way Today reads them.
export { parseForecastLocal };

// On the property's clock: its IANA zone (right on either side of a DST
// change), else the fetch's fixed UTC offset, else the device's zone.
const clockLabel = forecastClock;

/** "9h 40m", "2h", "32m" (rounded up to the minute, never "0m"). */
export function shortDuration(minutes: number): string {
  const total = Math.max(1, Math.ceil(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function legalLightChip(
  now: Date,
  sunriseIso: string | undefined,
  sunsetIso: string | undefined,
  utcOffsetSeconds?: number,
  timeZone?: string,
): LegalLightChip | null {
  const sunrise = parseForecastLocal(sunriseIso, utcOffsetSeconds, timeZone);
  const sunset = parseForecastLocal(sunsetIso, utcOffsetSeconds, timeZone);
  if (!sunrise || !sunset) return null;

  const nowMs = now.getTime();
  // Roll a day forward at a time (tomorrow's sun is within a minute or two of
  // today's) until the legal window ends after now; give up on a stale forecast.
  for (let day = 0; day <= 2; day += 1) {
    const start = legalStart(new Date(sunrise.getTime() + day * DAY_MS));
    const end = legalEnd(new Date(sunset.getTime() + day * DAY_MS));
    if (end.getTime() <= nowMs) continue;

    if (nowMs < start.getTime()) {
      return {
        label: `Legal light in ${shortDuration((start.getTime() - nowMs) / 60_000)}`,
        tone: "dark",
      };
    }

    const minutesLeft = (end.getTime() - nowMs) / 60_000;
    if (minutesLeft <= LEGAL_END_COUNTDOWN_MINUTES) {
      return { label: `Legal end in ${shortDuration(minutesLeft)}`, tone: "ending" };
    }
    return {
      label: `Legal now · ends ${clockLabel(end, utcOffsetSeconds, timeZone)}`,
      tone: "legal",
    };
  }

  return null;
}
