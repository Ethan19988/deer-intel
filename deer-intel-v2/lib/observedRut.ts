import { isBuckRecord, isDeerPhotoRecord } from "@/lib/hourlyActivity";
import { hasTrustedPhotoTime, trustedPhotoDate } from "@/lib/photoDateTime";
import { getPhotoDeerProfileIds } from "@/lib/photos";
import {
  rutPhaseLabel,
  rutPhaseSteps,
  type RutPhase,
} from "@/lib/seasonCalendar";
import { isSitHunt, legalLight, type SunTimes } from "@/lib/standStats";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";

// "Rut phase from your own photos": a read of where the rut stands on THIS
// ground from the hunter's own recent data, shown under the calendar estimate.
// Pure and deterministic so it can be unit-tested.
//
// Windows: the last WINDOW_DAYS days (today counts as day 0) vs the WINDOW_DAYS
// before that. Inputs and how each one is used:
//   - Photos: deer only (same allow-list as the activity chart). Buck = linked
//     to a buck / antlered label; doe = "Doe" label without a buck link. Behavior
//     tags drive chasing / scrape-rub / feeding counts. Only photos with a
//     TRUSTED capture time (stamp, EXIF, timed file name, typed) count toward
//     daylight, judged against PA legal light from computed sun times.
//   - Camera checks: buck/doe tallies, but only for checks with no photo records
//     attached (otherwise the same deer would be counted twice).
//   - Sits: bucks/does seen in person (all daylight by definition); notes that
//     mention chasing / scrapes / rubs add to those signals.
//   - Pins: Scrape / Rub / Rub Line pins created in the window = fresh sign.
//
// Signals (each a plain count, then scored per phase):
//   seeking  — fresh scrape/rub sign (photo tags, new pins, sit notes) with
//              little chasing yet; buck share or buck daylight rising helps.
//   chasing  — chasing tags / notes; buck daylight and buck share rising help.
//   peak     — chasing plus bucks photographed with does (2+ deer in a buck
//              photo); only called with strong chasing evidence.
//   lockdown — buck sightings fall by half or more while does keep showing,
//              with little chasing.
//   post-rut — chasing that was there has faded and bucks are back on food.
// The best-scoring phase wins only above a floor and with a clear margin;
// otherwise "unclear". Confidence is capped by sample size so a thin week is
// never stated strongly.

export const OBSERVED_RUT_WINDOW_DAYS = 10;
/** Fewer deer photos / sightings than this in the window and no read is made. */
export const OBSERVED_RUT_MIN_SAMPLE = 8;
export const OBSERVED_RUT_NOT_ENOUGH =
  "Not enough recent photos to read the rut on your ground — calendar estimate shown.";

export type ObservedRutPhase =
  | "seeking"
  | "chasing"
  | "peak"
  | "lockdown"
  | "post-rut"
  | "unclear";

export type ObservedRutConfidence = "low" | "medium" | "high";

export type ObservedRutWindowCounts = {
  /** Deer photos plus deer seen on sits / tallied on photo-less checks. */
  deer: number;
  bucks: number;
  does: number;
  /** Bucks in legal light: trusted-time photos plus bucks seen on sits. */
  buckDaylight: number;
  /** Chasing photo tags + sit notes mentioning chasing/tending/grunting. */
  chasing: number;
  /** Of `chasing`, how many came from sit notes. */
  chasingNotes: number;
  /** Scrape/rub photo tags + new scrape/rub pins + sit notes mentioning them. */
  scrapeSign: number;
  /** Of `scrapeSign`, how many are newly marked pins. */
  signPins: number;
  /** Buck photos tagged Feeding. */
  buckFeeding: number;
  /** Buck photos with 2+ deer in frame (buck with does). */
  buckWithDoes: number;
};

export type ObservedRutRead = {
  phase: ObservedRutPhase;
  /** "Chasing", "Lockdown", … or "Unclear". */
  phaseLabel: string;
  confidence: ObservedRutConfidence;
  /** Short plain-language lines, most relevant first. */
  evidence: string[];
  /** Deer photos + sightings in the recent window. */
  sampleSize: number;
  enoughData: boolean;
  windowDays: number;
  /** Observed vs calendar: positive = ahead, negative = behind; null = n/a. */
  calendarSteps: number | null;
  /** "ahead of the calendar" / "behind the calendar" / "" when same or n/a. */
  calendarNote: string;
  /** One sentence, never overstated: "Your cameras suggest …". */
  summary: string;
  recent: ObservedRutWindowCounts;
  prior: ObservedRutWindowCounts;
};

export type ObservedRutInput = {
  now: Date;
  photos: PhotoRecord[];
  cameraChecks?: CameraCheck[];
  hunts?: HuntLogEntry[];
  pins?: MapPin[];
  /** Sun times for a "YYYY-MM-DD" (e.g. createStatsContext(...).sunFor). */
  sunFor: (dateKey: string) => SunTimes | null;
  /** Today's calendar phase, to say "ahead"/"behind". */
  calendarPhase?: RutPhase;
  windowDays?: number;
};

const DAY_MS = 86_400_000;
const CHASE_NOTE = /\bchas(e|ed|es|ing)\b|\btending\b|\bgrunt(ing|ed)?\b/i;
const SIGN_NOTE = /\bscrapes?\b|\brubs?\b|\brub line\b/i;
const SIGN_PINS = new Set<string>(["Scrape", "Rub", "Rub Line"]);

function emptyCounts(): ObservedRutWindowCounts {
  return {
    deer: 0,
    bucks: 0,
    does: 0,
    buckDaylight: 0,
    chasing: 0,
    chasingNotes: 0,
    scrapeSign: 0,
    signPins: 0,
    buckFeeding: 0,
    buckWithDoes: 0,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local "YYYY-MM-DD" for a stored date, datetime, or ISO timestamp. */
export function localDayKey(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  const plain = /^(\d{4}-\d{2}-\d{2})(?:$|[T ]\d{1,2}:\d{2}(?::\d{2})?$)/.exec(raw);
  // Bare dates and zone-less "date + clock" values are already local.
  if (plain) return plain[1];
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from a "YYYY-MM-DD" to now (0 = today); null when unreadable. */
function daysAgo(dayKey: string | null, now: Date): number | null {
  if (!dayKey) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - day.getTime()) / DAY_MS);
}

/** Which window a day falls in, or null when outside both / in the future. */
function bucketFor(
  dayKey: string | null,
  now: Date,
  windowDays: number,
): "recent" | "prior" | null {
  const ago = daysAgo(dayKey, now);
  if (ago === null || ago < 0) return null;
  if (ago < windowDays) return "recent";
  if (ago < windowDays * 2) return "prior";
  return null;
}

function isBuckPhoto(photo: PhotoRecord): boolean {
  return isBuckRecord(photo) || getPhotoDeerProfileIds(photo).length > 0;
}

function isDoePhoto(photo: PhotoRecord): boolean {
  return /\bdoes?\b/i.test(photo.species ?? "") && !isBuckPhoto(photo);
}

/** Minutes after local midnight of a trusted capture time, else null. */
function trustedMinutes(photo: PhotoRecord): number | null {
  if (!hasTrustedPhotoTime(photo)) return null;
  const match = /[T ](\d{1,2}):(\d{2})/.exec(trustedPhotoDate(photo));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function inLegalLight(
  photo: PhotoRecord,
  dayKey: string,
  sunFor: ObservedRutInput["sunFor"],
): boolean {
  const minutes = trustedMinutes(photo);
  if (minutes === null) return false;
  const sun = sunFor(dayKey);
  if (!sun) return false;
  const { start, end } = legalLight(sun);
  return minutes >= start && minutes <= end;
}

function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/** Tally both windows from the hunter's records. */
export function countObservedRutWindows(
  input: ObservedRutInput,
): { recent: ObservedRutWindowCounts; prior: ObservedRutWindowCounts } {
  const windowDays = input.windowDays ?? OBSERVED_RUT_WINDOW_DAYS;
  const windows = { recent: emptyCounts(), prior: emptyCounts() };
  const { now } = input;

  const checkIdsWithPhotos = new Set<string>();
  for (const photo of input.photos) {
    if (photo.cameraCheckId) checkIdsWithPhotos.add(photo.cameraCheckId);
    if (!isDeerPhotoRecord(photo)) continue;
    const dayKey = localDayKey(photo.photoDate);
    const bucket = bucketFor(dayKey, now, windowDays);
    if (!bucket || !dayKey) continue;
    const counts = windows[bucket];
    const behavior = photo.behavior ?? "";
    const buck = isBuckPhoto(photo);

    counts.deer += 1;
    if (buck) {
      counts.bucks += 1;
      if (inLegalLight(photo, dayKey, input.sunFor)) counts.buckDaylight += 1;
      if (/feed/i.test(behavior)) counts.buckFeeding += 1;
      if (nonNegative(photo.deerCount) >= 2) counts.buckWithDoes += 1;
    } else if (isDoePhoto(photo)) {
      counts.does += 1;
    }
    if (/chas/i.test(behavior)) counts.chasing += 1;
    if (/scrape|rub/i.test(behavior)) counts.scrapeSign += 1;
  }

  for (const check of input.cameraChecks ?? []) {
    if (checkIdsWithPhotos.has(check.id)) continue;
    const bucket = bucketFor(localDayKey(check.date), now, windowDays);
    if (!bucket) continue;
    const bucks = nonNegative(check.bucks);
    const does = nonNegative(check.does);
    windows[bucket].bucks += bucks;
    windows[bucket].does += does;
    windows[bucket].deer += bucks + does;
  }

  for (const hunt of input.hunts ?? []) {
    if (!isSitHunt(hunt)) continue;
    const bucket = bucketFor(localDayKey(hunt.date), now, windowDays);
    if (!bucket) continue;
    const counts = windows[bucket];
    const bucks = nonNegative(hunt.bucks);
    const does = nonNegative(hunt.does);
    counts.bucks += bucks;
    counts.does += does;
    counts.deer += bucks + does;
    // A sit is in legal light, so every buck seen is a daylight buck.
    counts.buckDaylight += bucks;
    if (CHASE_NOTE.test(hunt.notes ?? "")) {
      counts.chasing += 1;
      counts.chasingNotes += 1;
    }
    if (SIGN_NOTE.test(hunt.notes ?? "")) counts.scrapeSign += 1;
  }

  for (const pin of input.pins ?? []) {
    if (!SIGN_PINS.has(pin.type)) continue;
    const bucket = bucketFor(localDayKey(pin.createdAt), now, windowDays);
    if (!bucket) continue;
    windows[bucket].scrapeSign += 1;
    windows[bucket].signPins += 1;
  }

  return windows;
}

function share(bucks: number, does: number): number | null {
  const total = bucks + does;
  return total > 0 ? bucks / total : null;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "3 chasing photos + 1 sit note in 10 days", or "" with none. */
function chasingLine(counts: ObservedRutWindowCounts, span: string): string {
  const photos = counts.chasing - counts.chasingNotes;
  const parts = [
    photos > 0 ? plural(photos, "chasing photo") : "",
    counts.chasingNotes > 0
      ? `${plural(counts.chasingNotes, "sit note")}${photos > 0 ? "" : " on chasing"}`
      : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" + ")} ${span}` : "";
}

/** "2 new scrape/rub pins + 1 scrape/rub photo or note in 10 days", or "". */
function scrapeSignLine(counts: ObservedRutWindowCounts, span: string): string {
  const other = counts.scrapeSign - counts.signPins;
  const parts = [
    counts.signPins > 0 ? plural(counts.signPins, "new scrape/rub pin") : "",
    other > 0 ? `${other} scrape/rub photo${other === 1 ? "" : "s"} or note${other === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" + ")} ${span}` : "";
}

function sampleLine(count: number): string {
  return `${count} deer photo${count === 1 ? "" : "s"}/sighting${count === 1 ? "" : "s"}`;
}

export type ObservedRutScore = { phase: Exclude<ObservedRutPhase, "unclear">; score: number; evidence: string[] };

/**
 * Score each phase from the two windows' counts. Exported for tests; the UI
 * uses readObservedRut.
 */
export function scoreObservedRut(
  recent: ObservedRutWindowCounts,
  prior: ObservedRutWindowCounts,
  windowDays: number = OBSERVED_RUT_WINDOW_DAYS,
): ObservedRutScore[] {
  const span = `in ${windowDays} days`;
  const recentShare = share(recent.bucks, recent.does);
  const priorShare = share(prior.bucks, prior.does);
  // Needs a few deer in both windows before a share shift means anything.
  const shareUp =
    recentShare !== null &&
    priorShare !== null &&
    recent.bucks + recent.does >= 5 &&
    prior.bucks + prior.does >= 5 &&
    recentShare - priorShare >= 0.1;
  const shareLine = shareUp
    ? `Bucks ${Math.round((recentShare as number) * 100)}% of deer seen, up from ${Math.round((priorShare as number) * 100)}%`
    : "";
  const daylightUp = recent.buckDaylight >= 2 && recent.buckDaylight > prior.buckDaylight;
  const daylightLine = daylightUp
    ? `Buck daylight sightings up from ${prior.buckDaylight} to ${recent.buckDaylight}`
    : "";
  const chaseLine = chasingLine(recent, span);
  const signLine = scrapeSignLine(recent, span);

  const scored: ObservedRutScore[] = [];

  // Seeking: sign going down, little chasing yet.
  {
    let score = 0;
    const evidence: string[] = [];
    if (recent.scrapeSign >= 2) score += 2;
    else if (recent.scrapeSign === 1) score += 1;
    if (signLine) evidence.push(signLine);
    if (recent.chasing <= 1 && score > 0) {
      if (shareUp) {
        score += 1;
        evidence.push(shareLine);
      }
      if (daylightUp) {
        score += 1;
        evidence.push(daylightLine);
      }
    }
    if (recent.chasing >= 2) score -= 1;
    scored.push({ phase: "seeking", score, evidence });
  }

  // Chasing.
  {
    let score = 0;
    const evidence: string[] = [];
    if (recent.chasing >= 4) score += 3;
    else if (recent.chasing >= 2) score += 2;
    if (chaseLine) evidence.push(chaseLine);
    if (score > 0) {
      if (daylightUp) {
        score += 1;
        evidence.push(daylightLine);
      }
      if (shareUp) {
        score += 1;
        evidence.push(shareLine);
      }
    }
    scored.push({ phase: "chasing", score, evidence });
  }

  // Peak: strong chasing plus bucks photographed with does. A camera can't
  // see breeding, so this needs both and still never beats a tie with chasing.
  {
    let score = 0;
    const evidence: string[] = [];
    if (recent.chasing >= 3 && recent.buckWithDoes >= 2) {
      score = 3;
      evidence.push(chaseLine);
      evidence.push(`${plural(recent.buckWithDoes, "buck photo")} with does in frame`);
      if (daylightUp) {
        score += 1;
        evidence.push(daylightLine);
      }
    }
    scored.push({ phase: "peak", score, evidence });
  }

  // Lockdown: bucks vanish while does keep showing, little chasing.
  {
    let score = 0;
    const evidence: string[] = [];
    const bucksDropped = prior.bucks >= 3 && recent.bucks <= prior.bucks / 2;
    if (bucksDropped && recent.does >= 4 && recent.chasing <= 1) {
      score = 3;
      evidence.push(
        `Bucks down from ${prior.bucks} to ${recent.bucks} while does held at ${recent.does}`,
      );
      if (prior.buckDaylight >= 2 && recent.buckDaylight < prior.buckDaylight) {
        score += 1;
        evidence.push(
          `Buck daylight sightings down from ${prior.buckDaylight} to ${recent.buckDaylight}`,
        );
      }
    }
    scored.push({ phase: "lockdown", score, evidence });
  }

  // Post-rut: the chasing that was there has faded and bucks are back on food.
  {
    let score = 0;
    const evidence: string[] = [];
    if (prior.chasing >= 2 && recent.chasing <= 1) {
      score += 2;
      evidence.push(`Chasing down from ${prior.chasing} to ${recent.chasing}`);
    }
    if (score > 0 && recent.buckFeeding >= 2) {
      score += 1;
      evidence.push(`${plural(recent.buckFeeding, "buck photo")} feeding`);
    }
    // Bucks still around (not vanished) separates this from lockdown.
    if (score > 0 && prior.bucks > 0 && recent.bucks >= prior.bucks / 2 && recent.bucks >= 2) {
      score += 1;
    }
    scored.push({ phase: "post-rut", score, evidence });
  }

  return scored;
}

// Ties go to the phase listed first here: the less dramatic call wins.
const TIE_ORDER: Array<Exclude<ObservedRutPhase, "unclear">> = [
  "seeking",
  "chasing",
  "post-rut",
  "lockdown",
  "peak",
];

/** Read the rut from the hunter's own recent data on one property. */
export function readObservedRut(input: ObservedRutInput): ObservedRutRead {
  const windowDays = input.windowDays ?? OBSERVED_RUT_WINDOW_DAYS;
  const { recent, prior } = countObservedRutWindows(input);
  const sampleSize = recent.deer;
  const base = {
    sampleSize,
    windowDays,
    recent,
    prior,
    calendarSteps: null,
    calendarNote: "",
  };

  if (sampleSize < OBSERVED_RUT_MIN_SAMPLE) {
    return {
      ...base,
      phase: "unclear",
      phaseLabel: "Unclear",
      confidence: "low",
      evidence: [],
      enoughData: false,
      summary: OBSERVED_RUT_NOT_ENOUGH,
    };
  }

  const scored = scoreObservedRut(recent, prior, windowDays).sort(
    (left, right) =>
      right.score - left.score ||
      TIE_ORDER.indexOf(left.phase) - TIE_ORDER.indexOf(right.phase),
  );
  const [best, runnerUp] = scored;
  const margin = best.score - (runnerUp?.score ?? 0);

  // Need a real signal and a lead over the next phase; else don't guess.
  if (best.score < 2 || margin < 1) {
    const evidence = uniqueLines(scored.flatMap((entry) => entry.evidence)).slice(0, 4);
    return {
      ...base,
      phase: "unclear",
      phaseLabel: "Unclear",
      confidence: "low",
      evidence,
      enoughData: true,
      summary: `Your cameras don't show a clear rut pattern yet (${sampleLine(sampleSize)} in ${windowDays} days) — calendar estimate shown.`,
    };
  }

  let confidence: ObservedRutConfidence = "low";
  if (best.score >= 4 && margin >= 2 && sampleSize >= 20) confidence = "high";
  else if (best.score >= 3 && sampleSize >= 12) confidence = "medium";

  const evidence = uniqueLines([
    ...best.evidence,
    ...scored.slice(1).flatMap((entry) => entry.evidence),
  ]).slice(0, 5);

  const phaseLabel = rutPhaseLabel(best.phase);
  const steps = input.calendarPhase ? rutPhaseSteps(input.calendarPhase, best.phase) : null;
  const calendarNote =
    steps === null || steps === 0
      ? ""
      : steps > 0
        ? "ahead of the calendar"
        : "behind the calendar";

  const lead = observedRutLead(evidence);
  const summary = `Your cameras suggest ${phaseLabel} (${confidence})${lead ? ` — ${lead}` : ""}${calendarNote ? `; ${calendarNote}` : ""}.`;

  return {
    ...base,
    phase: best.phase,
    phaseLabel,
    confidence,
    evidence,
    enoughData: true,
    calendarSteps: steps,
    calendarNote,
    summary,
  };
}

function uniqueLines(lines: string[]): string[] {
  return [...new Set(lines.filter(Boolean))];
}

/** The first couple of evidence lines as one lower-case clause for a sentence. */
export function observedRutLead(evidence: string[], count = 2): string {
  // Leading numbers stay; a leading capital word drops case ("Buck" → "buck").
  return evidence
    .slice(0, count)
    .map((line) => line.charAt(0).toLowerCase() + line.slice(1))
    .join(", ");
}
