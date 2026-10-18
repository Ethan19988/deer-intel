import { dateToDayKey } from "@/lib/calendarEvents";

export type CalendarDayCell = {
  dayKey: string;
  day: number;
  inMonth: boolean;
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// A stable six-week grid for the given month (month is 0-11). Always 42 cells so
// the calendar never reflows as you page between months; leading/trailing cells
// belong to the neighboring months and are flagged inMonth: false. Deterministic
// (no clock read), so it's straightforward to test.
export function buildMonthGrid(year: number, month: number): CalendarDayCell[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const weeks: CalendarDayCell[][] = [];

  for (let week = 0; week < 6; week += 1) {
    const cells: CalendarDayCell[] = [];

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const dayOffset = week * 7 + weekday - firstWeekday;
      const cellDate = new Date(year, month, 1 + dayOffset);

      cells.push({
        dayKey: dateToDayKey(cellDate),
        day: cellDate.getDate(),
        inMonth: cellDate.getMonth() === month,
      });
    }

    weeks.push(cells);
  }

  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}

// Step the visible month by a number of months, rolling the year over as needed.
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
