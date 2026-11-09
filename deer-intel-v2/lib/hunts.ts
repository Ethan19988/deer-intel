import type { HuntLogEntry } from "@/types/hunt";

export function sortHuntsChronologically(hunts: HuntLogEntry[]) {
  return [...hunts].sort((left, right) => huntTime(left) - huntTime(right));
}

/** Newest sit first — the order the History list reads in. */
export function sortHuntsNewestFirst(hunts: HuntLogEntry[]) {
  return [...hunts].sort((left, right) => huntTime(right) - huntTime(left));
}

/**
 * Stand ids from this property's most recent sits, newest first, without
 * repeats, skipping stands that no longer exist. The first is the default
 * stand for a new sit; the first few become quick-pick buttons.
 */
export function recentStandIds(
  hunts: HuntLogEntry[],
  propertyId: string,
  existingStandIds: ReadonlySet<string>,
  limit = 3,
) {
  const ids: string[] = [];

  for (const hunt of sortHuntsNewestFirst(hunts)) {
    if (ids.length >= limit) break;
    if (hunt.propertyId !== propertyId) continue;
    if (!existingStandIds.has(hunt.standId) || ids.includes(hunt.standId)) continue;
    ids.push(hunt.standId);
  }

  return ids;
}

/** "Sat Nov 8" — short enough for a one-line history row. */
export function formatHuntDayShort(date: string | undefined) {
  if (!date) return "No date";

  const time = dateInputTime(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(time)
    .replace(",", "");
}

/** "AM" / "PM" from the sit's In time (or Out, if In is blank); "" if neither. */
export function huntPeriodLabel(hunt: Pick<HuntLogEntry, "startTime" | "endTime">) {
  const time = hunt.startTime || hunt.endTime;
  const hours = Number((time || "").split(":")[0]);

  if (!time || !Number.isFinite(hours)) return "";

  return hours < 12 ? "AM" : "PM";
}

/** "2 bucks, 1 doe" — only what was seen — or "nothing seen". */
export function deerSeenShort(hunt: Pick<HuntLogEntry, "bucks" | "does" | "fawns">) {
  const parts = [
    countLabel(hunt.bucks, "buck", "bucks"),
    countLabel(hunt.does, "doe", "does"),
    countLabel(hunt.fawns, "fawn", "fawns"),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "nothing seen";
}

/** One history row: "Sat Nov 8 · PM · My Tree · 2 bucks, 1 doe". */
export function huntOneLineSummary(hunt: HuntLogEntry) {
  return [
    formatHuntDayShort(hunt.date),
    huntPeriodLabel(hunt),
    hunt.standName || "Stand",
    deerSeenShort(hunt),
  ]
    .filter(Boolean)
    .join(" · ");
}

function countLabel(count: number, one: string, many: string) {
  const value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

  if (value === 0) return "";

  return `${value} ${value === 1 ? one : many}`;
}

export function formatHuntDate(date: string | undefined) {
  if (!date) return "No date";

  const time = dateInputTime(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

export function formatHuntTimeRange(hunt: HuntLogEntry) {
  const startTime = formatHuntTime(hunt.startTime);
  const endTime = formatHuntTime(hunt.endTime);

  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return `Started ${startTime}`;
  if (endTime) return `Ended ${endTime}`;

  return "Time not set";
}

export function deerSeenSummary(hunt: HuntLogEntry) {
  const parts = [
    `${hunt.bucks} bucks`,
    `${hunt.does} does`,
    `${hunt.fawns} fawns`,
  ];

  return parts.join(" / ");
}

export function huntOutcomeLabel(hunt: HuntLogEntry) {
  if (hunt.harvest) return "Harvest";
  if (hunt.shotOpportunity) return "Shot Opportunity";

  return "Observation";
}

export function yesNoLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function formatHuntTime(time: string | undefined) {
  if (!time) return "";

  const parsedTime = Date.parse(`2000-01-01T${time}`);

  if (Number.isNaN(parsedTime)) return time;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedTime);
}

function huntTime(hunt: HuntLogEntry) {
  const dateTime = `${hunt.date || ""}T${hunt.startTime || "00:00"}`;
  const fullTime = Date.parse(dateTime);

  if (!Number.isNaN(fullTime)) return fullTime;

  const dateOnlyTime = dateInputTime(hunt.date);

  return Number.isNaN(dateOnlyTime) ? 0 : dateOnlyTime;
}

function dateInputTime(date: string | undefined) {
  if (!date) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateOnlyMatch) return Date.parse(date);

  const [, year, month, day] = dateOnlyMatch;

  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}
