import { describe, expect, it } from "vitest";
import {
  deleteHuntFromState,
  huntFormValuesFromHunt,
  updateHuntInState,
} from "@/lib/deerIntelStoreHunts";
import { createHuntFromValues } from "@/lib/huntFormValues";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

const stand: Stand = {
  id: "s1",
  propertyId: "p1",
  name: "Oak Ridge",
  standType: "Ladder",
  bestWinds: "NW",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
};

const hunt: HuntLogEntry = {
  id: "h1",
  propertyId: "p1",
  standId: "s1",
  standName: "Oak Ridge",
  date: "2026-10-30",
  startTime: "15:30",
  endTime: "18:10",
  windDirection: "NW",
  windSpeed: "8 mph",
  temperature: "44",
  weather: "Clear",
  moonPhase: "Full",
  weatherSnapshot: {
    temperature: "44",
    windDirection: "NW",
    windSpeed: "8 mph",
    conditions: "Clear",
    moonPhase: "Full",
    source: "historical",
  },
  bucks: 1,
  does: 3,
  fawns: 0,
  shotOpportunity: true,
  harvest: false,
  notes: "Buck chasing at last light",
};

function state(hunts: HuntLogEntry[]): DeerIntelState {
  return {
    version: 2,
    properties: [],
    selectedPropertyId: "",
    cameras: [],
    cameraChecks: [],
    stands: [stand],
    pins: [],
    hunts,
    photoRecords: [],
    deerProfiles: [],
    walkTracks: [],
    documents: [],
  };
}

describe("hunt edit / delete", () => {
  it("round-trips a saved sit through the form unchanged", () => {
    const values = huntFormValuesFromHunt(hunt);

    expect(values.fawns).toBe("");
    expect(values.shotOpportunity).toBe("Yes");
    expect(createHuntFromValues({ id: hunt.id, values, stands: [stand] })).toEqual(hunt);
  });

  it("replaces the edited sit in place", () => {
    const other = { ...hunt, id: "h2" };
    const edited = { ...hunt, notes: "Two bucks" };
    const next = updateHuntInState(state([hunt, other]), edited);

    expect(next.hunts.map((entry) => entry.notes)).toEqual(["Two bucks", hunt.notes]);
  });

  it("leaves state alone when the sit is gone", () => {
    const current = state([]);

    expect(updateHuntInState(current, hunt)).toBe(current);
    expect(deleteHuntFromState(current, "h1")).toBe(current);
  });

  it("deletes only the chosen sit", () => {
    const next = deleteHuntFromState(state([hunt, { ...hunt, id: "h2" }]), "h1");

    expect(next.hunts.map((entry) => entry.id)).toEqual(["h2"]);
  });
});
