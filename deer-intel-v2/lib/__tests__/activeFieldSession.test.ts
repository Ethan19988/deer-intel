import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BLOOD_TRAIL_MAX_AGE_MS,
  bloodTrailNeedsResumePrompt,
  readActiveBloodTrail,
  readActiveWalk,
  resumeWhenLabel,
  saveActiveBloodTrail,
  saveActiveWalk,
  sessionAgeMs,
} from "@/lib/activeFieldSession";

// The store reads window.localStorage; the tests run in node, so give it a
// minimal in-memory one.
const HOUR = 60 * 60 * 1000;
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

const start = new Date(2026, 10, 8, 18, 50);
const trail = {
  propertyId: "p1",
  startedAt: start.toISOString(),
  points: [{ lat: 41, lng: -77, pathIndex: 0 }],
  path: [],
  recovered: false,
};

describe("sessionAgeMs", () => {
  it("measures from the last save, else the start", () => {
    const now = start.getTime() + 10 * HOUR;
    expect(sessionAgeMs({ startedAt: start.toISOString() }, now)).toBe(10 * HOUR);
    expect(
      sessionAgeMs(
        { startedAt: start.toISOString(), updatedAt: new Date(now - HOUR).toISOString() },
        now,
      ),
    ).toBe(HOUR);
    expect(sessionAgeMs({ startedAt: "nope" }, now)).toBeNull();
  });
});

describe("stored blood trail", () => {
  it("keeps a long trail alive while it's being saved to", () => {
    // Started 20 h ago, last saved 1 h ago: fresh enough, not expired.
    saveActiveBloodTrail(
      { ...trail, startedAt: new Date(start.getTime() - 20 * HOUR).toISOString() },
      start,
    );
    const read = readActiveBloodTrail(start.getTime() + HOUR);
    expect(read?.expired).toBe(false);
    expect(read?.ageMs).toBe(HOUR);
    expect(read && bloodTrailNeedsResumePrompt(read)).toBe(true);
  });

  it("resumes silently right after a reload", () => {
    saveActiveBloodTrail(trail, start);
    const read = readActiveBloodTrail(start.getTime() + 60_000);
    expect(read && bloodTrailNeedsResumePrompt(read)).toBe(false);
  });

  it("flags but never deletes an expired trail", () => {
    saveActiveBloodTrail(trail, start);
    const later = start.getTime() + BLOOD_TRAIL_MAX_AGE_MS + HOUR;
    expect(readActiveBloodTrail(later)?.expired).toBe(true);
    expect(readActiveBloodTrail(later)?.points).toHaveLength(1);
  });

  it("keeps recovery time and start wind", () => {
    saveActiveBloodTrail(
      {
        ...trail,
        recovered: true,
        recoveredAt: "2026-11-09T12:45:00.000Z",
        startWind: { direction: "NW", speed: "6 mph" },
      },
      start,
    );
    const read = readActiveBloodTrail(start.getTime());
    expect(read?.recoveredAt).toBe("2026-11-09T12:45:00.000Z");
    expect(read?.startWind).toEqual({ direction: "NW", speed: "6 mph" });
  });
});

describe("stored walk", () => {
  it("drops a walk idle past 18 h, quietly", () => {
    saveActiveWalk({ propertyId: "p1", startedAt: start.toISOString(), points: [] }, start);
    expect(readActiveWalk(start.getTime() + 17 * HOUR)).not.toBeNull();
    expect(readActiveWalk(start.getTime() + 19 * HOUR)).toBeNull();
    expect(store.size).toBe(0);
  });
});

describe("resumeWhenLabel", () => {
  it("says when the trail was started", () => {
    const morning = new Date(2026, 10, 9, 7, 30);
    expect(resumeWhenLabel(start.toISOString(), morning)).toMatch(/^last night \(/);
    expect(resumeWhenLabel(new Date(2026, 10, 9, 6, 0).toISOString(), morning)).toMatch(
      /^earlier today \(/,
    );
    expect(resumeWhenLabel(new Date(2026, 10, 8, 9, 0).toISOString(), morning)).toMatch(
      /^yesterday \(/,
    );
    expect(resumeWhenLabel("bad", morning)).toBe("earlier");
  });
});
