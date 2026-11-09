import { describe, expect, it } from "vitest";
import {
  describeDeerTimeWindow,
  formatDeerAge,
  getDeerProfileTimeline,
  isClearTimeWindow,
} from "@/lib/deerProfileTimeline";
import { createHuntFromValues, newHuntFormValues, withHuntDeerProfileIds } from "@/lib/huntFormValues";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

const profile: DeerProfile = {
  id: "b1",
  propertyId: "p",
  nickname: "Big 8",
  estimatedAge: "",
  firstSeen: "",
  lastSeen: "",
  notes: "",
};

const camera = (id: string, name: string): Camera => ({
  id,
  propertyId: "p",
  name,
  cameraType: "Cellular",
  manufacturer: "",
  model: "",
  status: "Active",
  locationNotes: "",
  notes: "",
});

const photo = (id: string, cameraSiteId: string, photoDate: string, ids = ["b1"]): PhotoRecord => ({
  id,
  propertyId: "p",
  cameraSiteId,
  cameraCheckId: "",
  fileName: "",
  photoDate,
  species: "Deer (Antlered)",
  notes: "",
  createdAt: "",
  deerProfileIds: ids,
});

const sit = (id: string, date: string, startTime: string, deerProfileIds?: string[]) =>
  ({ id, date, startTime, ...(deerProfileIds ? { deerProfileIds } : null) }) as HuntLogEntry;

describe("getDeerProfileTimeline", () => {
  const timeline = getDeerProfileTimeline({
    profile,
    cameras: [camera("c1", "Inside Laurel"), camera("c2", "Creek Crossing")],
    photoRecords: [
      photo("1", "c1", "2026-10-02T17:40"),
      photo("2", "c2", "2026-10-10T18:05"),
      photo("3", "c1", "2026-10-15T06:50"),
      photo("4", "c1", "2026-10-20"),
      photo("x", "c2", "2026-08-01T17:00", ["other"]),
    ],
    hunts: [sit("h1", "2026-10-25", "15:30", ["b1"]), sit("h2", "2026-09-01", "06:00")],
  });

  it("spans photos and tagged sits for first / last seen", () => {
    expect(timeline.firstSeen).toBe("Oct 2, 2026");
    expect(timeline.lastSeen).toBe("Oct 25, 2026");
    expect(timeline.cameraHits).toBe(4);
    expect(timeline.sitSightings).toBe(1);
  });

  it("lists his cameras, most hits first", () => {
    expect(timeline.cameras).toEqual([
      { cameraId: "c1", name: "Inside Laurel", count: 3, lastSeen: "Oct 20, 2026" },
      { cameraId: "c2", name: "Creek Crossing", count: 1, lastSeen: "Oct 10, 2026" },
    ]);
  });

  it("finds his most common time window from timed sightings", () => {
    // Evenings: two photos + the sit's 15:30 start; one morning; one date-only.
    expect(timeline.timeWindow).toMatchObject({ label: "Evening", hours: "3–8 PM", count: 3, sampleSize: 4, clear: true });
  });

  it("is empty for a buck with nothing linked", () => {
    const empty = getDeerProfileTimeline({ profile, cameras: [], photoRecords: [], hunts: [] });
    expect(empty).toEqual({ firstSeen: "", lastSeen: "", cameraHits: 0, sitSightings: 0, cameras: [], timeWindow: null });
  });
});

describe("hunt form buck tags", () => {
  const stand = { id: "s1", propertyId: "p", name: "Oak" } as Stand;

  it("saves deduped ids and loads them back for editing", () => {
    const values = { ...newHuntFormValues(new Date(2026, 10, 1, 16, 0), { propertyId: "p", standId: "s1" }), deerProfileIds: ["b1", " b1 ", "b2", ""] };
    const hunt = createHuntFromValues({ id: "h", values, stands: [stand] })!;

    expect(hunt.deerProfileIds).toEqual(["b1", "b2"]);
    expect(withHuntDeerProfileIds(values, hunt).deerProfileIds).toEqual(["b1", "b2"]);
  });

  it("leaves the field off an untagged sit", () => {
    const values = newHuntFormValues(new Date(2026, 10, 1, 16, 0), { propertyId: "p", standId: "s1" });
    const hunt = createHuntFromValues({ id: "h", values, stands: [stand] })!;

    expect("deerProfileIds" in hunt).toBe(false);
  });
});

describe("deer time window wording", () => {
  it("won't call a single timed sighting a pattern", () => {
    const text = describeDeerTimeWindow({
      label: "Morning",
      hours: "5–10 AM",
      count: 1,
      sampleSize: 1,
    });

    expect(text?.title).toBe("No time pattern yet");
    expect(text?.line).not.toMatch(/Usually/);
    expect(text?.detail).toMatch(/morning \(5–10 AM\)/);
  });

  it("calls it usual once there are enough timed sightings", () => {
    const text = describeDeerTimeWindow({
      label: "Evening",
      hours: "3–8 PM",
      count: 3,
      sampleSize: 4,
    });

    expect(text?.line).toBe("Usually evening (3–8 PM) · 3 of 4 timed");
    expect(text?.title).toBe("Usually evening (3–8 PM)");
  });

  it("is empty with no timed sightings", () => {
    expect(describeDeerTimeWindow(null)).toBeNull();
  });
});

describe("formatDeerAge", () => {
  it("adds yrs to a bare number and leaves typed text alone", () => {
    expect(formatDeerAge("4.5")).toBe("4.5 yrs");
    expect(formatDeerAge("3.5+")).toBe("3.5+ yrs");
    expect(formatDeerAge(" 2 ")).toBe("2 yrs");
    expect(formatDeerAge("4.5 years")).toBe("4.5 years");
    expect(formatDeerAge("Mature")).toBe("Mature");
    expect(formatDeerAge("")).toBe("");
  });
});

describe("describeDeerTimeWindow without a clear leader", () => {
  it("doesn't say 'usually' when two windows are about even", () => {
    const text = describeDeerTimeWindow({
      label: "Morning",
      hours: "5–10 AM",
      count: 4,
      sampleSize: 12,
      runnerUpLabel: "Evening",
      runnerUpCount: 4,
      clear: false,
    });
    expect(text?.title).toBe("No single time yet");
    expect(text?.line).not.toMatch(/Usually/);
    expect(isClearTimeWindow({ label: "Morning", hours: "", count: 4, sampleSize: 12, clear: false })).toBe(false);
  });
});
