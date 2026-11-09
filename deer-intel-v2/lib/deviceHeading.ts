"use client";

import { useEffect, useRef, useState } from "react";

// Compass heading from the phone's orientation sensor, shared by the map's
// compass button and "Guide me".
//
// Phones report a MAGNETIC heading: iOS's webkitCompassHeading is relative to
// magnetic north, and Android's absolute-orientation alpha comes from the
// magnetometer too. Every bearing the app draws (pins, wind, Guide me) is a
// TRUE bearing, so subscribers get the reading corrected by the local
// magnetic declination (true = magnetic + declination).

// --- Magnetic declination ----------------------------------------------------

// Declination fit box: PA, MD and the surrounding mid-Atlantic. Positions
// outside it are clamped to its edge.
const DECL_LAT_MIN = 37;
const DECL_LAT_MAX = 43;
const DECL_LNG_MIN = -81;
const DECL_LNG_MAX = -74;

/** Central-PA declination, used before any position is known. */
export const DEFAULT_DECLINATION = -10.5;

/**
 * Approximate magnetic declination in degrees (east positive, west negative)
 * for a spot in the eastern US: a plane fit in lat/lng to NOAA World Magnetic
 * Model values for the mid-2020s over 37–43°N, 74–81°W — about −9° at
 * Pittsburgh, −11° at Harrisburg and Baltimore, −12° at Philadelphia. Good to
 * roughly ±1° inside that box (declination there drifts only a few hundredths
 * of a degree a year). Positions outside are clamped to the box edge, so it
 * degrades the farther you go. 1° of error is ~5 yd of drift per 300 yd
 * walked, against ~50 yd for the uncorrected ~10°.
 */
export function magneticDeclination(lat: number, lng: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return DEFAULT_DECLINATION;
  const clampedLat = Math.min(DECL_LAT_MAX, Math.max(DECL_LAT_MIN, lat));
  const clampedLng = Math.min(DECL_LNG_MAX, Math.max(DECL_LNG_MIN, lng));
  const declination = -11.0 - 0.35 * (clampedLat - 40.27) - 0.625 * (clampedLng + 76.88);
  return Math.round(declination * 10) / 10;
}

/** True heading (whole degrees, 0-359) from a magnetic one. */
export function magneticToTrue(magneticHeading: number, declination: number): number {
  return Math.round((((magneticHeading + declination) % 360) + 360) % 360) % 360;
}

// --- Orientation events ------------------------------------------------------

/**
 * MAGNETIC heading in whole degrees (0 = magnetic N) from an orientation
 * event, or null when the event isn't tied to north. Prefers iOS's
 * webkitCompassHeading (magnetic north); otherwise an absolute-orientation
 * event's alpha (also magnetic; relative deviceorientation isn't tied to
 * north, so it's skipped). Use magneticToTrue before comparing it with a
 * bearing.
 */
export function headingFromOrientation(event: DeviceOrientationEvent): number | null {
  const iosHeading = (
    event as DeviceOrientationEvent & { webkitCompassHeading?: number }
  ).webkitCompassHeading;

  let next: number | null = null;
  if (typeof iosHeading === "number" && !Number.isNaN(iosHeading)) {
    next = iosHeading;
  } else if (event.absolute && typeof event.alpha === "number") {
    next = 360 - event.alpha;
  }

  return next === null ? null : Math.round(((next % 360) + 360) % 360) % 360;
}

/**
 * iOS 13+ only delivers compass data after an explicit grant, and the request
 * must come straight from a tap — call this first thing in the click handler.
 * Resolves "granted" where no grant is needed, "denied" on a refusal and
 * "unavailable" when the request throws.
 */
export async function requestCompassPermission(): Promise<"granted" | "denied" | "unavailable"> {
  if (typeof window === "undefined") return "unavailable";
  const orientationApi = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied" | "default">;
      })
    | undefined;

  if (!orientationApi || typeof orientationApi.requestPermission !== "function") {
    return "granted";
  }

  try {
    return (await orientationApi.requestPermission()) === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

// --- Throttling -----------------------------------------------------------------

/** Smallest heading change worth a re-render (degrees). */
export const HEADING_MIN_CHANGE_DEG = 2;
/** At most this often (ms) — ~4 updates a second. */
export const HEADING_MIN_INTERVAL_MS = 250;

/** Smallest angle between two headings, wrap-aware (359° → 1° is 2°). */
export function headingDelta(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Whether a new heading should go out to subscribers. The sensor fires 60+
 * times a second and every update re-renders the map, so only a turn of 2°+
 * passes, at most ~4 times a second (MapRotationController and the guide
 * arrow ease between updates, so the turn still looks smooth). The first
 * reading always passes.
 */
export function shouldEmitHeading(
  last: { heading: number; at: number } | null,
  next: number,
  now: number,
): boolean {
  if (!last) return true;
  if (now - last.at < HEADING_MIN_INTERVAL_MS) return false;
  return headingDelta(last.heading, next) >= HEADING_MIN_CHANGE_DEG;
}

/**
 * How far the screen is turned from the device's natural (portrait) way up,
 * in degrees clockwise — 90 / 270 in landscape. The sensors report the
 * device's top edge, so a landscape phone's heading is off by this much.
 */
function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle =
    window.screen?.orientation?.angle ??
    (window as Window & { orientation?: number }).orientation;
  return typeof angle === "number" && Number.isFinite(angle) ? angle : 0;
}

/**
 * Subscribe to the compass. Calls `onHeading` with each new TRUE heading
 * (0 = true north): the magnetic reading, turned for a landscape screen, plus
 * `getDeclination()`, read on every event so a moving position doesn't need a
 * re-subscribe. Without a getter the central-PA default is used. Throttled by
 * shouldEmitHeading (2° / ~4 Hz).
 */
export function subscribeHeading(
  onHeading: (heading: number) => void,
  getDeclination: () => number = () => DEFAULT_DECLINATION,
): () => void {
  let last: { heading: number; at: number } | null = null;

  function onOrientation(event: DeviceOrientationEvent) {
    const now = Date.now();
    if (last && now - last.at < HEADING_MIN_INTERVAL_MS) return;
    const magnetic = headingFromOrientation(event);
    if (magnetic === null) return;
    const declination = getDeclination();
    const heading = magneticToTrue(
      magnetic + screenAngle(),
      Number.isFinite(declination) ? declination : DEFAULT_DECLINATION,
    );
    if (!shouldEmitHeading(last, heading, now)) return;
    last = { heading, at: now };
    onHeading(heading);
  }

  window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
  window.addEventListener("deviceorientation", onOrientation, true);
  return () => {
    window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
  };
}

/**
 * Live TRUE compass heading while `enabled`, else null. `declination` is the
 * local magnetic declination (see magneticDeclination); it may change without
 * re-subscribing.
 */
export function useDeviceHeading(
  enabled: boolean,
  declination: number = DEFAULT_DECLINATION,
): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const declinationRef = useRef(declination);

  useEffect(() => {
    declinationRef.current = declination;
  }, [declination]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeading(null);
      return;
    }
    return subscribeHeading(setHeading, () => declinationRef.current);
  }, [enabled]);

  return heading;
}
