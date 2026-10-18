import { describe, expect, it } from "vitest";
import { buildHitListSlides } from "@/lib/hitListSlides";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

function photo(id: string, photoDate: string, extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return { id, propertyId: "p", cameraSiteId: "c1", cameraCheckId: "", fileName: "", photoDate, species: "Deer (Antlered)", notes: "", createdAt: "", imageId: `img-${id}`, ...extra };
}

const profile = (id: string, nickname: string): DeerProfile => ({ id, propertyId: "p", nickname, estimatedAge: "4.5", firstSeen: "", lastSeen: "", notes: "" });

const base = {
  propertyId: "p",
  propertyName: "Moore Hill",
  cameras: [{ id: "c1", propertyId: "p", name: "Inside Laurel", cameraType: "Cellular" as const, manufacturer: "", model: "", status: "Active" as const, locationNotes: "", notes: "" }],
  cameraChecks: [],
  hunts: [],
  pins: [],
};

describe("buildHitListSlides", () => {
  it("makes a slide per profile with his newest photo and where he was seen", () => {
    const slides = buildHitListSlides({
      ...base,
      profiles: [profile("b1", "Big 8")],
      photos: [
        photo("old", "2026-10-01T18:00", { deerProfileIds: ["b1"] }),
        photo("new", "2026-10-15T17:30", { deerProfileIds: ["b1"] }),
      ],
    });

    expect(slides).toHaveLength(1);
    expect(slides[0].name).toBe("Big 8");
    expect(slides[0].imageId).toBe("img-new");
    expect(slides[0].lastSeen).toBe("Oct 15 on Inside Laurel");
    expect(slides[0].href).toBe("/properties/p?tab=deer&buck=b1");
  });

  it("adds bucks named on photos that have no profile, without duplicating profiled ones", () => {
    const slides = buildHitListSlides({
      ...base,
      profiles: [profile("b1", "Big 8")],
      photos: [
        photo("a", "2026-10-15T17:30", { buckNames: ["Big 8"] }),
        photo("b", "2026-10-14T07:10", { buckNames: ["Split Brow"] }),
      ],
    });

    expect(slides.map((s) => s.name).sort()).toEqual(["Big 8", "Split Brow"]);
    expect(slides.find((s) => s.name === "Big 8")?.imageId).toBe("img-a");
  });

  it("puts bucks with photos first and ignores other properties", () => {
    const slides = buildHitListSlides({
      ...base,
      profiles: [profile("b1", "No Pic"), profile("b2", "Has Pic"), { ...profile("b3", "Elsewhere"), propertyId: "x" }],
      photos: [photo("a", "2026-10-15T17:30", { deerProfileIds: ["b2"] })],
    });

    expect(slides.map((s) => s.name)).toEqual(["Has Pic", "No Pic"]);
    expect(slides[1].imageId).toBeNull();
  });
});
