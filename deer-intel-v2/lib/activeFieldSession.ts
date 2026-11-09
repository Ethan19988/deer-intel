// A walk being recorded or a blood trail being followed lives in map state
// until it's finished. If iOS reloads the tab (it does, under memory pressure
// or after the phone sleeps) or the app is closed by accident, that state is
// gone — and a blood trail is the worst thing to lose. These helpers keep the
// session in localStorage as it grows, so the map can pick it back up.

import type { BloodMark } from "@/lib/bloodTrail";
import type { HuntAreaPoint } from "@/types/property";
import type { WalkTrackPoint } from "@/types/walkTrack";

const WALK_KEY = "deer-intel:active-walk";
const BLOOD_KEY = "deer-intel:active-blood-trail";

// Age is measured from the LAST save (updatedAt), not the start: a trail
// worked for six hours is as fresh as its last mark. A walk left this long is
// from another day and is dropped quietly. A blood trail is kept far longer —
// backing out overnight and picking it up at first light is normal — and is
// never deleted on read: the map asks "Resume or discard?".
export const WALK_MAX_AGE_MS = 18 * 60 * 60 * 1000;
export const BLOOD_TRAIL_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** Older than this since its last save, a blood trail is offered, not silently resumed. */
export const BLOOD_TRAIL_ASK_AFTER_MS = 30 * 60 * 1000;

export type ActiveWalk = {
  propertyId: string;
  startedAt: string;
  /** Last save; bumped on every save. Older sessions lack it (startedAt is used). */
  updatedAt?: string;
  points: WalkTrackPoint[];
};

export type ActiveBloodTrail = {
  propertyId: string;
  startedAt: string;
  /** Last save; bumped on every save. Older sessions lack it (startedAt is used). */
  updatedAt?: string;
  /** When "Found!" was tapped. */
  recoveredAt?: string;
  /** Wind when the trail was started, for the Hunt Log entry. */
  startWind?: { direction: string; speed: string };
  points: BloodMark[];
  path: HuntAreaPoint[];
  recovered: boolean;
};

/** What a read returns: the session plus how old its last save is. */
export type StoredSession<T> = T & {
  /** ms since the last save (updatedAt, else startedAt). */
  ageMs: number;
  /** Past its keep limit. */
  expired: boolean;
};

/** ms since the session's last save, or null when it has no usable time. */
export function sessionAgeMs(
  value: { startedAt?: unknown; updatedAt?: unknown } | null | undefined,
  now: number,
): number | null {
  const parse = (raw: unknown) => (typeof raw === "string" ? Date.parse(raw) : NaN);
  const updated = parse(value?.updatedAt);
  const started = parse(value?.startedAt);
  const last = Number.isFinite(updated) ? updated : started;
  return Number.isFinite(last) ? Math.max(0, now - last) : null;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the session still runs, it just can't resume.
  }
}

function clear(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

function isPoint(value: unknown): value is { lat: number; lng: number } {
  const point = value as { lat?: unknown; lng?: unknown } | null;
  return (
    Boolean(point) &&
    typeof point?.lat === "number" &&
    typeof point?.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

export function readActiveWalk(now: number = Date.now()): StoredSession<ActiveWalk> | null {
  const walk = read<ActiveWalk>(WALK_KEY);
  if (!walk || typeof walk.propertyId !== "string" || !Array.isArray(walk.points)) {
    return null;
  }
  const ageMs = sessionAgeMs(walk, now);
  if (ageMs === null || ageMs > WALK_MAX_AGE_MS) {
    // A walk from another day isn't worth asking about.
    clear(WALK_KEY);
    return null;
  }
  return { ...walk, points: walk.points.filter(isPoint), ageMs, expired: false };
}

export function saveActiveWalk(walk: ActiveWalk, now: Date = new Date()) {
  write(WALK_KEY, { ...walk, updatedAt: now.toISOString() });
}

export function clearActiveWalk() {
  clear(WALK_KEY);
}

/**
 * The stored blood trail, however old: never deleted here. `expired` is set
 * past BLOOD_TRAIL_MAX_AGE_MS; the map offers Resume / Discard for a trail
 * that's expired or idle longer than BLOOD_TRAIL_ASK_AFTER_MS.
 */
export function readActiveBloodTrail(
  now: number = Date.now(),
): StoredSession<ActiveBloodTrail> | null {
  const trail = read<ActiveBloodTrail>(BLOOD_KEY);
  if (!trail || typeof trail.propertyId !== "string" || !Array.isArray(trail.points)) {
    return null;
  }
  const ageMs = sessionAgeMs(trail, now) ?? Number.POSITIVE_INFINITY;
  const startWind =
    trail.startWind &&
    typeof trail.startWind.direction === "string" &&
    typeof trail.startWind.speed === "string"
      ? { direction: trail.startWind.direction, speed: trail.startWind.speed }
      : undefined;
  return {
    ...trail,
    points: trail.points.filter(isPoint),
    path: Array.isArray(trail.path) ? trail.path.filter(isPoint) : [],
    recovered: trail.recovered === true,
    recoveredAt: typeof trail.recoveredAt === "string" ? trail.recoveredAt : undefined,
    startWind,
    ageMs,
    expired: ageMs > BLOOD_TRAIL_MAX_AGE_MS,
  };
}

/** Ask before resuming: idle a while (e.g. backed out overnight) or expired. */
export function bloodTrailNeedsResumePrompt(trail: { ageMs: number; expired: boolean }): boolean {
  return trail.expired || trail.ageMs > BLOOD_TRAIL_ASK_AFTER_MS;
}

export function saveActiveBloodTrail(trail: ActiveBloodTrail, now: Date = new Date()) {
  write(BLOOD_KEY, { ...trail, updatedAt: now.toISOString() });
}

export function clearActiveBloodTrail() {
  clear(BLOOD_KEY);
}

/**
 * "last night (6:50 PM)", "earlier today (7:05 AM)", "yesterday (9:15 AM)" or
 * "Fri, Nov 6 (6:40 PM)" — when a stored trail was started, for the resume
 * prompt.
 */
export function resumeWhenLabel(startedAt: string, now: Date): string {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "earlier";
  const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((today - startDay) / 86_400_000);
  if (days <= 0) return `earlier today (${time})`;
  if (days === 1) return `${start.getHours() >= 12 ? "last night" : "yesterday"} (${time})`;
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${date} (${time})`;
}
