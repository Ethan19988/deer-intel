import { dateInputTime } from "@/lib/photos";

const DAY_MS = 86_400_000;

function localMidnight(time: number) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "Sat Nov 8 · 2 days ago" for a saved date ("YYYY-MM-DD" is read as local
 * midnight, not UTC). Adds the year when it isn't this year. Returns the raw
 * string when it can't be parsed and `emptyLabel` when there's no date.
 */
export function formatDayWithAgo(
  date: string | undefined,
  now: number = Date.now(),
  emptyLabel = "None yet",
) {
  if (!date) return emptyLabel;

  const time = dateInputTime(date);
  if (Number.isNaN(time)) return date;

  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear();
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  })
    .format(time)
    .replace(/,/g, "");

  // Whole calendar days between the two local dates (round absorbs DST hours).
  const days = Math.round((localMidnight(now) - localMidnight(time)) / DAY_MS);
  const ago =
    days === 0
      ? "today"
      : days === 1
        ? "yesterday"
        : days === -1
          ? "tomorrow"
          : days > 0
            ? `${days} days ago`
            : `in ${-days} days`;

  return `${dayLabel} · ${ago}`;
}
