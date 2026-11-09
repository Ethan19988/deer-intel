import { describe, expect, it } from "vitest";
import { buildHourlyActivity, isDeerPhotoRecord, isTimedDeerPhoto } from "@/lib/hourlyActivity";
import {
  buckOnlyFields,
  deerCountFor,
  isDeerSpecies,
  photoDeerCount,
} from "@/lib/photoOptions";
import { normalizeState } from "@/lib/deerIntelStore";
import type { PhotoRecord } from "@/types/photo";

function photo(species: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: species + (extra.photoDate ?? ""),
    propertyId: "p",
    cameraSiteId: "c",
    cameraCheckId: "",
    fileName: "x.jpg",
    photoDate: "2026-10-17T17:20",
    species,
    notes: "",
    createdAt: "",
    ...extra,
  };
}

describe("isDeerSpecies (allow-list)", () => {
  it("names deer only", () => {
    for (const species of ["Buck", "Doe", "Fawn", "Deer (Antlered)"]) {
      expect(isDeerSpecies(species)).toBe(true);
    }
    for (const species of ["Other", "No animal", "", "Human", "Turkey", "Unknown"]) {
      expect(isDeerSpecies(species)).toBe(false);
    }
  });
});

describe("deer photo predicates", () => {
  it("never count Other, No animal, or blank as deer", () => {
    expect(isDeerPhotoRecord(photo("Other"))).toBe(false);
    expect(isDeerPhotoRecord(photo("No animal"))).toBe(false);
    expect(isTimedDeerPhoto(photo("Other"))).toBe(false);
  });

  it("counts a buck link even on an odd species label", () => {
    expect(isDeerPhotoRecord(photo("Unknown", { buckNames: ["Big 8"] }))).toBe(true);
    expect(isDeerPhotoRecord(photo("Unknown", { deerProfileIds: ["deer-1"] }))).toBe(true);
  });

  it("keeps file-modified and date-only-stamp times out of the hour chart", () => {
    const now = new Date(2026, 9, 18, 12, 0);
    const activity = buildHourlyActivity(
      [
        photo("Doe"),
        photo("Doe", { id: "f", captureTimeSource: "file" }),
        photo("Doe", { id: "s", captureTimeSource: "stampDate", photoDate: "2026-10-16T12:00" }),
        photo("Other", { id: "o" }),
      ],
      now,
    );
    expect(activity.total).toBe(1);
  });
});

describe("photo detail helpers", () => {
  it("drops buck-only fields when the species isn't Buck", () => {
    expect(buckOnlyFields("Doe", "3.5", 8)).toEqual({ ageClass: undefined, antlerPoints: undefined });
    expect(buckOnlyFields("Buck", "3.5", 8)).toEqual({ ageClass: "3.5", antlerPoints: 8 });
    expect(buckOnlyFields("Buck", "", 0)).toEqual({ ageClass: undefined, antlerPoints: undefined });
  });

  it("keeps a deer count only on deer photos and defaults to 1 when counting", () => {
    expect(deerCountFor("Doe", 3)).toBe(3);
    expect(deerCountFor("No animal", 3)).toBeUndefined();
    expect(deerCountFor("Doe", 0)).toBeUndefined();
    expect(photoDeerCount({})).toBe(1);
    expect(photoDeerCount({ deerCount: 4 })).toBe(4);
  });
});

describe("normalizePhotoRecord pass-through", () => {
  const base = {
    id: "ph1",
    propertyId: "prop",
    cameraSiteId: "cam",
    cameraCheckId: "",
    fileName: "a.jpg",
    photoDate: "2026-11-04",
    species: "Buck",
    notes: "",
    createdAt: "2026-11-04",
  };

  function normalizedPhoto(extra: Record<string, unknown>) {
    const state = normalizeState({ version: 99, properties: [], photoRecords: [{ ...base, ...extra }] });
    return state?.photoRecords[0];
  }

  it("keeps the new optional fields when valid", () => {
    expect(
      normalizedPhoto({
        captureTimeSource: "stampDate",
        frameDirection: "Left to right",
        deerCount: 2,
        ageClass: "4.5+",
        antlerPoints: 10,
      }),
    ).toMatchObject({
      captureTimeSource: "stampDate",
      frameDirection: "Left to right",
      deerCount: 2,
      ageClass: "4.5+",
      antlerPoints: 10,
    });
  });

  it("tags legacy imports whose time came from the file or a date-only stamp", () => {
    expect(
      normalizedPhoto({
        photoDate: "2026-11-04T21:15",
        notes: "Imported through Camera Import Inbox. Metadata: Date read from file metadata. Time: 9:15 PM.",
      })?.captureTimeSource,
    ).toBe("file");
    expect(
      normalizedPhoto({
        photoDate: "2026-11-04T12:00",
        notes: "Metadata: Date read from photo stamp. Time: 12:00 PM.",
      })?.captureTimeSource,
    ).toBe("stampDate");
    expect(
      normalizedPhoto({
        photoDate: "2026-11-04T06:42",
        notes: "Metadata: Date read from photo stamp. Time: 6:42 AM.",
      })?.captureTimeSource,
    ).toBeUndefined();
  });

  it("drops unknown values and leaves older records' shape alone", () => {
    const record = normalizedPhoto({ captureTimeSource: "guess", ageClass: "9", deerCount: 0 });
    expect(record).toBeDefined();
    expect(record && "captureTimeSource" in record).toBe(false);
    expect(record && "ageClass" in record).toBe(false);
    expect(record && "deerCount" in record).toBe(false);
    expect(record && "frameDirection" in record).toBe(false);
  });
});
