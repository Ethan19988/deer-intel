import { describe, expect, it } from "vitest";
import { buildSetupChecklist } from "@/lib/setupChecklist";
import type { Camera } from "@/types/camera";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

const AREA = [
  { lat: 41, lng: -77 },
  { lat: 41.01, lng: -77 },
  { lat: 41.01, lng: -77.01 },
];

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    name: "Moore Hill",
    county: "Tioga",
    acres: "120",
    notes: "",
    latitude: 41.005,
    longitude: -77.005,
    huntArea: AREA,
    ...overrides,
  };
}

function stand(id: string, bestWinds = "NW, W"): Stand {
  return {
    id,
    propertyId: "p1",
    name: `Stand ${id}`,
    standType: "Ladder",
    bestWinds,
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

function pin(type: PinType): MapPin {
  return {
    id: type,
    propertyId: "p1",
    type,
    lat: 41,
    lng: -77,
    createdAt: "2026-10-01",
    name: type,
    notes: "",
  };
}

const camera = { id: "c1", propertyId: "p1", name: "Creek" } as Camera;

function ids(items: { id: string }[]) {
  return items.map((item) => item.id);
}

describe("buildSetupChecklist", () => {
  it("is empty for a fully set-up property", () => {
    const items = buildSetupChecklist({
      property: property(),
      stands: [stand("a")],
      cameras: [camera],
      pins: [pin("Parking"), pin("Bedding Area")],
    });

    expect(items).toEqual([]);
  });

  it("lists every missing piece for a brand-new property", () => {
    const items = buildSetupChecklist({
      property: property({ latitude: undefined, longitude: undefined, huntArea: undefined }),
      stands: [],
      cameras: [],
      pins: [],
    });

    expect(ids(items)).toEqual([
      "hunt-area",
      "stands",
      "cameras",
      "parking",
      "bedding",
    ]);
    expect(items[0].href).toBe("/map?draw=area");
    expect(items[0].detail).toMatch(/center/);
  });

  it("links each stand without winds to its wind picker", () => {
    const items = buildSetupChecklist({
      property: property(),
      stands: [stand("a", ""), stand("b"), stand("c", "  ")],
      cameras: [camera],
      pins: [pin("Gate"), pin("Bedding")],
    });

    expect(ids(items)).toEqual(["winds-a", "winds-c"]);
    expect(items[0].href).toBe("/stands#stand-a");
  });

  it("caps per-stand wind rows and rolls the rest into one", () => {
    const items = buildSetupChecklist({
      property: property(),
      stands: ["a", "b", "c", "d", "e"].map((id) => stand(id, "")),
      cameras: [camera],
      pins: [pin("Parking"), pin("Bedding")],
    });

    expect(ids(items)).toEqual(["winds-a", "winds-b", "winds-c", "winds-more"]);
    expect(items[3].label).toBe("2 more stands need winds");
  });

  it("treats a hunt area under three points as not drawn", () => {
    const items = buildSetupChecklist({
      property: property({ huntArea: AREA.slice(0, 2) }),
      stands: [stand("a")],
      cameras: [camera],
      pins: [pin("Parking"), pin("Bedding")],
    });

    expect(ids(items)).toEqual(["hunt-area"]);
  });
});
