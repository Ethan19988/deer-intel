import type { HuntLogEntry } from "@/types/hunt";

export function sortHuntsChronologically(hunts: HuntLogEntry[]) {
  return [...hunts].sort((left, right) => huntTime(left) - huntTime(right));
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
