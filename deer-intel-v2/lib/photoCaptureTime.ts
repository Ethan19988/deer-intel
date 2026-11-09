import { dateInputTime } from "@/lib/photos";

// Where a photo's capture time came from, most to least authoritative.
export type CaptureTimeSource = "stamp" | "exif" | "stampDate" | "none";

export type ResolvedCaptureTime = {
  // "YYYY-MM-DDTHH:mm" from a timed source, "YYYY-MM-DD" from a date-only
  // stamp, or "" when neither EXIF nor a stamp gave us anything usable.
  dateTime: string;
  source: CaptureTimeSource;
  // The stamp and EXIF disagree by more than a day, or one of them carries an
  // impossible date (a camera reset to 2000, a date in the future): the
  // camera's clock is probably wrong, so the hunter should check the time.
  clockWarning: boolean;
};

/** Trail cams that predate this year don't exist in anyone's data here; a
 *  reading earlier than it is a camera whose clock reset (often to 2000). */
export const MIN_CAPTURE_YEAR = 2015;
const DAY_MS = 86_400_000;

/**
 * Whether a "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" value is a believable capture
 * time: parseable, not before MIN_CAPTURE_YEAR, and not in the future (a day
 * of slack covers time zones and a camera clock a few hours fast).
 */
export function isPlausibleCaptureDate(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return false;

  const [, year, month, day, hour, minute] = match;
  if (Number(year) < MIN_CAPTURE_YEAR) return false;
  if (Number(month) < 1 || Number(month) > 12) return false;
  if (Number(day) < 1 || Number(day) > 31) return false;
  if (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59)) return false;

  const time = dateInputTime(value.trim().slice(0, hour !== undefined ? 16 : 10));
  if (Number.isNaN(time)) return false;

  return time <= now.getTime() + DAY_MS;
}

function hasTime(value: string): boolean {
  return value.length > 10;
}

/** Whether the two readings are more than a day apart. A date-only stamp is
 *  compared day-to-day, so it only disagrees when the days differ by 2+. */
function readingsDisagree(exifDate: string, stampDate: string): boolean {
  if (hasTime(stampDate)) {
    return Math.abs(dateInputTime(stampDate) - dateInputTime(exifDate)) > DAY_MS;
  }

  const stampDay = dateInputTime(stampDate.slice(0, 10));
  const exifDay = dateInputTime(exifDate.slice(0, 10));

  return Math.abs(stampDay - exifDay) > DAY_MS;
}

/**
 * Resolve a trail-camera photo's true capture time from the two things we can
 * read off it: the file's EXIF date and the AI-read printed info-bar stamp.
 *
 * The stamp is burned into the pixels by the camera at the moment of capture,
 * so it survives every transfer untouched; EXIF can be rewritten by cellular
 * apps and share exports. So a stamp with a time wins — unless it and EXIF
 * disagree by more than a day. That much disagreement means the camera's own
 * clock is off (dead battery reset, never set), so EXIF is used and the
 * hunter is warned. Impossible dates (before 2015, in the future) from either
 * source are discarded and also raise the warning.
 */
export function pickCaptureDateTime(
  exifDate: string,
  stampDate: string,
  now: Date = new Date(),
): ResolvedCaptureTime {
  const rawExif = exifDate.trim();
  const rawStamp = stampDate.trim();
  const exif = rawExif && isPlausibleCaptureDate(rawExif, now) ? rawExif : "";
  const stamp = rawStamp && isPlausibleCaptureDate(rawStamp, now) ? rawStamp : "";
  const discarded = Boolean((rawExif && !exif) || (rawStamp && !stamp));

  if (stamp && exif && readingsDisagree(exif, stamp)) {
    return { dateTime: exif, source: "exif", clockWarning: true };
  }

  if (stamp && hasTime(stamp)) {
    return { dateTime: stamp, source: "stamp", clockWarning: discarded };
  }
  if (exif) return { dateTime: exif, source: "exif", clockWarning: discarded };
  if (stamp) return { dateTime: stamp, source: "stampDate", clockWarning: discarded };

  return { dateTime: "", source: "none", clockWarning: discarded };
}
