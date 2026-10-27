import { describe, expect, it } from "vitest";
import {
  backupGapNote,
  documentFileIds,
  FULL_BACKUP_FORMAT,
  isFullBackup,
  missingImageIds,
} from "@/lib/fullBackup";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { DocumentRecord } from "@/types/document";
import type { PhotoRecord } from "@/types/photo";

function emptyState(): DeerIntelState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks: [],
    stands: [],
    pins: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

function photo(id: string, imageId?: string): PhotoRecord {
  return {
    id,
    propertyId: "p",
    cameraSiteId: "",
    cameraCheckId: "",
    fileName: `${id}.jpg`,
    photoDate: "",
    species: "",
    notes: "",
    createdAt: "",
    imageId,
  };
}

function doc(id: string, fileId: string): DocumentRecord {
  return {
    id,
    propertyId: "p",
    label: id,
    fileName: `${id}.pdf`,
    fileType: "application/pdf",
    fileSize: 1,
    fileId,
    notes: "",
    createdAt: "",
  };
}

describe("missingImageIds", () => {
  it("lists referenced images not stored locally, deduped", () => {
    const state = {
      ...emptyState(),
      photoRecords: [
        photo("a", "img-1"),
        photo("b", "img-2"),
        photo("c", "img-2"),
        photo("d"),
        photo("e", "img-3"),
      ],
    };
    expect(missingImageIds(state, ["img-1"])).toEqual(["img-2", "img-3"]);
  });

  it("is empty when every image is local", () => {
    const state = { ...emptyState(), photoRecords: [photo("a", "img-1")] };
    expect(missingImageIds(state, ["img-1", "orphan"])).toEqual([]);
  });
});

describe("documentFileIds", () => {
  it("skips metadata-only documents and duplicates", () => {
    const state = {
      ...emptyState(),
      documents: [doc("a", "f1"), doc("b", ""), doc("c", "f1"), doc("d", "f2")],
    };
    expect(documentFileIds(state)).toEqual(["f1", "f2"]);
  });
});

describe("backupGapNote", () => {
  it("is empty for a complete backup", () => {
    expect(backupGapNote(0, 0)).toBe("");
  });

  it("names what was left out", () => {
    expect(backupGapNote(1, 0)).toMatch(/^1 photo couldn't be included/);
    expect(backupGapNote(3, 2)).toMatch(/^3 photos and 2 documents couldn't/);
  });
});

describe("isFullBackup", () => {
  const base = {
    format: FULL_BACKUP_FORMAT,
    exportedAt: "",
    state: emptyState(),
    images: [],
  };

  it("accepts a version 1 backup without files", () => {
    expect(isFullBackup({ ...base, version: 1 })).toBe(true);
  });

  it("accepts a version 2 backup with files", () => {
    expect(
      isFullBackup({
        ...base,
        version: 2,
        files: [{ id: "f1", type: "application/pdf", dataBase64: "" }],
      }),
    ).toBe(true);
  });

  it("rejects a malformed files section", () => {
    expect(isFullBackup({ ...base, version: 2, files: "nope" })).toBe(false);
  });
});
