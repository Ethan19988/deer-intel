import { describe, expect, it } from "vitest";
import {
  recomputeHeading,
  retargetCameraPhotoHeadings,
  retargetPhotoHeading,
} from "@/lib/photoHeading";
import type { PhotoRecord } from "@/types/photo";

function photo(extra: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: "p1",
    propertyId: "prop",
    cameraSiteId: "c1",
    cameraCheckId: "",
    fileName: "a.jpg",
    photoDate: "2026-11-04T06:42",
    species: "Buck",
    notes: "",
    createdAt: "",
    ...extra,
  };
}

describe("recomputeHeading", () => {
  it("recomputes an auto heading for the new facing", () => {
    // Camera facing N: left-to-right is E. Facing S: left-to-right is W.
    expect(recomputeHeading("Left to right", "E", "N", "S")).toBe("W");
  });

  it("fills a heading once an unpointed camera gets a facing", () => {
    expect(recomputeHeading("Toward camera", "", "", "NW")).toBe("SE");
  });

  it("keeps a heading the hunter set by hand", () => {
    expect(recomputeHeading("Left to right", "NE", "N", "S")).toBe("NE");
  });

  it("leaves photos with no frame read alone", () => {
    expect(recomputeHeading("", "NE", "N", "S")).toBe("NE");
  });

  it("clears the auto heading when the new camera isn't pointed", () => {
    expect(recomputeHeading("Left to right", "E", "N", "")).toBe("");
  });
});

describe("retargetPhotoHeading", () => {
  it("updates a moved photo's heading and keeps the same object when unchanged", () => {
    const moved = retargetPhotoHeading(
      photo({ frameDirection: "Left to right", travelDirection: "E" }),
      "N",
      "S",
    );
    expect(moved.travelDirection).toBe("W");

    const untouched = photo({ travelDirection: "E" });
    expect(retargetPhotoHeading(untouched, "N", "S")).toBe(untouched);
  });

  it("only touches the re-pointed camera's photos", () => {
    const mine = photo({ id: "a", frameDirection: "Away from camera", travelDirection: "N" });
    const other = photo({ id: "b", cameraSiteId: "c2", frameDirection: "Away from camera", travelDirection: "N" });
    const [nextMine, nextOther] = retargetCameraPhotoHeadings([mine, other], "c1", "N", "E");
    expect(nextMine.travelDirection).toBe("E");
    expect(nextOther).toBe(other);
  });
});
