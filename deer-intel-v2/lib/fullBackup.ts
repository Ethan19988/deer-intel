"use client";

import {
  getAllLocalImageEntries,
  restoreLocalImage,
} from "@/lib/imageStore";
import type { DeerIntelState } from "@/types/deerIntelStore";

// A full backup is one self-contained JSON file that bundles BOTH the record
// state (localStorage) and every photo blob (IndexedDB), base64-encoded inline.
//
// The existing records-only export leaves photos behind, because images live in
// a separate IndexedDB store. A hunter with no cloud account who exports records
// and then clears their browser or moves to a new device loses every picture.
// This bundle closes that gap with zero dependencies — base64 in plain JSON, no
// zip library — so it works fully offline and local-only.

export const FULL_BACKUP_FORMAT = "deer-intel-full-backup";

export type FullBackupImage = {
  id: string;
  type: string;
  dataBase64: string;
};

export type FullBackup = {
  format: typeof FULL_BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  state: DeerIntelState;
  images: FullBackupImage[];
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");

      // Strip the "data:<type>;base64," prefix, keeping just the payload.
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: type || "application/octet-stream" });
}

/** Bundle the current state plus every locally-stored photo into one object. */
export async function buildFullBackup(
  state: DeerIntelState,
  onProgress?: (done: number, total: number) => void,
): Promise<FullBackup> {
  const entries = await getAllLocalImageEntries();
  const images: FullBackupImage[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const { id, blob } = entries[index];

    images.push({
      id,
      type: blob.type || "application/octet-stream",
      dataBase64: await blobToBase64(blob),
    });

    onProgress?.(index + 1, entries.length);
  }

  return {
    format: FULL_BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
    images,
  };
}

/** True when a parsed file is a full backup (record state + inline photos). */
export function isFullBackup(value: unknown): value is FullBackup {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<FullBackup>;

  return (
    candidate.format === FULL_BACKUP_FORMAT &&
    !!candidate.state &&
    typeof candidate.state === "object" &&
    Array.isArray((candidate.state as DeerIntelState).properties) &&
    Array.isArray(candidate.images)
  );
}

/** Write every bundled image back into local IndexedDB on this device. */
export async function restoreFullBackupImages(
  images: FullBackupImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ total: number; restored: number; failed: number }> {
  let restored = 0;
  let failed = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    try {
      const blob = base64ToBlob(image.dataBase64, image.type);
      const ok = await restoreLocalImage(image.id, blob);

      if (ok) restored += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }

    onProgress?.(index + 1, images.length);
  }

  return { total: images.length, restored, failed };
}
