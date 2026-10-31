import { describe, expect, it } from "vitest";
import { dateInputTime, formatPhotoDate } from "@/lib/photos";

describe("dateInputTime", () => {
  it("reads a bare date as local midnight, not UTC", () => {
    const time = dateInputTime("2026-10-31");

    expect(new Date(time).getDate()).toBe(31);
    expect(new Date(time).getHours()).toBe(0);
  });

  it("parses datetimes and rejects junk", () => {
    expect(new Date(dateInputTime("2026-10-31T06:45")).getHours()).toBe(6);
    expect(Number.isNaN(dateInputTime(""))).toBe(true);
    expect(Number.isNaN(dateInputTime("not a date"))).toBe(true);
  });

  it("formats the same calendar day it was given", () => {
    expect(formatPhotoDate("2026-10-31")).toBe("Oct 31, 2026");
  });
});
