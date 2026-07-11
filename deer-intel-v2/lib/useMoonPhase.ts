"use client";

import { useSyncExternalStore } from "react";
import { getMoonPhaseInfo, type MoonPhaseInfo } from "@/lib/moonPhase";

// The moon phase depends on the current time, which differs between the server
// render and the browser. useSyncExternalStore lets us return null on the
// server and the real, client-computed phase in the browser without tripping a
// hydration mismatch or reading an impure value during render.
const EMPTY_SUBSCRIBE = () => () => {};

// getSnapshot MUST return a stable reference between renders — returning a fresh
// object each call makes useSyncExternalStore re-render forever (the snapshot
// never compares equal). Cache the computed phase per UTC day and hand back the
// same object until the day rolls over.
let cachedInfo: MoonPhaseInfo | null = null;
let cachedDay = -1;

function getClientSnapshot(): MoonPhaseInfo {
  const now = Date.now();
  const day = Math.floor(now / 86_400_000);

  if (cachedInfo === null || day !== cachedDay) {
    cachedDay = day;
    cachedInfo = getMoonPhaseInfo(now);
  }

  return cachedInfo;
}

/** Today's moon phase, or null until the component has mounted on the client. */
export function useMoonPhase(): MoonPhaseInfo | null {
  return useSyncExternalStore(EMPTY_SUBSCRIBE, getClientSnapshot, () => null);
}
