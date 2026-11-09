import { frameDirectionToHeading } from "@/lib/travelDirection";
import type { PhotoRecord } from "@/types/photo";

// A photo's compass heading is the AI's frame read ("Left to right") turned
// through the camera's facing direction. When the facing behind it changes —
// the photo is moved to another camera, the draft's camera is switched, or the
// camera is re-pointed — the heading must be recomputed, but only while it is
// still the auto-derived one: a heading the hunter typed in stays put.

/**
 * The heading to keep after the facing changes from `oldFacing` to
 * `newFacing`. Returns `current` untouched when there's no frame read, or when
 * `current` was set by hand (it differs from what the old facing produced).
 * Returns "" when the new facing can't produce a heading.
 */
export function recomputeHeading(
  frameDirection: string | undefined,
  current: string | undefined,
  oldFacing: string | undefined,
  newFacing: string | undefined,
): string {
  const frame = (frameDirection ?? "").trim();
  const heading = (current ?? "").trim();

  if (!frame) return heading;

  const previousAuto = frameDirectionToHeading(frame, oldFacing ?? "");

  if (heading && heading !== previousAuto) return heading;

  return frameDirectionToHeading(frame, newFacing ?? "");
}

/** A saved photo with its heading recomputed for a new facing direction. */
export function retargetPhotoHeading(
  photo: PhotoRecord,
  oldFacing: string | undefined,
  newFacing: string | undefined,
): PhotoRecord {
  if (!photo.frameDirection) return photo;

  const next = recomputeHeading(
    photo.frameDirection,
    photo.travelDirection,
    oldFacing,
    newFacing,
  );

  if (next === (photo.travelDirection ?? "")) return photo;

  return { ...photo, travelDirection: next || undefined };
}

/**
 * Recompute headings on every photo of one camera after its facing direction
 * changed (e.g. the hunter corrected where it points). Other photos are
 * returned as-is (same objects).
 */
export function retargetCameraPhotoHeadings(
  photos: PhotoRecord[],
  cameraId: string,
  oldFacing: string | undefined,
  newFacing: string | undefined,
): PhotoRecord[] {
  if ((oldFacing ?? "") === (newFacing ?? "")) return photos;

  return photos.map((photo) =>
    photo.cameraSiteId === cameraId
      ? retargetPhotoHeading(photo, oldFacing, newFacing)
      : photo,
  );
}
