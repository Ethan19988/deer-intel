import { describe, expect, it } from "vitest";
import {
  COMPASS_16,
  compassToDegrees,
  degreesToCompass,
  isCompassPoint,
  parseCompassPoint,
  parseCompassPoints,
} from "@/lib/compass";
import { parseWindCompass } from "@/lib/huntPlanner";
import { degreesToCompass as liveDegreesToCompass } from "@/lib/liveWeather";
import { parseWindDirections } from "@/lib/standWind";
import {
  COMPASS_16 as TRAVEL_COMPASS_16,
  compassToDegrees as travelCompassToDegrees,
  degreesToCompass as travelDegreesToCompass,
} from "@/lib/travelDirection";

describe("compass conversions", () => {
  it("has 16 points starting at north", () => {
    expect(COMPASS_16).toHaveLength(16);
    expect(COMPASS_16[0]).toBe("N");
    expect(COMPASS_16[14]).toBe("NW");
  });

  it("maps points to degrees and back", () => {
    expect(compassToDegrees("NW")).toBe(315);
    expect(compassToDegrees(" sse ")).toBe(157.5);
    expect(compassToDegrees("NNNW")).toBeNull();
    for (const point of COMPASS_16) {
      expect(degreesToCompass(compassToDegrees(point) ?? -1)).toBe(point);
    }
  });

  it("rounds any bearing to the nearest point, wrapping both ways", () => {
    expect(degreesToCompass(359)).toBe("N");
    expect(degreesToCompass(11)).toBe("N");
    expect(degreesToCompass(12)).toBe("NNE");
    expect(degreesToCompass(-45)).toBe("NW");
    expect(degreesToCompass(720 + 90)).toBe("E");
  });

  it("recognises exact points only", () => {
    expect(isCompassPoint("wsw")).toBe(true);
    expect(isCompassPoint("NSW")).toBe(false);
    expect(isCompassPoint("")).toBe(false);
  });
});

describe("parseCompassPoints", () => {
  it("reads every point from free text in order", () => {
    expect(parseCompassPoints("NW, N or W")).toEqual(["NW", "N", "W"]);
    expect(parseCompassPoints("NW/W")).toEqual(["NW", "W"]);
    expect(parseCompassPoints("n w")).toEqual(["N", "W"]);
  });

  it("ignores letters inside words and non-points", () => {
    expect(parseCompassPoints("NW and W, not E")).toEqual(["NW", "W", "E"]);
    expect(parseCompassPoints("North wind")).toEqual([]);
    expect(parseCompassPoints("calm")).toEqual([]);
    expect(parseCompassPoints("NNNW")).toEqual([]);
  });

  it("finds the point next to digits", () => {
    expect(parseCompassPoints("8mph NW")).toEqual(["NW"]);
    expect(parseCompassPoints("SW8")).toEqual(["SW"]);
  });
});

describe("parseCompassPoint (one wind string)", () => {
  it("reads the leading point of a forecast wind", () => {
    expect(parseCompassPoint("NW 8 mph")).toBe("NW");
    expect(parseCompassPoint("  sse 4 mph")).toBe("SSE");
  });

  it("finds a point that isn't first", () => {
    expect(parseCompassPoint("8 mph NW")).toBe("NW");
  });

  // The old huntPlanner parser took any leading N/S/E/W letters, so these read
  // as north / south; the shared whole-token parser reads no wind.
  it("doesn't read a word's first letter as a direction", () => {
    expect(parseCompassPoint("Nearly calm")).toBeNull();
    expect(parseCompassPoint("Southerly")).toBeNull();
    expect(parseCompassPoint("")).toBeNull();
  });
});

describe("old module exports still work", () => {
  it("re-exports the same functions", () => {
    expect(TRAVEL_COMPASS_16).toBe(COMPASS_16);
    expect(travelCompassToDegrees("SW")).toBe(225);
    expect(travelDegreesToCompass(90)).toBe("E");
    expect(liveDegreesToCompass(200)).toBe("SSW");
    expect(parseWindDirections("SW, W")).toEqual(["SW", "W"]);
    expect(parseWindCompass("WNW 12 mph")).toBe("WNW");
  });
});
