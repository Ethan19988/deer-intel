import { describe, expect, it } from "vitest";
import {
  dateFromFileName,
  hasTrustedPhotoTime,
  joinPhotoDate,
  resolveImportCaptureTime,
  splitPhotoDate,
} from "@/lib/photoDateTime";
import { emptyPhotoFormValues } from "@/lib/photoFormValues";

const now = new Date(2026, 10, 8, 12, 0);

describe("split / join", () => {
  it("round-trips timed and date-only values", () => {
    expect(splitPhotoDate("2026-11-04T06:42")).toEqual({ date: "2026-11-04", time: "06:42" });
    expect(splitPhotoDate("2026-11-04")).toEqual({ date: "2026-11-04", time: "" });
    expect(joinPhotoDate("2026-11-04", "06:42")).toBe("2026-11-04T06:42");
    expect(joinPhotoDate("2026-11-04", "")).toBe("2026-11-04");
    expect(joinPhotoDate("", "06:42")).toBe("");
  });
});

describe("hasTrustedPhotoTime", () => {
  it("needs a time that didn't come from the file or a date-only stamp", () => {
    expect(hasTrustedPhotoTime({ photoDate: "2026-11-04T06:42" })).toBe(true);
    expect(hasTrustedPhotoTime({ photoDate: "2026-11-04T06:42", captureTimeSource: "stamp" })).toBe(true);
    expect(hasTrustedPhotoTime({ photoDate: "2026-11-04T06:42", captureTimeSource: "file" })).toBe(false);
    expect(hasTrustedPhotoTime({ photoDate: "2026-11-04T12:00", captureTimeSource: "stampDate" })).toBe(false);
    expect(hasTrustedPhotoTime({ photoDate: "2026-11-04" })).toBe(false);
  });
});

describe("dateFromFileName", () => {
  it("reads a date and time when both are in the name", () => {
    expect(dateFromFileName("IMG_20261104_064211.JPG", now)).toBe("2026-11-04T06:42");
  });

  it("gives a date only when the name has no time (no invented noon)", () => {
    expect(dateFromFileName("cam-2026-11-04.jpg", now)).toBe("2026-11-04");
  });

  it("ignores names without a believable date", () => {
    expect(dateFromFileName("IMG_0042.JPG", now)).toBe("");
    expect(dateFromFileName("20991231.jpg", now)).toBe("");
  });
});

describe("resolveImportCaptureTime", () => {
  const fileTime = new Date(2026, 10, 7, 21, 15).getTime();

  it("uses the stamp time when present", () => {
    const result = resolveImportCaptureTime({
      fileName: "IMG_0001.JPG",
      lastModified: fileTime,
      exifDate: "",
      stampDate: "2026-11-04T06:42",
      now,
    });
    expect(result).toMatchObject({ photoDate: "2026-11-04T06:42", captureTimeSource: "stamp" });
  });

  it("stores a date-only stamp as a date, never T12:00", () => {
    const result = resolveImportCaptureTime({
      fileName: "IMG_0001.JPG",
      lastModified: fileTime,
      exifDate: "",
      stampDate: "2026-11-04",
      now,
    });
    expect(result).toMatchObject({ photoDate: "2026-11-04", captureTimeSource: "stampDate" });
  });

  it("falls back to the file date only, offering its time as a hint", () => {
    const result = resolveImportCaptureTime({
      fileName: "IMG_0001.JPG",
      lastModified: fileTime,
      exifDate: "",
      stampDate: "",
      now,
    });
    expect(result).toEqual({
      photoDate: "2026-11-07",
      captureTimeSource: "file",
      fileTimeHint: "21:15",
      clockWarning: false,
    });
  });

  it("prefers a timed file name over a date-only stamp", () => {
    const result = resolveImportCaptureTime({
      fileName: "IMG_20261104_064211.JPG",
      lastModified: fileTime,
      exifDate: "",
      stampDate: "2026-11-04",
      now,
    });
    expect(result).toMatchObject({ photoDate: "2026-11-04T06:42", captureTimeSource: "filename" });
  });

  it("returns nothing when no date is found", () => {
    const result = resolveImportCaptureTime({
      fileName: "IMG_0001.JPG",
      lastModified: 0,
      exifDate: "",
      stampDate: "",
      now,
    });
    expect(result).toMatchObject({ photoDate: "", captureTimeSource: "" });
  });
});

describe("emptyPhotoFormValues", () => {
  it("starts on today's date without the form-open time", () => {
    const values = emptyPhotoFormValues(new Date(2026, 10, 8, 17, 33));
    expect(values.photoDate).toBe("2026-11-08");
    expect(values.species).toBe("");
  });
});
