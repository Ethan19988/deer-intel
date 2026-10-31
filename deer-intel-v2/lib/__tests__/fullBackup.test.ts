import { describe, expect, it } from "vitest";
import {
  assembleFullBackupBlob,
  backupGapNote,
  backupLandTags,
  documentFileIds,
  FULL_BACKUP_FORMAT,
  isFullBackup,
  missingImageIds,
  type FullBackup,
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

describe("assembleFullBackupBlob", () => {
  async function* from<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) yield item;
  }

  it("writes a file that parses back to a valid full backup", async () => {
    const { blob, imageCount, fileCount } = await assembleFullBackupBlob(
      {
        exportedAt: "2026-10-31T00:00:00.000Z",
        state: emptyState(),
        landTags: {
          SMITH: { kind: "permission", ownerName: "Smith", acres: 5, lat: 41, lng: -77, savedAt: "" },
        },
      },
      from([
        { id: "i1", type: "image/jpeg", dataBase64: "AAAA" },
        { id: "i2", type: "image/png", dataBase64: "BBBB" },
      ]),
      from([{ id: "f1", type: "application/pdf", dataBase64: "CCCC" }]),
    );
    const parsed: unknown = JSON.parse(await blob.text());

    expect(imageCount).toBe(2);
    expect(fileCount).toBe(1);
    expect(isFullBackup(parsed)).toBe(true);
    const backup = parsed as FullBackup;
    expect(backup.format).toBe(FULL_BACKUP_FORMAT);
    expect(backup.images.map((image) => image.id)).toEqual(["i1", "i2"]);
    expect(backup.files?.[0].dataBase64).toBe("CCCC");
    expect(backupLandTags(backup)?.SMITH.ownerName).toBe("Smith");
  });

  it("handles a backup with no photos or files", async () => {
    const { blob } = await assembleFullBackupBlob(
      { exportedAt: "x", state: emptyState() },
      from([]),
      from([]),
    );
    const parsed = JSON.parse(await blob.text()) as FullBackup;
    expect(isFullBackup(parsed)).toBe(true);
    expect(parsed.images).toEqual([]);
    expect(parsed.landTags).toBeUndefined();
    expect(backupLandTags(parsed)).toBeUndefined();
  });

  it("still accepts version 1 backups without files or land tags", () => {
    const v1 = {
      format: FULL_BACKUP_FORMAT,
      version: 1,
      exportedAt: "",
      state: emptyState(),
      images: [],
    };
    expect(isFullBackup(v1)).toBe(true);
    expect(backupLandTags(v1 as FullBackup)).toBeUndefined();
  });
});
