import { distanceBetweenMeters } from "@/lib/walkTrack";

// GPS fix filtering shared by the walk recorder and the blood-trail path.
// A phone standing still reports a position that wanders by about its
// accuracy, and the odd fix jumps tens of meters. Adding every fix that moved
// a few meters pads a recorded trail with distance you never walked, so a fix
// only counts when it moved further than the noise around it and at a pace a
// person on foot could manage. Pure, so it's unit-tested.

/** One GPS reading: where, how sure (± m), when (ms) and how fast (m/s). */
export type TrackFix = {
  lat: number;
  lng: number;
  /** Reported accuracy radius in meters, or null when unknown. */
  accuracy: number | null;
  /** Fix time in ms (GeolocationPosition.timestamp), or null when unknown. */
  timestamp: number | null;
  /** coords.speed in m/s, or null when the device doesn't report it. */
  speed?: number | null;
};

/** Fixes worse than this are guesses — drawing them adds zigzags you never walked. */
export const MAX_TRACK_FIX_ACCURACY_M = 25;
/** A step must clear this share of the fix noise (the larger accuracy) to count. */
export const ACCURACY_STEP_FACTOR = 0.7;
/** Faster than this between fixes isn't someone on foot — it's a GPS jump. */
export const MAX_FOOT_SPEED_MPS = 3;
/** Below this reported speed the device thinks it isn't moving. */
export const STATIONARY_SPEED_MPS = 0.3;

function usableAccuracy(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** The smallest move from `last` that counts as a step for this fix. */
export function minStepMeters(
  last: Pick<TrackFix, "accuracy"> | null,
  fix: Pick<TrackFix, "accuracy">,
  baseMinStepM: number,
): number {
  const noise = Math.max(usableAccuracy(fix.accuracy), usableAccuracy(last?.accuracy));
  return Math.max(baseMinStepM, ACCURACY_STEP_FACTOR * noise);
}

/**
 * Should `fix` be added after `last` (the last ACCEPTED fix, or null for the
 * first)? Rejects: fixes worse than `maxAccuracyM`; steps smaller than
 * max(baseMinStepM, 0.7 × the larger accuracy); steps implying more than
 * 3 m/s since `last` (needs both timestamps); and, when the device reports a
 * speed under 0.3 m/s, any step shorter than the fix's own accuracy.
 */
export function acceptTrackFix(
  last: TrackFix | null,
  fix: TrackFix,
  { baseMinStepM, maxAccuracyM = MAX_TRACK_FIX_ACCURACY_M }: {
    baseMinStepM: number;
    maxAccuracyM?: number;
  },
): boolean {
  if (typeof fix.accuracy === "number" && fix.accuracy > maxAccuracyM) return false;
  if (!last) return true;

  const step = distanceBetweenMeters({ ...last, at: "" }, { ...fix, at: "" });
  if (step < minStepMeters(last, fix, baseMinStepM)) return false;

  const accuracy = usableAccuracy(fix.accuracy);
  if (
    typeof fix.speed === "number" &&
    fix.speed >= 0 &&
    fix.speed < STATIONARY_SPEED_MPS &&
    step < accuracy
  ) {
    return false;
  }

  if (typeof fix.timestamp === "number" && typeof last.timestamp === "number") {
    const seconds = (fix.timestamp - last.timestamp) / 1000;
    // Same or older fix delivered again: nothing new.
    if (seconds <= 0) return false;
    if (step / seconds > MAX_FOOT_SPEED_MPS) return false;
  }

  return true;
}

// --- Live-location quality ----------------------------------------------------

/** Fixes worse than this are ignored for arrival and edge decisions. */
export const DECISION_MAX_ACCURACY_M = 30;
/** No fix for this long and the HUD says the GPS is lost. */
export const GPS_LOST_AFTER_MS = 30_000;

/** Good enough to decide arrival or an edge crossing on. */
export function isDecisionFix(accuracy: number | null | undefined): boolean {
  return typeof accuracy !== "number" || !Number.isFinite(accuracy)
    ? false
    : accuracy <= DECISION_MAX_ACCURACY_M;
}

/** True when the last fix arrived more than 30 s before `now`. */
export function isGpsLost(receivedAt: number | null | undefined, now: number): boolean {
  return typeof receivedAt === "number" && now - receivedAt > GPS_LOST_AFTER_MS;
}
