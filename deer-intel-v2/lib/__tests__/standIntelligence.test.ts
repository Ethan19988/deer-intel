import { describe, expect, it } from "vitest";
import {
  daysAgoLabel,
  getStandIntelligenceSummary,
  isHuntingPressureNote,
} from "@/lib/standIntelligence";
import { buildSetupChecklist } from "@/lib/setupChecklist";
import { windSpeedWithUnit } from "@/lib/standWind";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

const stand: Stand = {
  id: "s1",
  propertyId: "p1",
  name: "Ridge",
  standType: "Ladder",
  bestWinds: "NW",
  avoidWinds: "",
  accessRouteNotes: "",
  exitRouteNotes: "",
  notes: "",
  sourcePinId: "stand-pin",
};

function pin(id: string, dLat: number, notes: string, type: MapPin["type"] = "Rub"): MapPin {
  return { id, propertyId: "p1", type, lat: 41 + dLat, lng: -77, createdAt: "", name: id, notes };
}

function summary(pins: MapPin[], hunts: HuntLogEntry[] = [], now = new Date(2026, 10, 8, 12)) {
  return getStandIntelligenceSummary({
    stand,
    propertyId: "p1",
    cameras: [],
    cameraChecks: [],
    hunts,
    pins,
    now,
  });
}

describe("stand pressure notes", () => {
  const standPin = pin("stand-pin", 0, "", "Stand");

  it("ignores a pressure note on a pin across the property", () => {
    // ~1.1 km north of the stand.
    const far = pin("far", 0.01, "Heavy pressure from the neighbors");
    expect(summary([standPin, far]).pressureNotes.title).not.toBe("Pressure note found");
  });

  it("uses a pressure note on a pin near the stand", () => {
    // ~55 m north.
    const near = pin("near", 0.0005, "Heavy pressure from the neighbors");
    expect(summary([standPin, near]).pressureNotes).toEqual({
      title: "Pressure note found",
      detail: "Heavy pressure from the neighbors",
    });
  });

  it("ignores pin notes when the stand isn't on the map", () => {
    const near = pin("near", 0.0005, "Heavy pressure here");
    expect(summary([near]).pressureNotes.title).not.toBe("Pressure note found");
  });

  it("tells hunting pressure from the barometer", () => {
    expect(isHuntingPressureNote("Lots of hunting pressure this week")).toBe(true);
    expect(isHuntingPressureNote("Pressure falling ahead of the front")).toBe(false);
    expect(isHuntingPressureNote("Barometric pressure 30.12 inHg")).toBe(false);
    expect(isHuntingPressureNote("Quiet morning")).toBe(false);
  });
});

describe("plain-English days", () => {
  it("says today and yesterday", () => {
    expect(daysAgoLabel(0)).toBe("today");
    expect(daysAgoLabel(1)).toBe("yesterday");
    expect(daysAgoLabel(4)).toBe("4 days ago");
  });

  it("reads 'Last hunted today' for a sit today", () => {
    const sit = { id: "h1", propertyId: "p1", standId: "s1", standName: "Ridge", date: "2026-11-08", notes: "", windDirection: "NW", bucks: 0, does: 0, fawns: 0 } as HuntLogEntry;
    expect(summary([], [sit]).lastHunted.detail).toBe("Last hunted today.");
  });
});

describe("small copy fixes", () => {
  it("says '1 more stand needs winds'", () => {
    const stands = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => ({
      ...stand,
      id,
      name: id,
      bestWinds: "",
    }));
    const labels: string[] = [];
    for (let count = 1; count <= stands.length; count += 1) {
      buildSetupChecklistLabels(stands.slice(0, count)).forEach((label) => labels.push(label));
    }
    expect(labels).toContain("1 more stand needs winds");
    expect(labels.some((label) => /^1 more stands/.test(label))).toBe(false);
  });

  it("keeps wind speed units", () => {
    expect(windSpeedWithUnit("7 mph", "mph")).toBe("7 mph");
    expect(windSpeedWithUnit("12 km/h", "km/h")).toBe("12 km/h");
    expect(windSpeedWithUnit("7", "km/h")).toBe("7 km/h");
  });
});

function buildSetupChecklistLabels(stands: Stand[]): string[] {
  const items = buildSetupChecklist({
    property: { id: "p1", name: "Ridge", county: "", acres: "", notes: "" },
    stands,
    cameras: [],
    pins: [],
  } as unknown as Parameters<typeof buildSetupChecklist>[0]);
  return items.map((item) => item.label);
}
