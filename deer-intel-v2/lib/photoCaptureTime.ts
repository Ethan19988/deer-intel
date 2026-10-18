// Where a photo's capture time came from, most to least authoritative.
export type CaptureTimeSource = "stampTime" | "exif" | "stampDate" | "none";

export type ResolvedCaptureTime = {
  // "YYYY-MM-DDTHH:mm" from a timed source, "YYYY-MM-DD" from a date-only
  // stamp, or "" when neither EXIF nor a stamp gave us anything.
  dateTime: string;
  source: CaptureTimeSource;
};

/**
 * Resolve a trail-camera photo's true capture time from the two things we can
 * read off it: the file's EXIF date and the AI-read printed info-bar stamp.
 *
 * The stamp is burned into the pixels by the camera at the moment of capture,
 * so it survives every transfer untouched. EXIF does not: cellular cameras and
 * app/share exports (screenshots included) re-encode the file and rewrite
 * DateTimeOriginal to the *download* time — often hours off from when the deer
 * actually walked by. So a stamp that carries a time is the most trustworthy
 * source; EXIF (lossless and exact for photos pulled straight off the SD card)
 * comes next; a date-only stamp is the last structured source before callers
 * fall back to the filename or the file's own modified date.
 */
export function pickCaptureDateTime(
  exifDate: string,
  stampDate: string,
): ResolvedCaptureTime {
  // A stamp with a time is "YYYY-MM-DDTHH:mm" (11+ chars); a date-only stamp
  // is "YYYY-MM-DD" (10 chars).
  const stampHasTime = stampDate.length > 10;

  if (stampHasTime) return { dateTime: stampDate, source: "stampTime" };
  if (exifDate) return { dateTime: exifDate, source: "exif" };
  if (stampDate) return { dateTime: stampDate, source: "stampDate" };

  return { dateTime: "", source: "none" };
}
