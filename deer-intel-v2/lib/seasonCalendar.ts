"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_RUT_LATITUDE,
  rutRegionLabel,
  rutShiftDays,
} from "@/lib/movementPrediction";

// The hunter's own season calendar: when their season opens and when the local
// rut peaks. Device-local, like the theme / units / map preferences — its own
// localStorage key, kept out of the synced store.
//
// Deer Intel already estimates the rut from latitude (movementPrediction), but
// that is deliberately coarse ("southern rut timing is genuinely variable") and
// is only ever used inside the movement model — a hunter never sees it. This
// lets them pin their KNOWN local peak (from experience or a state biologist)
// and surfaces a phase + countdown. Dates are treated as month/day and projected
// to the nearest season, so last year's entry keeps working this year — the same
// year-agnostic approach the movement model uses.

export const SEASON_STORAGE_KEY = "deer-intel:season-calendar";

export type SeasonCalendarPrefs = {
  /** ISO "YYYY-MM-DD" the hunter's season opens, or null if unset. */
  seasonOpener: string | null;
  /** ISO "YYYY-MM-DD" of the local rut peak, or null to use the estimate. */
  rutPeak: string | null;
};

export const DEFAULT_SEASON_CALENDAR: SeasonCalendarPrefs = {
  seasonOpener: null,
  rutPeak: null,
};

export type RutPhase =
  | "off-season"
  | "early"
  | "pre-rut"
  | "seeking"
  | "chasing"
  | "peak"
  | "lockdown"
  | "post-rut"
  | "late";

type PhaseMeta = { label: string; hint: string };

// Sub-phases are finer than the movement model's early/pre-rut/rut/post-rut/late
// on purpose: the daily readout is where the extra granularity (seeking vs.
// chasing vs. lockdown) actually helps a hunter decide when to sit.
const PHASE_META: Record<RutPhase, PhaseMeta> = {
  "off-season": {
    label: "Off-season",
    hint: "Out of season. Scout, run cameras, and prep stands for the fall.",
  },
  early: {
    label: "Early season",
    hint: "Deer are on predictable food patterns. Hunt evening food sources and clean entry/exit.",
  },
  "pre-rut": {
    label: "Pre-rut",
    hint: "Bucks expanding their range and making sign. Hunt rub lines and scrapes on food-to-bed routes.",
  },
  seeking: {
    label: "Seeking",
    hint: "Bucks on their feet looking for the first hot does. Hunt pinch points near doe bedding; midday movement picks up.",
  },
  chasing: {
    label: "Chasing",
    hint: "Prime daylight action. Sit all day near doe concentrations and terrain funnels.",
  },
  peak: {
    label: "Peak rut",
    hint: "Bucks locked with does — mature movement can slow. Target areas with unbred does.",
  },
  lockdown: {
    label: "Lockdown",
    hint: "Most does bred; movement is patchy. Stay in doe country and be patient.",
  },
  "post-rut": {
    label: "Post-rut",
    hint: "Bucks refeeding to recover. Return to food sources; watch for a second rut around a month after peak.",
  },
  late: {
    label: "Late season",
    hint: "Cold-weather food rules. Hunt afternoons on the best remaining forage.",
  },
};

export function rutPhaseLabel(phase: RutPhase): string {
  return PHASE_META[phase].label;
}

export function rutPhaseHint(phase: RutPhase): string {
  return PHASE_META[phase].hint;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (positive when `to` is later), at local midnight. */
function dayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function parseISODate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The occurrence of a month/day nearest to `now` — checking the prior, current,
 * and next year so a date is never a year stale. Anchors the whole calendar to
 * "this season" regardless of what year was typed in.
 */
function nearestOccurrence(month: number, day: number, now: Date): Date {
  const base = now.getFullYear();
  let best: Date | null = null;

  for (const year of [base - 1, base, base + 1]) {
    const candidate = new Date(year, month, day);
    if (!best || Math.abs(dayDiff(now, candidate)) < Math.abs(dayDiff(now, best))) {
      best = candidate;
    }
  }

  return best as Date;
}

/**
 * The estimated peak-rut date for a latitude: the northern photoperiod baseline
 * (~Nov 15) slid later toward the Gulf by the movement model's rutShiftDays,
 * projected to the season nearest `now`.
 */
export function estimatedRutPeak(latitude: number, now: Date = new Date()): Date {
  // November = month index 10; JS Date normalizes the day overflow (e.g. Nov 40
  // -> Dec 10) so the southern shift crosses the month boundary cleanly.
  const shifted = new Date(now.getFullYear(), 10, 15 + rutShiftDays(latitude));
  return nearestOccurrence(shifted.getMonth(), shifted.getDate(), now);
}

/** Map days-until-peak (negative once past) to a rut phase. */
function phaseForDaysToPeak(days: number): RutPhase {
  if (days >= 76) return "off-season";
  if (days >= 46) return "early";
  if (days >= 22) return "pre-rut";
  if (days >= 10) return "seeking";
  if (days >= 3) return "chasing";
  if (days >= -2) return "peak";
  if (days >= -10) return "lockdown";
  if (days >= -28) return "post-rut";
  if (days >= -75) return "late";
  return "off-season";
}

export type SeasonContext = {
  phase: RutPhase;
  phaseLabel: string;
  phaseHint: string;
  /** Days until the peak; negative once the peak has passed. */
  daysToPeak: number;
  /** The peak date actually used (the hunter's, or the estimate). */
  peakDate: Date;
  /** True when the peak came from the hunter's setting rather than the estimate. */
  peakIsCustom: boolean;
  regionLabel: string;
  /** Present only when a season opener is set. */
  opener?: {
    date: Date;
    /** Days until opening day; negative once the season is open. */
    daysToOpener: number;
    /** 1-based day of the season once it is open; null before opening day. */
    dayOfSeason: number | null;
  };
};

/**
 * Resolve everything the UI shows from the saved calendar: the effective peak
 * (custom or estimated), how far off it is, the phase, and — if set — the
 * opener countdown / day-of-season, anchored to the same season as the peak.
 */
export function getSeasonContext(
  now: Date,
  prefs: SeasonCalendarPrefs,
  latitude: number = DEFAULT_RUT_LATITUDE,
): SeasonContext {
  const custom = parseISODate(prefs.rutPeak);
  const peakIsCustom = custom !== null;

  const peakDate = custom
    ? nearestOccurrence(custom.getMonth(), custom.getDate(), now)
    : estimatedRutPeak(latitude, now);

  const daysToPeak = dayDiff(now, peakDate);
  const phase = phaseForDaysToPeak(daysToPeak);

  const context: SeasonContext = {
    phase,
    phaseLabel: rutPhaseLabel(phase),
    phaseHint: rutPhaseHint(phase),
    daysToPeak,
    peakDate,
    peakIsCustom,
    regionLabel: rutRegionLabel(latitude),
  };

  const opener = parseISODate(prefs.seasonOpener);
  if (opener) {
    // The opener belongs to the same season as the peak it precedes.
    const openerDate = new Date(
      peakDate.getFullYear(),
      opener.getMonth(),
      opener.getDate(),
    );
    const daysToOpener = dayDiff(now, openerDate);
    context.opener = {
      date: openerDate,
      daysToOpener,
      dayOfSeason: daysToOpener <= 0 ? -daysToOpener + 1 : null,
    };
  }

  return context;
}

// --- store -------------------------------------------------------------------

let cachedRaw: string | null = null;
let cachedPrefs: SeasonCalendarPrefs = DEFAULT_SEASON_CALENDAR;

export function readSeasonCalendar(): SeasonCalendarPrefs {
  if (typeof window === "undefined") return DEFAULT_SEASON_CALENDAR;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SEASON_STORAGE_KEY);
  } catch {
    return DEFAULT_SEASON_CALENDAR;
  }

  if (raw === cachedRaw) return cachedPrefs;

  cachedRaw = raw;
  cachedPrefs = parsePrefs(raw);
  return cachedPrefs;
}

function parsePrefs(raw: string | null): SeasonCalendarPrefs {
  if (!raw) return DEFAULT_SEASON_CALENDAR;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SEASON_CALENDAR;
  }

  if (!parsed || typeof parsed !== "object") return DEFAULT_SEASON_CALENDAR;

  const record = parsed as Record<string, unknown>;
  const asIso = (value: unknown): string | null =>
    typeof value === "string" && parseISODate(value) ? value : null;

  return {
    seasonOpener: asIso(record.seasonOpener),
    rutPeak: asIso(record.rutPeak),
  };
}

const listeners = new Set<() => void>();

function writePrefs(next: SeasonCalendarPrefs): void {
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cachedPrefs = next;

  try {
    window.localStorage.setItem(SEASON_STORAGE_KEY, raw);
  } catch {
    // Ignore write failures (private mode / quota); the cached value still
    // applies for this session.
  }

  listeners.forEach((listener) => listener());
}

export function setSeasonOpener(value: string | null): void {
  writePrefs({ ...readSeasonCalendar(), seasonOpener: value || null });
}

export function setRutPeak(value: string | null): void {
  writePrefs({ ...readSeasonCalendar(), rutPeak: value || null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== SEASON_STORAGE_KEY && event.key !== null) return;
    cachedRaw = null;
    listeners.forEach((each) => each());
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot(): SeasonCalendarPrefs {
  return DEFAULT_SEASON_CALENDAR;
}

export function useSeasonCalendar(): SeasonCalendarPrefs {
  return useSyncExternalStore(subscribe, readSeasonCalendar, getServerSnapshot);
}
