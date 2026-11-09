import { describe, expect, it } from "vitest";
import {
  importDuplicateKey,
  importedPhotoKeys,
  isAlreadyImported,
} from "@/lib/photoImportDuplicates";
import type { PhotoRecord } from "@/types/photo";

function record(
  cameraSiteId: string,
  fileName: string,
  photoDate: string,
): PhotoRecord {
  return {
    id: `${cameraSiteId}-${fileName}`,
    propertyId: "p1",
    cameraSiteId,
    cameraCheckId: "",
    fileName,
    photoDate,
    species: "Buck",
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("photo import duplicates", () => {
  const records = [
    record("cam1", "IMG_0042.JPG", "2026-11-02T06:41"),
    record("cam2", "IMG_0043.JPG", "2026-11-02T07:10"),
  ];
  const keys = importedPhotoKeys(records, "cam1");

  it("matches the same file name and capture time on the same camera", () => {
    expect(
      isAlreadyImported({ fileName: "IMG_0042.JPG", photoDate: "2026-11-02T06:41" }, "cam1", keys),
    ).toBe(true);
    // Case and whitespace don't make it a new photo.
    expect(
      isAlreadyImported({ fileName: " img_0042.jpg ", photoDate: "2026-11-02T06:41" }, "cam1", keys),
    ).toBe(true);
  });

  it("treats a different time, name or camera as a new photo", () => {
    expect(
      isAlreadyImported({ fileName: "IMG_0042.JPG", photoDate: "2026-11-02T06:42" }, "cam1", keys),
    ).toBe(false);
    expect(
      isAlreadyImported({ fileName: "IMG_0044.JPG", photoDate: "2026-11-02T06:41" }, "cam1", keys),
    ).toBe(false);
    // IMG_0043 is saved, but on another camera.
    expect(
      isAlreadyImported({ fileName: "IMG_0043.JPG", photoDate: "2026-11-02T07:10" }, "cam1", keys),
    ).toBe(false);
  });

  it("never matches without a name, date or camera", () => {
    expect(importDuplicateKey("cam1", "", "2026-11-02T06:41")).toBe("");
    expect(importDuplicateKey("cam1", "IMG_0042.JPG", "")).toBe("");
    expect(importDuplicateKey("", "IMG_0042.JPG", "2026-11-02T06:41")).toBe("");
    expect(isAlreadyImported({ fileName: "IMG_0042.JPG", photoDate: "" }, "cam1", keys)).toBe(false);
  });
});
