import { describe, expect, it } from "vitest";
import {
  cleanPropertyDetails,
  cleanPropertyField,
  propertyRegionLabel,
} from "@/lib/propertyFields";
import { getKnowledgeScore } from "@/lib/propertyDashboard";
import type { Property } from "@/types/property";

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    name: "Finley Run",
    county: "",
    acres: "",
    notes: "",
    ...overrides,
  } as Property;
}

describe("property field placeholders", () => {
  it("treats stored placeholders as blank", () => {
    expect(cleanPropertyField("Unknown")).toBe("");
    expect(cleanPropertyField("Unknown acres")).toBe("");
    expect(cleanPropertyField("No notes yet.")).toBe("");
    expect(cleanPropertyField("  ")).toBe("");
    expect(cleanPropertyField(undefined)).toBe("");
    expect(cleanPropertyField(" Tioga ")).toBe("Tioga");
  });

  it("cleans details for edit prefill", () => {
    expect(
      cleanPropertyDetails({ county: "Unknown", acres: "40", notes: "No notes yet." }),
    ).toEqual({ county: "", acres: "40", notes: "" });
  });

  it("builds the region label without placeholders", () => {
    expect(propertyRegionLabel({ county: "Unknown", acres: "Unknown" })).toBe("");
    expect(propertyRegionLabel({ county: "Tioga", acres: "Unknown" })).toBe("Tioga");
    expect(propertyRegionLabel({ county: "Tioga", acres: "120" }, ", ")).toBe(
      "Tioga, 120 acres",
    );
  });

  it("does not score placeholder notes as filled in", () => {
    const counts = {
      cameraCount: 0,
      standCount: 0,
      huntCount: 0,
      deerProfileCount: 0,
      pinCount: 0,
    };

    expect(
      getKnowledgeScore({ property: property({ notes: "No notes yet." }), ...counts }),
    ).toBe(20);
    expect(
      getKnowledgeScore({ property: property({ notes: "Ridge travel" }), ...counts }),
    ).toBe(35);
  });
});
