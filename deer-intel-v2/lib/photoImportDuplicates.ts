import type { PhotoRecord } from "@/types/photo";

// Picking the same camera-roll batch twice would save every photo twice and
// double the camera's counts. A staged photo is a repeat when a saved photo on
// the same camera site has the same original file name and capture time.
// (Photo records keep no file size or hash, so name + time is the key.)

export type ImportCandidate = {
  fileName: string;
  photoDate: string;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/** "camera|name|time" for a photo on a camera; "" when it can't be keyed. */
export function importDuplicateKey(
  cameraId: string,
  fileName: string,
  photoDate: string,
): string {
  const name = normalizeName(fileName);
  const date = photoDate.trim();
  if (!cameraId || !name || !date) return "";

  return `${cameraId}|${name}|${date}`;
}

/** Keys of every saved photo on this camera site, for repeated lookups. */
export function importedPhotoKeys(
  photoRecords: PhotoRecord[],
  cameraId: string,
): Set<string> {
  const keys = new Set<string>();

  for (const record of photoRecords) {
    if (record.cameraSiteId !== cameraId) continue;
    const key = importDuplicateKey(cameraId, record.fileName, record.photoDate);
    if (key) keys.add(key);
  }

  return keys;
}

/** True when this staged photo is already saved on the camera site. */
export function isAlreadyImported(
  candidate: ImportCandidate,
  cameraId: string,
  keys: Set<string>,
): boolean {
  const key = importDuplicateKey(cameraId, candidate.fileName, candidate.photoDate);
  return Boolean(key) && keys.has(key);
}
