import { describe, expect, it } from "vitest";
import { getStandWindCheck, parseWindDirections } from "@/lib/standWind";
import type { Stand } from "@/types/stand";

function stand(bestWinds: string, avoidWinds: string): Stand {
  return {
    id: "s1",
    propertyId: "p1",
    name: "Oak Ridge",
    standType: "Ladder",
    bestWinds,
    avoidWinds,
    accessRouteNotes: "",
    exitRouteNotes: "",
    notes: "",
  };
}

describe("parseWindDirections", () => {
  it("pulls compass points out of free text", () => {
    expect(parseWindDirections("NW, N or W")).toEqual(["NW", "N", "W"]);
  });

  it("returns nothing when no compass letters are present", () => {
    expect(parseWindDirections("calm")).toEqual([]);
  });
});

describe("getStandWindCheck", () => {
  it("flags a matching wind as good", () => {
    expect(getStandWindCheck(stand("NW", "S"), "NW").status).toBe("good");
  });

  it("treats a one-point-adjacent wind as good", () => {
    expect(getStandWindCheck(stand("NW", "S"), "NNW").status).toBe("good");
  });

  it("flags a wrong wind as avoid, which beats a good match", () => {
    expect(getStandWindCheck(stand("NW", "S"), "S").status).toBe("avoid");
  });

  it("returns marginal for an off wind", () => {
    expect(getStandWindCheck(stand("NW", "S"), "E").status).toBe("marginal");
  });

  it("returns unknown when the wind isn't a valid compass point", () => {
    expect(getStandWindCheck(stand("NW", "S"), "").status).toBe("unknown");
  });

  it("returns unknown when the stand has no wind notes", () => {
    expect(getStandWindCheck(stand("", ""), "NW").status).toBe("unknown");
  });
});
