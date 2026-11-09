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

// A session older than this is from another day, not one to resume.
const MAX_AGE_MS = 18 * 60 * 60 * 1000;

export type ActiveWalk = {
  propertyId: string;
  startedAt: string;
  points: WalkTrackPoint[];
};

export type ActiveBloodTrail = {
  propertyId: string;
  startedAt: string;
  points: BloodMark[];
  path: HuntAreaPoint[];
  recovered: boolean;
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as T & { startedAt?: string };
    const started = Date.parse(value?.startedAt ?? "");
    if (!Number.isFinite(started) || Date.now() - started > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return value;
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

export function readActiveWalk(): ActiveWalk | null {
  const walk = read<ActiveWalk>(WALK_KEY);
  if (!walk || typeof walk.propertyId !== "string" || !Array.isArray(walk.points)) {
    return null;
  }
  return { ...walk, points: walk.points.filter(isPoint) };
}

export function saveActiveWalk(walk: ActiveWalk) {
  write(WALK_KEY, walk);
}

export function clearActiveWalk() {
  clear(WALK_KEY);
}

export function readActiveBloodTrail(): ActiveBloodTrail | null {
  const trail = read<ActiveBloodTrail>(BLOOD_KEY);
  if (!trail || typeof trail.propertyId !== "string" || !Array.isArray(trail.points)) {
    return null;
  }
  return {
    ...trail,
    points: trail.points.filter(isPoint),
    path: Array.isArray(trail.path) ? trail.path.filter(isPoint) : [],
    recovered: trail.recovered === true,
  };
}

export function saveActiveBloodTrail(trail: ActiveBloodTrail) {
  write(BLOOD_KEY, trail);
}

export function clearActiveBloodTrail() {
  clear(BLOOD_KEY);
}
