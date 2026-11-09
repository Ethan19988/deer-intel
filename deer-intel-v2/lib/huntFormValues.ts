import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";
import type { WeatherSource } from "@/types/weather";
import { createWeatherSnapshot } from "@/lib/weather";

export type YesNoValue = "No" | "Yes";

export type HuntFormValues = {
  propertyId: string;
  standId: string;
  date: string;
  startTime: string;
  endTime: string;
  windDirection: string;
  windSpeed: string;
  temperature: string;
  weather: string;
  moonPhase: string;
  weatherSource: WeatherSource;
  bucks: string;
  does: string;
  fawns: string;
  shotOpportunity: YesNoValue;
  harvest: YesNoValue;
  notes: string;
  /**
   * Tracked bucks seen on this sit (deer profile ids). Optional so older
   * callers and stored drafts without it still type-check; unset reads as none.
   */
  deerProfileIds?: string[];
};

export const EMPTY_HUNT_FORM_VALUES: HuntFormValues = {
  propertyId: "",
  standId: "",
  date: "",
  startTime: "",
  endTime: "",
  windDirection: "",
  windSpeed: "",
  temperature: "",
  weather: "",
  moonPhase: "",
  weatherSource: "manual",
  bucks: "",
  does: "",
  fawns: "",
  shotOpportunity: "No",
  harvest: "No",
  notes: "",
};

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

/** Local "YYYY-MM-DD" for a date input. */
export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

/** Local "HH:MM" for a time input. */
export function formatTimeInput(date: Date) {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

/**
 * A fresh form with today's date, in local time, so there's no date to pick on
 * a phone keyboard. By default the current time is the start ("logging a sit
 * right now"); pass `startNow: false` for a sit logged after the fact, where
 * In and Out are left for the hunter (see sitPeriodTimes) instead of guessed.
 */
export function newHuntFormValues(
  now: Date = new Date(),
  keep: Partial<Pick<HuntFormValues, "propertyId" | "standId">> = {},
  { startNow = true }: { startNow?: boolean } = {},
): HuntFormValues {
  return {
    ...EMPTY_HUNT_FORM_VALUES,
    ...keep,
    date: formatDateInput(now),
    startTime: startNow ? formatTimeInput(now) : "",
  };
}

export type SitPeriod = "morning" | "evening";

// Typical sit windows. When the hunter logs during or just after the window,
// Out is "now"; otherwise it's the window's usual end.
const SIT_PERIODS: Record<SitPeriod, { start: string; end: string; latest: string }> = {
  morning: { start: "06:00", end: "10:00", latest: "13:00" },
  evening: { start: "15:00", end: "18:00", latest: "21:00" },
};

/** Date and In/Out for a "This morning" / "This evening" quick pick. */
export function sitPeriodTimes(
  period: SitPeriod,
  now: Date = new Date(),
): Pick<HuntFormValues, "date" | "startTime" | "endTime"> {
  const range = SIT_PERIODS[period];
  const nowTime = formatTimeInput(now);
  // "HH:MM" strings compare correctly as text.
  const endsNow = nowTime > range.start && nowTime <= range.latest;

  return {
    date: formatDateInput(now),
    startTime: range.start,
    endTime: endsNow ? nowTime : range.end,
  };
}

type CreateHuntFromValuesInput = {
  id: string;
  values: HuntFormValues;
  stands: Stand[];
  /**
   * When editing a saved sit whose stand has since been deleted, the name it
   * was saved with. The sit keeps that stand id and name so it can still be
   * saved, instead of failing silently.
   */
  fallbackStandName?: string;
};

export function createHuntFromValues({
  id,
  values,
  stands,
  fallbackStandName,
}: CreateHuntFromValuesInput): HuntLogEntry | null {
  const propertyId = values.propertyId.trim();
  const standId = values.standId.trim();
  const date = values.date.trim();
  const stand = stands.find(
    (item) => item.id === standId && item.propertyId === propertyId,
  );
  // Only a stand that no longer exists anywhere falls back; a stand that
  // belongs to another property is still a mismatch.
  const standDeleted =
    fallbackStandName !== undefined && !stands.some((item) => item.id === standId);
  const standName = stand ? stand.name : standDeleted ? fallbackStandName : null;

  if (!propertyId || !standId || standName === null || !date) return null;

  return {
    id,
    propertyId,
    standId,
    standName,
    date,
    startTime: values.startTime.trim(),
    endTime: values.endTime.trim(),
    windDirection: values.windDirection.trim(),
    windSpeed: values.windSpeed.trim(),
    temperature: values.temperature.trim(),
    weather: values.weather.trim(),
    moonPhase: values.moonPhase.trim(),
    weatherSnapshot: createWeatherSnapshot({
      temperature: values.temperature,
      windDirection: values.windDirection,
      windSpeed: values.windSpeed,
      conditions: values.weather,
      moonPhase: values.moonPhase,
      source: values.weatherSource,
    }),
    bucks: countFromString(values.bucks),
    does: countFromString(values.does),
    fawns: countFromString(values.fawns),
    shotOpportunity: values.shotOpportunity === "Yes",
    harvest: values.harvest === "Yes",
    notes: values.notes.trim(),
    ...withDeerProfileIds(values.deerProfileIds),
  };
}

/** Trimmed, deduped buck ids, empties dropped. */
export function cleanDeerProfileIds(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

// Only sits that tag a buck carry the field, so an untagged sit saves exactly
// as it did before buck tagging existed.
function withDeerProfileIds(
  ids: readonly string[] | undefined,
): Pick<HuntLogEntry, "deerProfileIds"> {
  const clean = cleanDeerProfileIds(ids);

  return clean.length > 0 ? { deerProfileIds: clean } : {};
}

/**
 * A saved sit's tagged bucks back onto edit-form values. Pairs with
 * huntFormValuesFromHunt, which predates buck tagging and doesn't copy them.
 */
export function withHuntDeerProfileIds(
  values: HuntFormValues,
  hunt: Pick<HuntLogEntry, "deerProfileIds">,
): HuntFormValues {
  return { ...values, deerProfileIds: cleanDeerProfileIds(hunt.deerProfileIds) };
}

function countFromString(value: string) {
  const parsedValue = Number(value.trim());

  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;

  return Math.floor(parsedValue);
}
