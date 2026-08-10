import { describe, expect, it } from "vitest";
import {
  buildCalendarEvents,
  groupEventsByDay,
  toDayKey,
} from "@/lib/calendarEvents";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";

function emptyState(): DeerIntelState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks: [],
    stands: [],
    pins: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

describe("toDayKey", () => {
  it("keeps a plain date", () => {
    expect(toDayKey("2024-11-01")).toBe("2024-11-01");
  });

  it("takes the date portion of an ISO timestamp", () => {
    expect(toDayKey("2024-11-01T17:30:00Z")).toBe("2024-11-01");
  });

  it("returns null for an unreadable value", () => {
    expect(toDayKey("")).toBeNull();
    expect(toDayKey("not a date")).toBeNull();
  });
});

describe("buildCalendarEvents", () => {
  const hunt = {
    id: "h1",
    propertyId: "p1",
    date: "2024-11-01",
    standName: "Oak Ridge",
    bucks: 1,
    does: 2,
    fawns: 0,
    harvest: true,
    shotOpportunity: true,
  } as unknown as HuntLogEntry;

  const pin = {
    id: "pin1",
    propertyId: "p1",
    type: "Scrape",
    name: "Fence scrape",
    createdAt: "2024-11-01T08:00:00Z",
    lat: 0,
    lng: 0,
  } as unknown as MapPin;

  const otherPropertyPhoto = {
    id: "ph1",
    propertyId: "p2",
    cameraSiteId: "c9",
    photoDate: "2024-11-02T18:00:00Z",
    species: "Buck",
  } as unknown as PhotoRecord;

  function stateWith(): DeerIntelState {
    return {
      ...emptyState(),
      hunts: [hunt],
      pins: [pin],
      photoRecords: [otherPropertyPhoto],
    };
  }

  it("folds dated records into typed events", () => {
    const events = buildCalendarEvents(stateWith(), "all");
    const kinds = events.map((event) => event.kind).sort();
    expect(kinds).toEqual(["hunt", "pin", "sighting"]);

    const huntEvent = events.find((event) => event.kind === "hunt");
    expect(huntEvent?.dayKey).toBe("2024-11-01");
    expect(huntEvent?.title).toBe("Oak Ridge");
    expect(huntEvent?.detail).toContain("harvest");
  });

  it("scopes to a single property", () => {
    const events = buildCalendarEvents(stateWith(), "p1");
    expect(events.every((event) => event.propertyId === "p1")).toBe(true);
    expect(events.some((event) => event.kind === "sighting")).toBe(false);
  });

  it("groups events by day", () => {
    const byDay = groupEventsByDay(buildCalendarEvents(stateWith(), "p1"));
    expect(byDay.get("2024-11-01")).toHaveLength(2);
  });
});
