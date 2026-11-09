// Open-Meteo (timezone=auto) reports sun times as the property's wall clock,
// "YYYY-MM-DDTHH:MM" with no offset, plus the zone's IANA name (`timezone`)
// and the CURRENT UTC offset (`utc_offset_seconds`). The offset alone is wrong
// for a day on the other side of a DST change (tomorrow's sunrise read on
// Oct 31 with Nov 1's EST clock), so these helpers prefer the IANA zone and
// work the offset out per date; the fixed offset (older cached snapshots) and
// then the device's own zone are fallbacks.

function zoneParts(utcMs: number, timeZone: string): Record<string, number> | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const out: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") out[part.type] = Number(part.value);
    }
    return out;
  } catch {
    return null; // unknown zone name
  }
}

/** The zone's UTC offset in seconds at an instant, or null for a bad zone. */
export function zoneOffsetSeconds(utcMs: number, timeZone: string): number | null {
  const p = zoneParts(utcMs, timeZone);
  if (!p) return null;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 1000);
}

/** True when `timeZone` is a zone name this runtime understands. */
export function isUsableTimeZone(timeZone: string | undefined): timeZone is string {
  return typeof timeZone === "string" && timeZone.length > 0 && zoneParts(0, timeZone) !== null;
}

/**
 * Parse an Open-Meteo local "YYYY-MM-DDTHH:MM" (the property's wall clock)
 * into a real instant: with the IANA zone, using that date's own offset; else
 * with the response's fixed UTC offset; else as device-local time.
 */
export function parseForecastLocal(
  iso: string | undefined,
  utcOffsetSeconds?: number,
  timeZone?: string,
): Date | null {
  if (!iso) return null;
  const [date, time = "00:00"] = iso.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (!year || !month || !day) return null;
  const wallAsUtc = Date.UTC(year, month - 1, day, hours || 0, minutes || 0);

  if (isUsableTimeZone(timeZone)) {
    // Two passes: the offset at the first guess can differ from the offset at
    // the answer right around a DST change.
    const first = zoneOffsetSeconds(wallAsUtc, timeZone) ?? 0;
    const guess = wallAsUtc - first * 1000;
    const second = zoneOffsetSeconds(guess, timeZone) ?? first;
    return new Date(wallAsUtc - second * 1000);
  }

  if (typeof utcOffsetSeconds === "number" && Number.isFinite(utcOffsetSeconds)) {
    return new Date(wallAsUtc - utcOffsetSeconds * 1000);
  }
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

/**
 * "4:27 PM" on the property's clock: in the IANA zone when known, else by the
 * fixed UTC offset (shift the instant, format as UTC), else the device's.
 * Newer ICU puts a narrow no-break space before AM/PM; it's kept plain.
 */
export function forecastClock(
  date: Date,
  utcOffsetSeconds?: number,
  timeZone?: string,
): string {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  let text: string;
  if (isUsableTimeZone(timeZone)) {
    text = date.toLocaleTimeString("en-US", { ...options, timeZone });
  } else if (typeof utcOffsetSeconds === "number" && Number.isFinite(utcOffsetSeconds)) {
    text = new Date(date.getTime() + utcOffsetSeconds * 1000).toLocaleTimeString("en-US", {
      ...options,
      timeZone: "UTC",
    });
  } else {
    text = date.toLocaleTimeString("en-US", options);
  }
  return text.replace(/\s/g, " ");
}

/**
 * Format an Open-Meteo wall-clock time ("2026-11-08T06:52") as a time label in
 * the viewer's locale, exactly as written — no zone conversion, so it reads
 * the property's clock whatever zone the phone is in. "" when unparseable.
 */
export function formatWallClock(iso: string | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return "";
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
