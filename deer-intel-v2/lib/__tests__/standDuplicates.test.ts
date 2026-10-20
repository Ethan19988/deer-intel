import { describe, expect, it } from "vitest";
import { findLikelyDuplicateStands } from "@/lib/standDuplicates";
import type { Stand } from "@/types/stand";

function stand(id: string, name: string, extra: Partial<Stand> = {}): Stand {
  return {
    id,
    propertyId: "p1",
    name,
    standType: "Ladder",
    bestWinds: "",
    avoidWinds: "",
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
    ...extra,
  };
}

describe("findLikelyDuplicateStands", () => {
  it("flags the same-named copy that has no winds", () => {
    const ids = findLikelyDuplicateStands([
      stand("a", "Ethan's Treestand Near Laurel", { bestWinds: "N, NE" }),
      stand("b", "ethan's treestand near laurel "),
      stand("c", "Ridge Ladder"),
    ]);
    expect([...ids]).toEqual(["b"]);
  });

  it("falls back to the copy that isn't on the map when neither has winds", () => {
    const ids = findLikelyDuplicateStands([
      stand("a", "Creek", { sourcePinId: "pin-1" }),
      stand("b", "Creek"),
    ]);
    expect([...ids]).toEqual(["b"]);
  });

  it("leaves true ties and different properties alone", () => {
    expect(findLikelyDuplicateStands([stand("a", "Creek"), stand("b", "Creek")]).size).toBe(0);
    expect(
      findLikelyDuplicateStands([
        stand("a", "Creek", { bestWinds: "W" }),
        stand("b", "Creek", { propertyId: "p2" }),
      ]).size,
    ).toBe(0);
  });
});
