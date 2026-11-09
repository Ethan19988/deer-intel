import { isLikelyMaryland } from "@/lib/huntingState";

// Official 2026-27 deer season dates for the two states Deer Intel properties
// sit in, so Today can say "Rifle opens Sat Nov 28 · 19 days" and the calendar
// can mark openers and closers. Only dates read off an official agency page are
// listed; anything that couldn't be verified is left out and the UI points the
// hunter to the digest instead. These are STATEWIDE dates — WMU / region
// differences are listed separately (scope "regional") and the UI always
// says to confirm the WMU.
//
// Pennsylvania (PA Game Commission), retrieved 2026-11-09:
//   - Final 2026-27 seasons approved:
//     https://www.pa.gov/agencies/pgc/newsroom/final-2026-27-hunting-seasons-approved
//   - 2026-27 Seasons and Bag Limits (digest page):
//     https://www.pa.gov/agencies/pgc/huntingandtrapping/regulations/seasons-and-bag-limits
//   Sundays: "All 2026-27 seasons include the Sundays that fall within their
//   listed start and end dates" (final seasons release; also in the preliminary
//   release https://www.pa.gov/agencies/pgc/newsroom/preliminary-2026-27-hunting-seasons-and-bag-limits-approved).
//   There is no separate mentored-youth deer season in 2026-27: mentored
//   permit holders, juniors and seniors hunt the Oct 22-25 special firearms
//   season.
//
// Maryland (MD DNR), retrieved 2026-11-09:
//   - Archery: https://news.maryland.gov/dnr/2026/09/01/marylands-2026-27-archery-deer-hunting-season-opens-september-11/
//   - Early muzzleloader: https://news.maryland.gov/dnr/2026/10/15/marylands-early-muzzleloader-deer-season-opens-oct-22/
//   - Junior deer hunt: https://news.maryland.gov/dnr/2026/10/27/marylands-2026-junior-deer-hunt-opens-november-14/
//   - Firearms: https://news.maryland.gov/dnr/?p=48927 ("Maryland's Deer Firearms Season Opens November 28", Nov 4 2026)
//   MD Sunday deer hunting is set county by county, so this module never
//   claims a MD Sunday is legal — it says to check the county.

export type SeasonStateCode = "PA" | "MD";

export type SeasonWeapon =
  | "archery"
  | "muzzleloader"
  | "flintlock"
  | "firearms"
  | "special-firearms"
  | "youth"
  | "primitive";

export type DeerSeason = {
  id: string;
  state: SeasonStateCode;
  /** Full name, e.g. "Regular firearms". */
  label: string;
  /** Short name for the Today line, e.g. "Rifle". */
  shortLabel: string;
  weapon: SeasonWeapon;
  /** First legal day, "YYYY-MM-DD" (local calendar date). */
  start: string;
  /** Last legal day, "YYYY-MM-DD" (inclusive). */
  end: string;
  notes: string;
  sourceUrl: string;
  /** "statewide", or "regional" when only certain WMUs / regions are open. */
  scope: "statewide" | "regional";
  /** WMUs (PA) or deer management regions (MD) for a regional season. */
  regions?: string[];
};

const PGC_FINAL_URL =
  "https://www.pa.gov/agencies/pgc/newsroom/final-2026-27-hunting-seasons-approved";
const PGC_DIGEST_URL =
  "https://www.pa.gov/agencies/pgc/huntingandtrapping/regulations/seasons-and-bag-limits";
const MD_ARCHERY_URL =
  "https://news.maryland.gov/dnr/2026/09/01/marylands-2026-27-archery-deer-hunting-season-opens-september-11/";
const MD_MUZZLELOADER_URL =
  "https://news.maryland.gov/dnr/2026/10/15/marylands-early-muzzleloader-deer-season-opens-oct-22/";
const MD_JUNIOR_URL =
  "https://news.maryland.gov/dnr/2026/10/27/marylands-2026-junior-deer-hunt-opens-november-14/";
const MD_FIREARMS_URL = "https://news.maryland.gov/dnr/?p=48927";

/** The official page the "Confirm in the digest" link opens, per state. */
export const SEASON_DIGEST: Record<SeasonStateCode, { label: string; url: string }> = {
  PA: { label: "Confirm in the PGC digest", url: PGC_DIGEST_URL },
  MD: {
    label: "Confirm in the MD DNR guide",
    url: "https://dnr.maryland.gov/wildlife/Documents/Hunting-Seasons-Calendar.pdf",
  },
};

/** The license year the table below covers (PA/MD: July 1 – June 30). */
export const SEASON_DATA_YEAR = { start: "2026-07-01", end: "2027-06-30", label: "2026-27" };

export const DEER_SEASONS: readonly DeerSeason[] = [
  // --- Pennsylvania, statewide -------------------------------------------
  {
    id: "pa-archery-early",
    state: "PA",
    label: "Archery",
    shortLabel: "Archery",
    weapon: "archery",
    start: "2026-10-03",
    end: "2026-11-20",
    notes: "Antlered and antlerless. WMUs 2B, 5C, 5D open Sept 19 and run to Nov 27.",
    sourceUrl: PGC_FINAL_URL,
    scope: "statewide",
  },
  {
    id: "pa-muzzleloader-antlerless",
    state: "PA",
    label: "Antlerless muzzleloader",
    shortLabel: "Muzzleloader",
    weapon: "muzzleloader",
    start: "2026-10-17",
    end: "2026-10-25",
    notes: "Antlerless only. Antlerless license required.",
    sourceUrl: PGC_FINAL_URL,
    scope: "statewide",
  },
  {
    id: "pa-special-firearms",
    state: "PA",
    label: "Antlerless special firearms",
    shortLabel: "Special firearms",
    weapon: "special-firearms",
    start: "2026-10-22",
    end: "2026-10-25",
    notes:
      "Junior and senior license holders, mentored permit holders, Disabled Person Permit (vehicle) holders, and residents on active duty. No separate mentored-youth deer season in 2026-27.",
    sourceUrl: PGC_DIGEST_URL,
    scope: "statewide",
  },
  {
    id: "pa-regular-firearms",
    state: "PA",
    label: "Regular firearms",
    shortLabel: "Rifle",
    weapon: "firearms",
    start: "2026-11-28",
    end: "2026-12-13",
    notes: "Antlered and antlerless, statewide. Antlerless rules vary by WMU — check yours.",
    sourceUrl: PGC_FINAL_URL,
    scope: "statewide",
  },
  {
    id: "pa-archery-late",
    state: "PA",
    label: "Late archery",
    shortLabel: "Late archery",
    weapon: "archery",
    start: "2026-12-26",
    end: "2027-01-24",
    notes: "Antlered and antlerless, statewide.",
    sourceUrl: PGC_FINAL_URL,
    scope: "statewide",
  },
  {
    id: "pa-flintlock",
    state: "PA",
    label: "Flintlock",
    shortLabel: "Flintlock",
    weapon: "flintlock",
    start: "2026-12-26",
    end: "2027-01-24",
    notes: "Antlered or antlerless, statewide.",
    sourceUrl: PGC_FINAL_URL,
    scope: "statewide",
  },
  // --- Pennsylvania, WMU-specific ----------------------------------------
  {
    id: "pa-archery-early-wmu",
    state: "PA",
    label: "Archery (WMUs 2B, 5C, 5D)",
    shortLabel: "Archery (2B/5C/5D)",
    weapon: "archery",
    start: "2026-09-19",
    end: "2026-11-27",
    notes: "Earlier and longer archery in WMUs 2B, 5C and 5D only.",
    sourceUrl: PGC_FINAL_URL,
    scope: "regional",
    regions: ["2B", "5C", "5D"],
  },
  {
    id: "pa-extended-antlerless-2b",
    state: "PA",
    label: "Extended antlerless firearms (WMUs 2B, 5C, 5D)",
    shortLabel: "Extended antlerless",
    weapon: "firearms",
    start: "2026-12-26",
    end: "2027-01-24",
    notes: "Antlerless only, WMUs 2B, 5C, 5D (also DMAP properties statewide with a DMAP permit).",
    sourceUrl: PGC_FINAL_URL,
    scope: "regional",
    regions: ["2B", "5C", "5D"],
  },
  {
    id: "pa-extended-antlerless-4a",
    state: "PA",
    label: "Extended antlerless firearms (WMUs 4A, 4C, 4D, 5A)",
    shortLabel: "Extended antlerless",
    weapon: "firearms",
    start: "2026-12-26",
    end: "2027-01-18",
    notes: "Antlerless only, WMUs 4A, 4C, 4D, 5A.",
    sourceUrl: PGC_FINAL_URL,
    scope: "regional",
    regions: ["4A", "4C", "4D", "5A"],
  },
  // --- Maryland, statewide -------------------------------------------------
  {
    id: "md-archery",
    state: "MD",
    label: "Archery",
    shortLabel: "Archery",
    weapon: "archery",
    start: "2026-09-11",
    end: "2027-01-31",
    notes:
      "Runs through Jan 31 with several breaks for muzzleloader and firearms seasons — check the DNR guide for the closed days.",
    sourceUrl: MD_ARCHERY_URL,
    scope: "statewide",
  },
  {
    id: "md-muzzleloader-early",
    state: "MD",
    label: "Early muzzleloader",
    shortLabel: "Muzzleloader",
    weapon: "muzzleloader",
    start: "2026-10-22",
    end: "2026-10-24",
    notes: "Statewide.",
    sourceUrl: MD_MUZZLELOADER_URL,
    scope: "statewide",
  },
  {
    id: "md-junior",
    state: "MD",
    label: "Junior deer hunt",
    shortLabel: "Junior hunt",
    weapon: "youth",
    start: "2026-11-14",
    end: "2026-11-15",
    notes:
      "Nov 14 all counties; Sunday Nov 15 on private land in all counties except Baltimore, Howard and Prince George's.",
    sourceUrl: MD_JUNIOR_URL,
    scope: "statewide",
  },
  {
    id: "md-firearms",
    state: "MD",
    label: "Firearms",
    shortLabel: "Firearms",
    weapon: "firearms",
    start: "2026-11-28",
    end: "2026-12-12",
    notes: "Includes certain Sundays in all but three counties — check your county.",
    sourceUrl: MD_FIREARMS_URL,
    scope: "statewide",
  },
  {
    id: "md-primitive",
    state: "MD",
    label: "Primitive deer hunt days",
    shortLabel: "Primitive bow",
    weapon: "primitive",
    start: "2027-02-01",
    end: "2027-02-03",
    notes: "Vertical longbows and recurve bows only.",
    sourceUrl: MD_ARCHERY_URL,
    scope: "statewide",
  },
  // --- Maryland, regional ---------------------------------------------------
  {
    id: "md-muzzleloader-region-b",
    state: "MD",
    label: "Antlerless muzzleloader (Region B)",
    shortLabel: "Muzzleloader (Region B)",
    weapon: "muzzleloader",
    start: "2026-10-26",
    end: "2026-10-31",
    notes: "Antlerless only, Region B (central, southern and eastern MD).",
    sourceUrl: MD_MUZZLELOADER_URL,
    scope: "regional",
    regions: ["B"],
  },
];

// --- Day keys ----------------------------------------------------------------

/** Local "YYYY-MM-DD" for a Date (the device's calendar day). */
export function seasonDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDaysToKey(key: string, days: number): string {
  const shifted = new Date(keyToUtc(key) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** Whole calendar days from `from`'s local date to a "YYYY-MM-DD" key (DST-safe). */
export function daysUntil(from: Date, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(seasonDayKey(from))) / 86_400_000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat Nov 28" for a "YYYY-MM-DD" key (no locale, so server and client agree). */
export function formatSeasonDay(key: string, withWeekday = true): string {
  const date = new Date(keyToUtc(key));
  const monthDay = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return withWeekday ? `${WEEKDAYS[date.getUTCDay()]} ${monthDay}` : monthDay;
}

function isSundayKey(key: string): boolean {
  return new Date(keyToUtc(key)).getUTCDay() === 0;
}

function inDataYear(key: string): boolean {
  return key >= SEASON_DATA_YEAR.start && key <= SEASON_DATA_YEAR.end;
}

// --- Season queries -----------------------------------------------------------

/** Which state's dates apply at a spot: Maryland when it looks like MD, else PA. */
export function seasonStateForPoint(
  point: { lat: number; lng: number } | null | undefined,
): SeasonStateCode {
  return isLikelyMaryland(point) ? "MD" : "PA";
}

type SeasonQueryOptions = { includeRegional?: boolean };

export function seasonsFor(
  state: SeasonStateCode,
  options: SeasonQueryOptions = {},
): DeerSeason[] {
  return DEER_SEASONS.filter(
    (season) =>
      season.state === state && (options.includeRegional || season.scope === "statewide"),
  );
}

/** Seasons open on `date` (inclusive of opener and closer), soonest closing first. */
export function currentSeasons(
  date: Date,
  state: SeasonStateCode,
  options: SeasonQueryOptions = {},
): DeerSeason[] {
  const key = seasonDayKey(date);
  return seasonsFor(state, options)
    .filter((season) => season.start <= key && key <= season.end)
    .sort((a, b) => a.end.localeCompare(b.end));
}

export type UpcomingOpener = { seasons: DeerSeason[]; start: string; days: number };

/**
 * The next statewide opener strictly after `date`'s day. Seasons that open
 * the same day are grouped (PA late archery + flintlock on Dec 26). Null when
 * no opener is left in the loaded data year.
 */
export function nextOpener(
  date: Date,
  state: SeasonStateCode,
  options: SeasonQueryOptions = {},
): UpcomingOpener | null {
  const key = seasonDayKey(date);
  const upcoming = seasonsFor(state, options)
    .filter((season) => season.start > key)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming.length === 0) return null;

  const start = upcoming[0].start;
  return {
    seasons: upcoming.filter((season) => season.start === start),
    start,
    days: daysUntil(date, start),
  };
}

/**
 * Is `date` a Sunday when deer hunting is legal statewide?
 *  - PA: true on a Sunday inside any statewide 2026-27 deer season (the PGC
 *    includes every Sunday within a season's dates), false on any other day.
 *  - MD: false when it isn't a Sunday or no MD season is open; otherwise null —
 *    Maryland sets Sunday hunting county by county, so it can't be confirmed.
 *  - null outside the loaded 2026-27 data year (dates not verified).
 */
export function isSundayHuntingDay(date: Date, state: SeasonStateCode): boolean | null {
  const key = seasonDayKey(date);
  if (!inDataYear(key)) return null;
  if (!isSundayKey(key)) return false;
  const open = currentSeasons(date, state).length > 0;
  if (!open) return false;
  return state === "PA" ? true : null;
}

export type SundayStatus = {
  /** "legal" / "closed" (no statewide season that Sunday) / "check" (county rules or unverified). */
  tone: "legal" | "closed" | "check";
  text: string;
};

/** One line about the coming Sunday (today when it's Sunday). Null outside the data year. */
export function sundayStatus(now: Date, state: SeasonStateCode): SundayStatus | null {
  const todayKey = seasonDayKey(now);
  const offset = (7 - new Date(keyToUtc(todayKey)).getUTCDay()) % 7;
  const sundayKey = addDaysToKey(todayKey, offset);
  if (!inDataYear(sundayKey)) return null;

  const localSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
  const when =
    offset === 0 ? "today" : offset === 1 ? "tomorrow" : formatSeasonDay(sundayKey);
  const legal = isSundayHuntingDay(localSunday, state);

  if (legal === true) {
    const open = currentSeasons(localSunday, state).map((season) => season.shortLabel);
    return { tone: "legal", text: `Sunday hunting legal ${when} · ${open.join(", ")}` };
  }
  if (legal === null) {
    return { tone: "check", text: `Sunday ${when}: hours vary by county — check MD rules` };
  }
  const closedWhen = offset <= 1 ? when : formatSeasonDay(sundayKey, false);
  return { tone: "closed", text: `No statewide deer season Sunday ${closedWhen}` };
}

// --- Opener reminder (notification) ----------------------------------------

export type SeasonOpenerReminder = { key: string; title: string; body: string };

/** A notification for the day BEFORE a statewide opener, or null on any other day. */
export function seasonOpenerReminder(
  now: Date,
  state: SeasonStateCode,
): SeasonOpenerReminder | null {
  const opener = nextOpener(now, state);
  if (!opener || opener.days !== 1) return null;

  const labels = opener.seasons.map((season) => season.label);
  const joined = labels.join(" + ");
  const verb = labels.length > 1 ? "open" : "opens";
  return {
    key: `season-opener:${opener.seasons.map((season) => season.id).join("+")}`,
    title: `${joined} ${verb} tomorrow`,
    body: `${state} ${joined} ${verb} ${formatSeasonDay(opener.start)}. ${SEASON_DIGEST[state].label} and check your ${state === "PA" ? "WMU" : "county"}.`,
  };
}

// --- Antlerless (doe) tags, per device -----------------------------------------

export const DOE_TAGS_STORAGE_KEY = "deer-intel:doe-tags";

export type DoeTags = {
  /** License year the count belongs to, e.g. "2026-27"; a new year starts fresh. */
  year: string;
  total: number;
  filled: number;
};

/** PA/MD license year (July 1 – June 30) for a date, e.g. "2026-27". */
export function licenseYearFor(date: Date): string {
  const startYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function wholeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(99, Math.floor(value))
    : 0;
}

/** Read stored tags for `year`; anything malformed or from another year reads as none. */
export function parseDoeTags(raw: string | null, year: string): DoeTags {
  const empty: DoeTags = { year, total: 0, filled: 0 };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<DoeTags> | null;
    if (!parsed || typeof parsed !== "object" || parsed.year !== year) return empty;
    const total = wholeCount(parsed.total);
    return { year, total, filled: Math.min(total, wholeCount(parsed.filled)) };
  } catch {
    return empty;
  }
}

/** Clamp a tag edit so filled never exceeds total and neither goes negative. */
export function normalizeDoeTags(tags: DoeTags): DoeTags {
  const total = wholeCount(tags.total);
  return { year: tags.year, total, filled: Math.min(total, wholeCount(tags.filled)) };
}

/** "1 doe tag left" / "All 2 doe tags filled" / null when none recorded. */
export function doeTagsLine(tags: DoeTags): string | null {
  if (tags.total <= 0) return null;
  const left = tags.total - tags.filled;
  if (left <= 0) return `All ${tags.total} doe tag${tags.total === 1 ? "" : "s"} filled`;
  return `${left} doe tag${left === 1 ? "" : "s"} left`;
}
