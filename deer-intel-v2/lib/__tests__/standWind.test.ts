import { describe, expect, it } from "vitest";
import {
  getStandWindCheck,
  isCalmWind,
  parseWindDirections,
  windSpeedMph,
} from "@/lib/standWind";
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

describe("parseWindDirections word boundaries", () => {
  it("doesn't read letters inside words as directions", () => {
    expect(parseWindDirections("NW and W, not E")).toEqual(["NW", "W", "E"]);
  });
});

describe("calm winds", () => {
  it("grades a sub-3 mph wind as light & variable, not good or wrong", () => {
    const good = getStandWindCheck(stand("NW", "S"), "NW", "2 mph");
    const wrong = getStandWindCheck(stand("NW", "S"), "S", 1);

    expect(good).toEqual({ status: "marginal", label: "Light & variable", calm: true });
    expect(wrong.status).toBe("marginal");
    expect(wrong.label).toBe("Light & variable");
  });

  it("grades normally at 3 mph and up, or with no speed", () => {
    expect(getStandWindCheck(stand("NW", "S"), "NW", "3 mph").status).toBe("good");
    expect(getStandWindCheck(stand("NW", "S"), "S", "12 mph").status).toBe("avoid");
    expect(getStandWindCheck(stand("NW", "S"), "NW").status).toBe("good");
    expect(getStandWindCheck(stand("NW", "S"), "NW", "").status).toBe("good");
  });

  it("still asks for wind notes before calling it calm", () => {
    expect(getStandWindCheck(stand("", ""), "NW", "1 mph").label).toBe("No wind notes");
  });

  it("reads mph from numbers and labels, converting km/h", () => {
    expect(windSpeedMph(2)).toBe(2);
    expect(windSpeedMph("SW 7 mph")).toBe(7);
    expect(windSpeedMph("4 km/h")).toBeCloseTo(2.485, 2);
    expect(windSpeedMph("calm")).toBeNull();
    expect(isCalmWind("4 km/h")).toBe(true);
    expect(isCalmWind("5 km/h")).toBe(false);
    expect(isCalmWind(undefined)).toBe(false);
  });
});
