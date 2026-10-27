import { NextResponse } from "next/server";
import {
  PhotoVisionError,
  isPhotoVisionConfigured,
  readPhotoStamp,
  type PhotoStampUnit,
} from "@/lib/photoStampVision";
import type { KnownBuckSummary } from "@/types/photoStamp";
import { guardPaidRoute } from "@/lib/apiGuard";

// Reading the printed info bar off a photo is opt-in and pay-per-call, so:
//   GET  -> cheap "is this configured" check the client uses before uploading
//           anything, so photos are never sent when no key is set.
//   POST -> the actual vision call, made only for a cropped info-bar strip.

// Guard against oversized uploads (the client sends a downscaled photo).
const MAX_BASE64_LENGTH = 2_000_000;
// A property should not have hundreds of tracked bucks; cap the list and the
// per-field lengths so the prompt cannot be ballooned.
const MAX_KNOWN_BUCKS = 40;
// Image types the vision API accepts; anything else falls back to JPEG.
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
// A camera-card import can read a few hundred photos in one sitting.
const PHOTO_STAMP_LIMITS = {
  limit: 400,
  windowMs: 60 * 60 * 1000,
  maxBodyBytes: MAX_BASE64_LENGTH + 100_000,
};

function sanitizeKnownBucks(value: unknown): KnownBuckSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_KNOWN_BUCKS)
    .map((entry) => {
      const record = entry as {
        id?: unknown;
        name?: unknown;
        description?: unknown;
      } | null;
      const id =
        record && typeof record.id === "string" ? record.id.slice(0, 100) : "";
      const name =
        record && typeof record.name === "string"
          ? record.name.slice(0, 80)
          : "";
      const description =
        record && typeof record.description === "string"
          ? record.description.slice(0, 400)
          : "";

      return { id, name, description };
    })
    .filter((buck) => buck.id && buck.name);
}

export async function GET() {
  return NextResponse.json({ configured: isPhotoVisionConfigured() });
}

export async function POST(request: Request) {
  const guard = await guardPaidRoute(request, "photo-stamp", PHOTO_STAMP_LIMITS);
  if (!guard.ok) return guard.response;

  const input = guard.body as {
    imageBase64?: unknown;
    mediaType?: unknown;
    unit?: unknown;
    knownBucks?: unknown;
  } | null;

  const imageBase64 =
    input && typeof input.imageBase64 === "string" ? input.imageBase64 : "";

  if (!imageBase64) {
    return NextResponse.json(
      { error: "Request is missing the image to read." },
      { status: 400 },
    );
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Image is too large to read." },
      { status: 413 },
    );
  }

  const mediaType =
    input &&
    typeof input.mediaType === "string" &&
    ALLOWED_MEDIA_TYPES.has(input.mediaType)
      ? input.mediaType
      : "image/jpeg";
  const unit: PhotoStampUnit = input && input.unit === "C" ? "C" : "F";
  const knownBucks = sanitizeKnownBucks(input?.knownBucks);

  try {
    const stamp = await readPhotoStamp(imageBase64, mediaType, unit, knownBucks);

    return NextResponse.json({ stamp });
  } catch (error) {
    if (error instanceof PhotoVisionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Reading the photo hit an unexpected error." },
      { status: 500 },
    );
  }
}
