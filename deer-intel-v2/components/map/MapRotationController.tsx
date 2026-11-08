"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

import { setMapBearing, syncRotationOrigin } from "@/lib/leafletRotation";

// Turns the map heading-up: while `heading` is set (degrees, 0 = N), the map
// rotates so the way the phone faces is at the top of the screen. null puts
// the map back north-up.
//
// Compass readings arrive in small jumps and jitter a degree or two, so the map
// eases toward each new heading over a few frames and ignores tiny wobbles,
// rather than snapping (which reads as shaking while you stand still).
export default function MapRotationController({
  heading,
}: {
  heading: number | null;
}) {
  const map = useMap();
  // The angle actually on screen, kept continuous (it can run past 360 or below
  // 0) so a turn through north eases the short way instead of spinning around.
  const shownRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useMapEvents({
    resize() {
      syncRotationOrigin(map);
    },
  });

  useEffect(() => {
    function stopAnimation() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    }

    if (heading === null) {
      stopAnimation();
      shownRef.current = null;
      targetRef.current = null;
      setMapBearing(map, null);
      return;
    }

    const shown = shownRef.current;
    if (shown === null) {
      // First reading: turn straight to it.
      shownRef.current = heading;
      targetRef.current = heading;
      setMapBearing(map, heading);
      return;
    }

    // Nearest equivalent of the new heading to what's on screen now.
    const delta = ((((heading - shown) % 360) + 540) % 360) - 180;
    if (Math.abs(delta) < 2 && frameRef.current === null) return;
    targetRef.current = shown + delta;

    if (frameRef.current !== null) return;
    const step = () => {
      const current = shownRef.current;
      const target = targetRef.current;
      if (current === null || target === null) {
        frameRef.current = null;
        return;
      }
      const remaining = target - current;
      const next =
        Math.abs(remaining) < 0.4 ? target : current + remaining * 0.25;
      shownRef.current = next;
      setMapBearing(map, next);
      frameRef.current = next === target ? null : requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [heading, map]);

  // Leaving the map (or unmounting this control) always restores north-up.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      setMapBearing(map, null);
    },
    [map],
  );

  return null;
}
