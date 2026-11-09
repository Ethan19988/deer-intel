import { describe, expect, it } from "vitest";
import {
  acceptTrackFix,
  isDecisionFix,
  isGpsLost,
  minStepMeters,
  type TrackFix,
} from "@/lib/gpsFix";
import { MIN_PATH_STEP_M } from "@/lib/bloodTrail";
import { MIN_TRACK_POINT_METERS } from "@/lib/walkTrack";

// ~1.11 m per 0.00001° of latitude.
const fix = (
  northMeters: number,
  accuracy: number | null,
  seconds: number | null,
  speed: number | null = null,
): TrackFix => ({
  lat: 41 + (northMeters / 1.11) * 0.00001,
  lng: -77,
  accuracy,
  timestamp: seconds === null ? null : seconds * 1000,
  speed,
});

const blood = { baseMinStepM: MIN_PATH_STEP_M };
const walk = { baseMinStepM: MIN_TRACK_POINT_METERS };

describe("minStepMeters", () => {
  it("scales with the worse of the two accuracies", () => {
    expect(minStepMeters(null, { accuracy: null }, 3)).toBe(3);
    expect(minStepMeters({ accuracy: 4 }, { accuracy: 2 }, 3)).toBe(3);
    expect(minStepMeters({ accuracy: 20 }, { accuracy: 5 }, 3)).toBeCloseTo(14);
    expect(minStepMeters({ accuracy: 5 }, { accuracy: 10 }, 5)).toBeCloseTo(7);
  });
});

describe("acceptTrackFix", () => {
  it("takes the first good fix and drops poor ones", () => {
    expect(acceptTrackFix(null, fix(0, 8, 0), blood)).toBe(true);
    expect(acceptTrackFix(null, fix(0, 40, 0), blood)).toBe(false);
  });

  it("drops steps inside the fix noise", () => {
    const last = fix(0, 15, 0);
    // 8 m on ±15 m fixes is noise (needs 10.5 m)...
    expect(acceptTrackFix(last, fix(8, 15, 10), blood)).toBe(false);
    // ...12 m is a step.
    expect(acceptTrackFix(last, fix(12, 15, 10), blood)).toBe(true);
    // Tight fixes keep the base minimum.
    expect(acceptTrackFix(fix(0, 3, 0), fix(3.5, 3, 5), blood)).toBe(true);
    expect(acceptTrackFix(fix(0, 3, 0), fix(4, 3, 5), walk)).toBe(false);
  });

  it("rejects jumps faster than a walk", () => {
    const last = fix(0, 5, 0);
    expect(acceptTrackFix(last, fix(20, 5, 2), blood)).toBe(false); // 10 m/s
    expect(acceptTrackFix(last, fix(20, 5, 10), blood)).toBe(true); // 2 m/s
    // A stale or repeated fix adds nothing.
    expect(acceptTrackFix(last, fix(20, 5, 0), blood)).toBe(false);
    // No timestamps: the speed check is skipped.
    expect(acceptTrackFix(fix(0, 5, null), fix(20, 5, 2), blood)).toBe(true);
  });

  it("treats a near-zero reported speed as standing still", () => {
    const last = fix(0, 4, 0);
    // 7.5 m step on a ±10 m fix while the phone reports 0.1 m/s: wander.
    expect(acceptTrackFix(last, fix(7.5, 10, 10, 0.1), blood)).toBe(false);
    expect(acceptTrackFix(last, fix(7.5, 10, 10, 1.2), blood)).toBe(true);
    // Unknown speed (null or −1 on some devices) doesn't count as stationary.
    expect(acceptTrackFix(last, fix(7.5, 10, 10, null), blood)).toBe(true);
    expect(acceptTrackFix(last, fix(7.5, 10, 10, -1), blood)).toBe(true);
  });

  it("doesn't inflate a parked trail with wander inside the accuracy", () => {
    // A minute of ±12 m fixes, one a second, wandering up to 6 m around one spot.
    const wander = [0, 5, -4, 3, 6, -5, 1, 4, -6, 2];
    let last: TrackFix | null = null;
    let accepted = 0;
    for (let second = 0; second < 60; second += 1) {
      const next = fix(wander[second % wander.length], 12, second, 0.4);
      if (acceptTrackFix(last, next, blood)) {
        accepted += 1;
        last = next;
      }
    }
    // Only the first fix — the old fixed 3 m step took most of them.
    expect(accepted).toBe(1);
  });
});

describe("live-fix quality", () => {
  it("decides only on fixes within ±30 m", () => {
    expect(isDecisionFix(12)).toBe(true);
    expect(isDecisionFix(30)).toBe(true);
    expect(isDecisionFix(31)).toBe(false);
    expect(isDecisionFix(null)).toBe(false);
  });

  it("calls the GPS lost after 30 s without a fix", () => {
    expect(isGpsLost(1_000, 20_000)).toBe(false);
    expect(isGpsLost(1_000, 31_001)).toBe(true);
    expect(isGpsLost(null, 99_999)).toBe(false);
  });
});
