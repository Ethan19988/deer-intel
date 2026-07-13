"use client";

import type {
  PhotoStamp,
  PhotoStampStatusResponse,
} from "@/types/photoStamp";

// Client side of the photo-stamp reader. It only ever uploads a small cropped
// strip of the info bar (not the whole scene), and only when the deployment has
// the AI key configured — checked once per session and cached.

// Fraction of the image height (from the bottom) that holds the info bar.
const INFO_BAR_FRACTION = 0.22;
const MAX_STRIP_WIDTH = 1024;
const REQUEST_TIMEOUT_MS = 20_000;

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
 * Read the date/time/temp/moon printed on a trail-cam photo. Returns null when
 * reading is unavailable, the crop fails, or nothing legible was found — callers
 * fall back to EXIF and the weather lookup.
 */
export async function requestPhotoStamp(
  file: File,
  unit: "F" | "C",
): Promise<PhotoStamp | null> {
  if (!(await isConfigured())) return null;

  const cropped = await cropInfoBar(file).catch(() => null);

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

type CroppedStrip = { base64: string; mediaType: string };

async function cropInfoBar(file: File): Promise<CroppedStrip | null> {
  if (!file.type.startsWith("image/")) return null;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (!sourceWidth || !sourceHeight) return null;

    const stripHeight = Math.max(1, Math.round(sourceHeight * INFO_BAR_FRACTION));
    const scale = Math.min(1, MAX_STRIP_WIDTH / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(stripHeight * scale));

    const context = canvas.getContext("2d");

    if (!context) return null;

    context.drawImage(
      image,
      0,
      sourceHeight - stripHeight,
      sourceWidth,
      stripHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
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
