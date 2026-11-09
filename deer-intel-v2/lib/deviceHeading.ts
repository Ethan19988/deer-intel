"use client";

import { useEffect, useState } from "react";

// Compass heading from the phone's orientation sensor, shared by the map's
// compass button and "Guide me".

/**
 * Heading in whole degrees (0 = N) from an orientation event, or null when the
 * event isn't tied to north. Prefers iOS's true-north webkitCompassHeading;
 * otherwise an absolute-orientation event's alpha (relative deviceorientation
 * isn't tied to north, so it's skipped).
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

  return next === null ? null : Math.round(((next % 360) + 360) % 360);
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

/**
 * Subscribe to the compass while `enabled`, throttled to ~12 updates a
 * second. Calls `onHeading` with each new reading.
 */
export function subscribeHeading(onHeading: (heading: number) => void): () => void {
  let lastAt = 0;

  function onOrientation(event: DeviceOrientationEvent) {
    const now = Date.now();
    if (now - lastAt < 80) return;
    const heading = headingFromOrientation(event);
    if (heading === null) return;
    lastAt = now;
    onHeading(heading);
  }

  window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
  window.addEventListener("deviceorientation", onOrientation, true);
  return () => {
    window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
  };
}

/** Live compass heading while `enabled`, else null. */
export function useDeviceHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeading(null);
      return;
    }
    return subscribeHeading(setHeading);
  }, [enabled]);

  return heading;
}
