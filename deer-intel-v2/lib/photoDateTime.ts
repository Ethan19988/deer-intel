import {
  isPlausibleCaptureDate,
  pickCaptureDateTime,
} from "@/lib/photoCaptureTime";
import { isUntrustedTimeSource } from "@/lib/photoOptions";
import type { PhotoCaptureTimeSource, PhotoRecord } from "@/types/photo";

// A photo's capture moment is stored as "YYYY-MM-DDTHH:mm" only when a real
// time was read (or typed); otherwise as a bare "YYYY-MM-DD". These helpers
// split/join that value for separate date + time inputs and decide, at import,
// which source to trust.

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DD" for a Date in local time. */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "HH:mm" for a Date in local time. */
export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Split a stored photoDate into its date and (possibly empty) time parts. */
export function splitPhotoDate(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value.trim());

  if (!match) return { date: "", time: "" };

  return { date: match[1], time: match[2] ?? "" };
}

/** Join date + time inputs; no date → "", no time → the bare date. */
export function joinPhotoDate(date: string, time: string): string {
  const day = date.trim();
  const clock = time.trim().slice(0, 5);

  if (!day) return "";

  return /^\d{2}:\d{2}$/.test(clock) ? `${day}T${clock}` : day;
}

/** Whether a stored photoDate carries a time of day. */
export function photoDateHasTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}/.test(value.trim());
}

/**
 * Whether a record's time of day is a real capture time worth charting: it
 * has one, and it didn't come from a file's modified date or a date-only stamp.
 */
export function hasTrustedPhotoTime(
  photo: Pick<PhotoRecord, "photoDate" | "captureTimeSource">,
): boolean {
  return (
    photoDateHasTime(photo.photoDate) &&
    !isUntrustedTimeSource(photo.captureTimeSource)
  );
}

/** "6:42 PM" for an "HH:mm" value; "" when unreadable. */
export function formatClockTime(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) return "";

  const hour = Number(match[1]);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;

  return `${twelve}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Date (and time when present) embedded in a camera file name, e.g.
 * "IMG_20261104_064211.JPG" or "2026-11-04 06-42.jpg". A name with only a
 * date gives a date only — no invented noon.
 */
export function dateFromFileName(
  fileName: string,
  now: Date = new Date(),
): string {
  const match =
    /(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?:[^\d]?(\d{2})[-_:]?(\d{2})(?:[-_:]?(\d{2}))?)?/.exec(
      fileName,
    );

  if (!match) return "";

  const [, year, month, day, hour, minute] = match;
  const date = `${year}-${month}-${day}`;
  const timed =
    hour !== undefined &&
    minute !== undefined &&
    Number(hour) <= 23 &&
    Number(minute) <= 59
      ? `${date}T${hour}:${minute}`
      : date;

  if (isPlausibleCaptureDate(timed, now)) return timed;

  return isPlausibleCaptureDate(date, now) ? date : "";
}

export type ImportCaptureTime = {
  // Stored value: timed only when a real time was read.
  photoDate: string;
  // "" when no date was found at all.
  captureTimeSource: PhotoCaptureTimeSource | "";
  // The file's modified clock time ("HH:mm") offered as a one-tap suggestion
  // when the date came from the file; never saved unless confirmed.
  fileTimeHint: string;
  // Stamp and EXIF disagree, or one had an impossible date.
  clockWarning: boolean;
};

/**
 * Decide a picked photo's capture time, most trustworthy source first:
 * printed stamp / EXIF (see pickCaptureDateTime), then a date-only stamp,
 * then the file name, then the file's modified date — the last stored as a
 * date only, because for a cellular camera it is when the batch arrived.
 */
export function resolveImportCaptureTime({
  fileName,
  lastModified,
  exifDate,
  stampDate,
  now = new Date(),
}: {
  fileName: string;
  lastModified: number;
  exifDate: string;
  stampDate: string;
  now?: Date;
}): ImportCaptureTime {
  const resolved = pickCaptureDateTime(exifDate, stampDate, now);
  const base = { fileTimeHint: "", clockWarning: resolved.clockWarning };

  if (resolved.source === "stamp" || resolved.source === "exif") {
    return { ...base, photoDate: resolved.dateTime, captureTimeSource: resolved.source };
  }

  const fromName = dateFromFileName(fileName, now);

  // A file name with a time beats a date-only stamp; with only a date, the
  // stamp's date is the better-sourced day.
  if (fromName && (photoDateHasTime(fromName) || resolved.source !== "stampDate")) {
    return { ...base, photoDate: fromName, captureTimeSource: "filename" };
  }

  if (resolved.source === "stampDate") {
    return { ...base, photoDate: resolved.dateTime.slice(0, 10), captureTimeSource: "stampDate" };
  }

  if (lastModified > 0) {
    const fileDate = new Date(lastModified);
    const day = toDateInputValue(fileDate);

    if (isPlausibleCaptureDate(day, now)) {
      return {
        ...base,
        photoDate: day,
        captureTimeSource: "file",
        fileTimeHint: toTimeInputValue(fileDate),
      };
    }
  }

  return { ...base, photoDate: "", captureTimeSource: "" };
}
