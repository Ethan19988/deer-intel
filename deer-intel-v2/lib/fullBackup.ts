"use client";

import { getFile, putFile } from "@/lib/fileStore";
import {
  getAllLocalImageEntries,
  getPhotoImage,
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
//
// Version 2 adds `files`: the attached-document blobs from lib/fileStore, keyed
// by DocumentRecord.fileId. Version 1 files (no `files`) still restore.

export const FULL_BACKUP_FORMAT = "deer-intel-full-backup";
export const FULL_BACKUP_VERSION = 2;

/** One inline blob — a photo (imageId) or a document file (fileId). */
export type FullBackupImage = {
  id: string;
  type: string;
  dataBase64: string;
};

export type FullBackupFile = FullBackupImage;

export type FullBackup = {
  format: typeof FULL_BACKUP_FORMAT;
  version: 1 | typeof FULL_BACKUP_VERSION;
  exportedAt: string;
  state: DeerIntelState;
  images: FullBackupImage[];
  // Absent in version 1 backups.
  files?: FullBackupFile[];
};

export type FullBackupBuildResult = {
  backup: FullBackup;
  // Photos / documents the state references but whose bytes couldn't be found
  // locally or (for photos) in the cloud backup, so they're not in the file.
  missingPhotos: number;
  missingDocuments: number;
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

/**
 * Photo image ids the state references that aren't stored locally — evicted
 * from this device or saved on another one. Deduped, in record order.
 */
export function missingImageIds(
  state: DeerIntelState,
  localIds: Iterable<string>,
): string[] {
  const local = new Set(localIds);
  const missing = new Set<string>();

  for (const photo of state.photoRecords) {
    if (photo.imageId && !local.has(photo.imageId)) missing.add(photo.imageId);
  }

  return [...missing];
}

/** Every document file id the state references (deduped, blanks skipped). */
export function documentFileIds(state: DeerIntelState): string[] {
  return [
    ...new Set(
      state.documents.map((document) => document.fileId).filter(Boolean),
    ),
  ];
}

/** A short note about anything left out of a backup, or "" when complete. */
export function backupGapNote(
  missingPhotos: number,
  missingDocuments: number,
): string {
  const parts: string[] = [];

  if (missingPhotos > 0) {
    parts.push(`${missingPhotos} photo${missingPhotos === 1 ? "" : "s"}`);
  }
  if (missingDocuments > 0) {
    parts.push(
      `${missingDocuments} document${missingDocuments === 1 ? "" : "s"}`,
    );
  }

  return parts.length > 0
    ? `${parts.join(" and ")} couldn't be included (not on this device or in your cloud backup).`
    : "";
}

async function toBackupBlob(id: string, blob: Blob): Promise<FullBackupImage> {
  return {
    id,
    type: blob.type || "application/octet-stream",
    dataBase64: await blobToBase64(blob),
  };
}

/**
 * Bundle the current state, every locally-stored photo, any referenced photo
 * that only survives in the cloud backup (when signed in), and every attached
 * document file into one object. Anything that can't be found is counted
 * rather than silently skipped.
 */
export async function buildFullBackup(
  state: DeerIntelState,
  onProgress?: (done: number, total: number) => void,
): Promise<FullBackupBuildResult> {
  const entries = await getAllLocalImageEntries();
  const cloudIds = missingImageIds(
    state,
    entries.map((entry) => entry.id),
  );
  const fileIds = documentFileIds(state);
  const total = entries.length + cloudIds.length + fileIds.length;
  const images: FullBackupImage[] = [];
  const files: FullBackupFile[] = [];
  let done = 0;
  let missingPhotos = 0;
  let missingDocuments = 0;

  for (const { id, blob } of entries) {
    images.push(await toBackupBlob(id, blob));
    done += 1;
    onProgress?.(done, total);
  }

  // Not on this device: getPhotoImage falls back to the per-user cloud copy
  // (and re-caches it). Signed out or no cloud copy -> null.
  for (const id of cloudIds) {
    const blob = await getPhotoImage(id);

    if (blob) images.push(await toBackupBlob(id, blob));
    else missingPhotos += 1;

    done += 1;
    onProgress?.(done, total);
  }

  for (const id of fileIds) {
    const blob = await getFile(id);

    if (blob) files.push(await toBackupBlob(id, blob));
    else missingDocuments += 1;

    done += 1;
    onProgress?.(done, total);
  }

  return {
    backup: {
      format: FULL_BACKUP_FORMAT,
      version: FULL_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      state,
      images,
      files,
    },
    missingPhotos,
    missingDocuments,
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
    Array.isArray(candidate.images) &&
    // Optional (version 2+); if present it must be a list.
    (candidate.files === undefined || Array.isArray(candidate.files))
  );
}

/** Write every bundled image back into local IndexedDB on this device. */
export async function restoreFullBackupImages(
  images: FullBackupImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<{
  total: number;
  restored: number;
  failed: number;
  restoredIds: string[];
}> {
  const restoredIds: string[] = [];
  let failed = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    try {
      const blob = base64ToBlob(image.dataBase64, image.type);
      const ok = await restoreLocalImage(image.id, blob);

      if (ok) restoredIds.push(image.id);
      else failed += 1;
    } catch {
      failed += 1;
    }

    onProgress?.(index + 1, images.length);
  }

  return {
    total: images.length,
    restored: restoredIds.length,
    failed,
    restoredIds,
  };
}

/** Write every bundled document file back into the local file store. */
export async function restoreFullBackupFiles(
  files: FullBackupFile[],
): Promise<{ total: number; restored: number; failed: number }> {
  let restored = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const ok = await putFile(file.id, base64ToBlob(file.dataBase64, file.type));

      if (ok) restored += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { total: files.length, restored, failed };
}
