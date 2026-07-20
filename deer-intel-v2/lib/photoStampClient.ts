"use client";

import type {
  KnownBuckSummary,
  PhotoStamp,
  PhotoStampStatusResponse,
} from "@/types/photoStamp";

// Client side of the photo reader. It uploads a downscaled copy of the whole
// photo — the AI reads the printed info bar AND identifies the animal in the
// frame — and only when the deployment has the AI key configured, checked once
// per session and cached.

// Longest edge sent to vision; enough to read stamp text and count points
// without uploading multi-megabyte originals.
const MAX_EDGE_PIXELS = 1568;
const REQUEST_TIMEOUT_MS = 30_000;

let configuredPromise: Promise<boolean> | null = null;

/** Whether this deployment has photo reading enabled (cached per session). */
function isConfigured(): Promise<boolean> {
  if (!configuredPromise) {
    configuredPromise = fetch("/api/photo-stamp", { method: "GET" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<PhotoStampStatusResponse>)
          : { configured: false },
      )
      .then((data) => Boolean(data.configured))
      .catch(() => false);
  }

  return configuredPromise;
}

/**
 * Read a trail-cam photo: the date/time/temp/moon printed on its info bar plus
 * an identification of the animal in the frame. Returns null when reading is
 * unavailable or nothing was found — callers fall back to EXIF, the weather
 * lookup, and manual species entry.
 */
export async function requestPhotoStamp(
  file: Blob,
  unit: "F" | "C",
  knownBucks: KnownBuckSummary[] = [],
): Promise<PhotoStamp | null> {
  if (!(await isConfigured())) return null;

  const cropped = await prepareVisionImage(file).catch(() => null);

  if (!cropped) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/photo-stamp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageBase64: cropped.base64,
        mediaType: cropped.mediaType,
        unit,
        knownBucks,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { stamp?: PhotoStamp | null };

    return data.stamp ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type VisionImage = { base64: string; mediaType: string };

// Downscale the whole photo for vision: the full frame is needed to identify
// the animal, and the info bar stays legible at this size. Accepts a Blob so
// it works on a freshly picked File and on an image blob re-read from storage.
async function prepareVisionImage(file: Blob): Promise<VisionImage | null> {
  if (!file.type.startsWith("image/")) return null;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (!sourceWidth || !sourceHeight) return null;

    const scale = Math.min(
      1,
      MAX_EDGE_PIXELS / Math.max(sourceWidth, sourceHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext("2d");

    if (!context) return null;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1] ?? "";

    return base64 ? { base64, mediaType: "image/jpeg" } : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the image."));
    image.src = url;
  });
}
