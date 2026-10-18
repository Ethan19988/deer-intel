import { getPhotoImage } from "@/lib/imageStore";

// Many trail-cam photos get saved as phone screenshots of the camera maker's
// app: the actual picture sits in a band with the app's status bar, black
// info panel, and buttons around it. This finds that band so the app can show
// just the deer.
//
// How: real photo rows are textured all the way across, while app chrome rows
// are mostly one flat color (a few lines of text on a solid panel). The
// longest run of textured rows is the photo. Only tall (screenshot-shaped)
// images are considered, so ordinary landscape camera photos are never cut.

export type CropBox = { left: number; top: number; right: number; bottom: number };

/** Images narrower than this ratio (height / width) are left alone. */
export const SCREENSHOT_MIN_ASPECT = 1.2;
const ANALYSIS_WIDTH = 160;
// A line is "flat" when most of its pixels share one color (+/- 3 levels).
const FLAT_TOLERANCE = 3;
const FLAT_SHARE = 0.6;
const MIN_STD = 4;
// Keep a band only if it's a real chunk of the image but not nearly all of it.
const MIN_BAND_SHARE = 0.1;
const MAX_BAND_SHARE = 0.92;

function isTextured(values: number[]): boolean {
  const counts = new Map<number, number>();
  let mode = values[0] ?? 0;
  let modeCount = 0;
  let sum = 0;
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (next > modeCount) {
      modeCount = next;
      mode = value;
    }
    sum += value;
  }
  const mean = sum / values.length;
  let flat = 0;
  let variance = 0;
  for (const value of values) {
    if (Math.abs(value - mode) <= FLAT_TOLERANCE) flat += 1;
    variance += (value - mean) ** 2;
  }
  return flat / values.length < FLAT_SHARE && Math.sqrt(variance / values.length) > MIN_STD;
}

/** Longest run of true values, merging runs split by gaps of up to `maxGap`. */
function longestRun(flags: boolean[], maxGap: number): [number, number] | null {
  const runs: Array<[number, number]> = [];
  let start = -1;
  flags.concat(false).forEach((flag, index) => {
    if (flag && start < 0) start = index;
    if (!flag && start >= 0) {
      const last = runs[runs.length - 1];
      if (last && start - last[1] <= maxGap) last[1] = index;
      else runs.push([start, index]);
      start = -1;
    }
  });
  return runs.reduce<[number, number] | null>(
    (best, run) => (!best || run[1] - run[0] > best[1] - best[0] ? run : best),
    null,
  );
}

/**
 * Pure: the photo band inside a grayscale image (0-255 values, row-major), in
 * that image's pixel coordinates, or null when the whole image is the photo.
 */
export function detectPhotoBand(
  gray: ArrayLike<number>,
  width: number,
  height: number,
): CropBox | null {
  if (width === 0 || height < width * SCREENSHOT_MIN_ASPECT) return null;

  const rowFlags: boolean[] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) row.push(gray[y * width + x]);
    rowFlags.push(isTextured(row));
  }

  const rows = longestRun(rowFlags, Math.max(2, Math.round(height * 0.02)));
  if (!rows) return null;
  const bandHeight = rows[1] - rows[0];
  if (bandHeight < height * MIN_BAND_SHARE || bandHeight > height * MAX_BAND_SHARE) {
    return null;
  }

  // Trim flat side margins (e.g. a card inset) within the band.
  const columnFlags: boolean[] = [];
  for (let x = 0; x < width; x += 1) {
    const column: number[] = [];
    for (let y = rows[0]; y < rows[1]; y += 1) column.push(gray[y * width + x]);
    columnFlags.push(isTextured(column));
  }
  const columns = longestRun(columnFlags, Math.max(2, Math.round(width * 0.03))) ?? [0, width];
  const left = columns[1] - columns[0] > width * 0.5 ? columns[0] : 0;
  const right = columns[1] - columns[0] > width * 0.5 ? columns[1] : width;

  return { left, top: rows[0], right, bottom: rows[1] };
}

const displayUrlCache = new Map<string, Promise<string | null>>();

async function cropBlob(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return blob;
  }
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.height < bitmap.width * SCREENSHOT_MIN_ASPECT) return blob;

    const scale = ANALYSIS_WIDTH / bitmap.width;
    const smallHeight = Math.max(1, Math.round(bitmap.height * scale));
    const probe = document.createElement("canvas");
    probe.width = ANALYSIS_WIDTH;
    probe.height = smallHeight;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) return blob;
    probeContext.drawImage(bitmap, 0, 0, ANALYSIS_WIDTH, smallHeight);
    const { data } = probeContext.getImageData(0, 0, ANALYSIS_WIDTH, smallHeight);
    const gray = new Uint8ClampedArray(ANALYSIS_WIDTH * smallHeight);
    for (let i = 0; i < gray.length; i += 1) {
      gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    }

    const band = detectPhotoBand(gray, ANALYSIS_WIDTH, smallHeight);
    if (!band) return blob;

    const sx = Math.floor(band.left / scale);
    const sy = Math.floor(band.top / scale);
    const sw = Math.min(bitmap.width - sx, Math.ceil((band.right - band.left) / scale));
    const sh = Math.min(bitmap.height - sy, Math.ceil((band.bottom - band.top) / scale));
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")?.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    return await new Promise<Blob>((resolve) =>
      out.toBlob((result) => resolve(result ?? blob), "image/jpeg", 0.9),
    );
  } finally {
    bitmap.close();
  }
}

/**
 * Object URL for showing a stored photo: just the camera picture when the
 * stored image is an app screenshot, otherwise the image as-is. Cached for
 * the session (URLs are shared, so callers must not revoke them).
 */
export function getDisplayPhotoUrl(imageId: string): Promise<string | null> {
  const cached = displayUrlCache.get(imageId);
  if (cached) return cached;

  const pending = getPhotoImage(imageId)
    .then(async (blob) => {
      if (!blob) return null;
      const shown = await cropBlob(blob).catch(() => blob);
      return URL.createObjectURL(shown);
    })
    .catch(() => null);

  displayUrlCache.set(imageId, pending);
  pending.then((url) => {
    // Don't cache misses; the image may arrive later (sync, restore).
    if (!url) displayUrlCache.delete(imageId);
  });
  return pending;
}
