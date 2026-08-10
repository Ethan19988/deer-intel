import { describe, expect, it } from "vitest";
import { addMonths, buildMonthGrid, monthLabel } from "@/lib/calendarGrid";

describe("buildMonthGrid", () => {
  it("always returns a stable 6x7 grid", () => {
    const weeks = buildMonthGrid(2024, 10);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("pads with the neighboring months and marks the current month", () => {
    // Nov 1 2024 is a Friday, so the first row starts on Oct 27.
    const weeks = buildMonthGrid(2024, 10);
    expect(weeks[0][0]).toMatchObject({ dayKey: "2024-10-27", inMonth: false });
    expect(weeks[0][5]).toMatchObject({
      dayKey: "2024-11-01",
      day: 1,
      inMonth: true,
    });
  });
});

describe("addMonths", () => {
  it("rolls forward across a year boundary", () => {
    expect(addMonths(2024, 11, 1)).toEqual({ year: 2025, month: 0 });
  });

  it("rolls backward across a year boundary", () => {
    expect(addMonths(2024, 0, -1)).toEqual({ year: 2023, month: 11 });
  });

  it("jumps a full year", () => {
    expect(addMonths(2024, 5, -12)).toEqual({ year: 2023, month: 5 });
  });
});

describe("monthLabel", () => {
  it("formats a readable month + year", () => {
    expect(monthLabel(2024, 10)).toBe("November 2024");
  });
});
