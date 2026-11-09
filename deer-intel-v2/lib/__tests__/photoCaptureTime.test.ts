import { describe, expect, it } from "vitest";
import {
  isPlausibleCaptureDate,
  pickCaptureDateTime,
} from "@/lib/photoCaptureTime";

const now = new Date(2026, 10, 8, 12, 0);

describe("isPlausibleCaptureDate", () => {
  it("accepts real recent dates with or without a time", () => {
    expect(isPlausibleCaptureDate("2026-11-04", now)).toBe(true);
    expect(isPlausibleCaptureDate("2026-11-04T06:42", now)).toBe(true);
  });

  it("rejects a reset camera clock, the future, and junk", () => {
    expect(isPlausibleCaptureDate("2000-01-01T00:03", now)).toBe(false);
    expect(isPlausibleCaptureDate("2014-12-31", now)).toBe(false);
    expect(isPlausibleCaptureDate("2026-11-20", now)).toBe(false);
    expect(isPlausibleCaptureDate("2026-13-02", now)).toBe(false);
    expect(isPlausibleCaptureDate("not a date", now)).toBe(false);
  });

  it("allows a day of slack for time zones", () => {
    expect(isPlausibleCaptureDate("2026-11-09T06:00", now)).toBe(true);
  });
});

describe("pickCaptureDateTime", () => {
  it("prefers a timed stamp when it agrees with EXIF", () => {
    expect(pickCaptureDateTime("2026-11-04T09:10", "2026-11-04T06:42", now)).toEqual({
      dateTime: "2026-11-04T06:42",
      source: "stamp",
      clockWarning: false,
    });
  });

  it("prefers EXIF and warns when the stamp is more than a day off", () => {
    expect(pickCaptureDateTime("2026-11-04T06:42", "2026-10-01T06:42", now)).toEqual({
      dateTime: "2026-11-04T06:42",
      source: "exif",
      clockWarning: true,
    });
  });

  it("drops an impossible stamp and warns", () => {
    expect(pickCaptureDateTime("2026-11-04T06:42", "2000-01-01T00:05", now)).toEqual({
      dateTime: "2026-11-04T06:42",
      source: "exif",
      clockWarning: true,
    });
    expect(pickCaptureDateTime("", "2030-01-01T05:00", now)).toEqual({
      dateTime: "",
      source: "none",
      clockWarning: true,
    });
  });

  it("keeps a date-only stamp as a date with no invented time", () => {
    expect(pickCaptureDateTime("", "2026-11-04", now)).toEqual({
      dateTime: "2026-11-04",
      source: "stampDate",
      clockWarning: false,
    });
  });

  it("uses timed EXIF over a date-only stamp on the same day", () => {
    expect(pickCaptureDateTime("2026-11-04T18:20", "2026-11-04", now).source).toBe("exif");
  });
});
