import { NextResponse } from "next/server";
import {
  PhotoVisionError,
  isPhotoVisionConfigured,
  readPhotoStamp,
  type PhotoStampUnit,
} from "@/lib/photoStampVision";
import type { KnownBuckSummary } from "@/types/photoStamp";

// Reading the printed info bar off a photo is opt-in and pay-per-call, so:
//   GET  -> cheap "is this configured" check the client uses before uploading
//           anything, so photos are never sent when no key is set.
//   POST -> the actual vision call, made only for a cropped info-bar strip.

// Guard against oversized uploads (the client sends a downscaled photo).
const MAX_BASE64_LENGTH = 2_000_000;
// A property should not have hundreds of tracked bucks; cap the list and the
// per-field lengths so the prompt cannot be ballooned.
const MAX_KNOWN_BUCKS = 40;

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
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const input = body as {
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
    input && typeof input.mediaType === "string" && input.mediaType
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
