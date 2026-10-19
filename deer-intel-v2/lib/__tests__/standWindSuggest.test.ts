import { describe, expect, it } from "vitest";
import { suggestStandWinds } from "@/lib/standWindSuggest";
import { windTextFromMarks } from "@/lib/windPicker";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

const STAND_AT = { lat: 41.5, lng: -77.5 };
// ~111 m per 0.001° of latitude; longitude shrinks by cos(41.5°) ≈ 0.75.
const M = 0.001 / 111;

function pin(id: string, type: PinType, north: number, east: number, name = ""): MapPin {
  return {
    id,
    propertyId: "p1",
    type,
    lat: STAND_AT.lat + north * M,
    lng: STAND_AT.lng + (east * M) / Math.cos((STAND_AT.lat * Math.PI) / 180),
    createdAt: "2026-10-01",
    name,
    notes: "",
  };
}

const standPin = pin("s", "Stand", 0, 0, "Ridge Ladder");
const stand: Stand = {
  id: "stand-1",
  propertyId: "p1",
  name: "Ridge Ladder",
  standType: "Ladder",
  bestWinds: "",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
  sourcePinId: "s",
};

describe("suggestStandWinds", () => {
  it("marks the wind from the bedding good and the opposite avoid", () => {
    const result = suggestStandWinds(stand, [standPin, pin("b", "Bedding", 200, 0, "North bench")]);

    expect(result.marks).not.toBeNull();
    expect(windTextFromMarks(result.marks!)).toEqual({
      bestWinds: "N, NE, NW",
      avoidWinds: "SE, S, SW",
    });
    expect(result.reason).toMatch(/North bench is 220 yd N/);
  });

  it("lets avoid win when bedding sits on both sides", () => {
    const result = suggestStandWinds(stand, [
      standPin,
      pin("b1", "Bedding Area", 200, 0),
      pin("b2", "Bedding", 0, 250),
    ]);
    const { bestWinds, avoidWinds } = windTextFromMarks(result.marks!);

    // N bed → avoid SE/S/SW; E bed → avoid SW/W/NW. So NW (good for N) flips to avoid.
    expect(bestWinds).toBe("N, NE, E");
    expect(avoidWinds).toBe("SE, S, SW, W, NW");
  });

  it("ignores bedding too far away to matter", () => {
    const result = suggestStandWinds(stand, [standPin, pin("b", "Bedding", 2000, 0)]);
    expect(result.marks).toBeNull();
    expect(result.reason).toMatch(/bedding area/);
  });

  it("asks for the stand on the map when it has no pin", () => {
    const result = suggestStandWinds({ ...stand, sourcePinId: undefined, name: "Nowhere" }, [
      pin("b", "Bedding", 200, 0),
    ]);
    expect(result.marks).toBeNull();
    expect(result.reason).toMatch(/Place this stand on the map/);
  });
});
