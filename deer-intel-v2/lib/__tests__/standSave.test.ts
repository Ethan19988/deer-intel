import { describe, expect, it } from "vitest";
import { saveStandWithLocation, standLocationPin } from "@/lib/standSave";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

function stand(overrides: Partial<Stand> = {}): Stand {
  return {
    id: "s1",
    propertyId: "p1",
    name: "Oak Flat",
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...overrides,
  };
}

function pin(overrides: Partial<MapPin> = {}): MapPin {
  return {
    id: "pin-1",
    propertyId: "p1",
    type: "Stand",
    lat: 41,
    lng: -77,
    createdAt: "",
    name: "Oak Flat",
    notes: "",
    ...overrides,
  };
}

function state(overrides: Partial<DeerIntelState>): DeerIntelState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "p1",
    cameras: [],
    cameraChecks: [],
    stands: [],
    pins: [],
    hunts: [],
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
    ...overrides,
  };
}

const NOW = "2026-11-08T12:00:00.000Z";

describe("saveStandWithLocation", () => {
  it("adds a stand with a GPS location as a linked Stand pin", () => {
    const next = saveStandWithLocation(state({}), {
      stand: stand(),
      location: { lat: 41.5, lng: -77.5 },
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.pins).toEqual([
      {
        id: "pin-new",
        propertyId: "p1",
        type: "Stand",
        lat: 41.5,
        lng: -77.5,
        createdAt: NOW,
        name: "Oak Flat",
        notes: "",
      },
    ]);
    expect(next.stands[0].sourcePinId).toBe("pin-new");
  });

  it("adds a stand with no location and no pin", () => {
    const next = saveStandWithLocation(state({}), {
      stand: stand(),
      location: null,
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.pins).toEqual([]);
    expect(next.stands[0]).not.toHaveProperty("sourcePinId");
  });

  it("moves the linked pin when an edit changes the location", () => {
    const existing = stand({ sourcePinId: "pin-1" });
    const next = saveStandWithLocation(state({ stands: [existing], pins: [pin()] }), {
      stand: { ...existing, standType: "Saddle" },
      location: { lat: 41.2, lng: -77.3 },
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.pins).toHaveLength(1);
    expect(next.pins[0]).toMatchObject({ id: "pin-1", lat: 41.2, lng: -77.3 });
    expect(next.stands).toEqual([{ ...existing, standType: "Saddle" }]);
  });

  it("links (and renames) a name-matched pin on rename so the stand keeps its spot", () => {
    const existing = stand();
    const next = saveStandWithLocation(state({ stands: [existing], pins: [pin()] }), {
      stand: { ...existing, name: "Oak Flat North" },
      location: null,
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.stands[0].sourcePinId).toBe("pin-1");
    expect(next.pins[0].name).toBe("Oak Flat North");
  });

  it("doesn't take a pin another stand is linked to", () => {
    const other = stand({ id: "s2", sourcePinId: "pin-1" });
    const mine = stand();
    expect(standLocationPin(mine, [mine, other], [pin()])).toBeNull();
    const next = saveStandWithLocation(state({ stands: [mine, other], pins: [pin()] }), {
      stand: mine,
      location: { lat: 41.3, lng: -77.3 },
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.pins.find((p) => p.id === "pin-1")).toMatchObject({ lat: 41, lng: -77 });
    expect(next.stands.find((s) => s.id === "s1")?.sourcePinId).toBe("pin-new");
  });

  it("carries id-less sits over to the stand on a rename", () => {
    const existing = stand();
    const sit = { id: "h1", propertyId: "p1", standId: "", standName: "oak flat" } as HuntLogEntry;
    const next = saveStandWithLocation(state({ stands: [existing], hunts: [sit] }), {
      stand: { ...existing, name: "Big Oak" },
      location: null,
      newPinId: "pin-new",
      createdAt: NOW,
    });
    expect(next.hunts[0].standId).toBe("s1");
    expect(next.hunts[0].standName).toBe("oak flat");
  });
});
