import { describe, expect, it } from "vitest";
import { isLikelyMaryland, isSundayDate } from "@/lib/huntingState";

describe("isLikelyMaryland", () => {
  it.each([
    ["Cumberland", 39.65, -78.76],
    ["Oakland (Garrett Co.)", 39.41, -79.41],
    ["Hagerstown", 39.64, -77.72],
    ["Frederick", 39.41, -77.41],
    ["Salisbury", 38.36, -75.6],
    ["Elkton", 39.61, -75.83],
  ])("is true for %s", (_name, lat, lng) => {
    expect(isLikelyMaryland({ lat, lng })).toBe(true);
  });

  it.each([
    ["Gettysburg PA", 39.83, -77.23],
    ["Pittsburgh PA", 40.44, -80.0],
    ["Martinsburg WV", 39.46, -77.96],
    ["Leesburg VA", 39.12, -77.56],
    ["Dover DE", 39.16, -75.52],
  ])("is false for %s", (_name, lat, lng) => {
    expect(isLikelyMaryland({ lat, lng })).toBe(false);
  });

  it("is false without a point", () => {
    expect(isLikelyMaryland(undefined)).toBe(false);
  });
});

describe("isSundayDate", () => {
  it("reads the calendar date", () => {
    expect(isSundayDate("2026-11-01")).toBe(true);
    expect(isSundayDate("2026-11-02")).toBe(false);
  });
});
