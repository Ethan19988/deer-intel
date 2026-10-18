import { describe, expect, it } from "vitest";
import { getAccessScentCheck } from "@/lib/accessScent";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// ~0.001° latitude ≈ 111 m; near 41.5°N, 0.001° longitude ≈ 83 m.
const BASE = { lat: 41.5, lng: -77.5 };

function pin(id: string, type: PinType, dLat: number, dLng: number, name = id): MapPin {
  return {
    id,
    propertyId: "p1",
    type,
    lat: BASE.lat + dLat,
    lng: BASE.lng + dLng,
    createdAt: "",
    name,
    notes: "",
  };
}

const STAND: Stand = {
  id: "s1",
  propertyId: "p1",
  name: "Ridge",
  standType: "Hang-on",
  bestWinds: "NW",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
  sourcePinId: "standPin",
};

describe("getAccessScentCheck", () => {
  // Parking 550 m south of the stand; walk goes straight north.
  const standPin = pin("standPin", "Stand", 0, 0, "Ridge");
  const parking = pin("lot", "Parking", -0.005, 0, "Lower lot");

  it("flags a walk in that blows scent toward bedding", () => {
    // Bedding ~250 m east of the midpoint of the walk; a W wind blows east.
    const bed = pin("bed", "Bedding", -0.0025, 0.003, "Laurel bench");

    const check = getAccessScentCheck(STAND, [standPin, parking, bed], "W");

    expect(check.status).toBe("risk");
    expect(check.label).toBe("Walk in blows scent");
    expect(check.detail).toContain("Laurel bench");
  });

  it("is clear when the same bedding is upwind", () => {
    const bed = pin("bed", "Bedding", -0.0025, 0.003, "Laurel bench");

    const check = getAccessScentCheck(STAND, [standPin, parking, bed], "E");

    expect(check.status).toBe("clear");
    expect(check.detail).toContain("Lower lot");
  });

  it("flags a route that walks right past bedding regardless of wind", () => {
    const bed = pin("bed", "Bedding Area", -0.0025, 0.0004, "Thicket");

    const check = getAccessScentCheck(STAND, [standPin, parking, bed], "E");

    expect(check.status).toBe("risk");
    expect(check.label).toBe("Walk passes bedding");
  });

  it("flags scent from the stand itself", () => {
    // Bedding 200 m north of the stand, beyond the parking side; S wind blows north.
    const bed = pin("bed", "Bedding", 0.0018, 0, "Top bench");

    const check = getAccessScentCheck(STAND, [standPin, parking, bed], "S");

    expect(check.status).toBe("risk");
    expect(check.label).toBe("Scent into bedding");
  });

  it("ignores bedding beyond scent reach", () => {
    const bed = pin("bed", "Bedding", -0.0025, 0.01, "Far side");

    const check = getAccessScentCheck(STAND, [standPin, parking, bed], "W");

    expect(check.status).toBe("clear");
  });

  it("is unknown when the stand isn't on the map", () => {
    const check = getAccessScentCheck(
      { ...STAND, sourcePinId: undefined, name: "Somewhere" },
      [parking, pin("bed", "Bedding", 0, 0.001)],
      "W",
    );

    expect(check.status).toBe("unknown");
    expect(check.label).toBe("Not on the map");
  });

  it("finds the stand by a matching pin name when not promoted", () => {
    const named = pin("x", "Treestand", 0, 0, "Ridge");
    const bed = pin("bed", "Bedding", 0.0018, 0, "Top bench");

    const check = getAccessScentCheck(
      { ...STAND, sourcePinId: undefined },
      [named, bed],
      "S",
    );

    expect(check.status).toBe("risk");
  });

  it("is unknown without a wind", () => {
    expect(getAccessScentCheck(STAND, [standPin], undefined).status).toBe("unknown");
  });
});
