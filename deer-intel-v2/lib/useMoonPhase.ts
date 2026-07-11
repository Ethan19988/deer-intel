"use client";

import { useSyncExternalStore } from "react";
import { getMoonPhaseInfo, type MoonPhaseInfo } from "@/lib/moonPhase";

// The moon phase depends on the current time, which differs between the server
// render and the browser. useSyncExternalStore lets us return null on the
// server and the real, client-computed phase in the browser without tripping a
// hydration mismatch or reading an impure value during render.
const EMPTY_SUBSCRIBE = () => () => {};

/** Today's moon phase, or null until the component has mounted on the client. */
export function useMoonPhase(): MoonPhaseInfo | null {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => getMoonPhaseInfo(Date.now()),
    () => null,
  );
}
