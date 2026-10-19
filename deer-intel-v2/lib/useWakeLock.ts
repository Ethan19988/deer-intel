"use client";

import { useEffect } from "react";

// Keep the screen on while `active`. A phone browser pauses GPS once the screen
// locks, so a walk or blood trail recorded with the screen off jumps in a
// straight line from where it locked to where it woke. Supported browsers only;
// elsewhere this quietly does nothing. The lock drops when the page is hidden,
// so it's re-requested when the page comes back.
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) void lock.release();
          else sentinel = lock;
        })
        .catch(() => {
          // Denied (battery saver, unsupported context): tracking still works.
        });
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
