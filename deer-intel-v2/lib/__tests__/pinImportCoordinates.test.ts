import { describe, expect, it } from "vitest";
import {
  parseCoordinate,
  parseGpxLatLng,
  parseKmlCoordinates,
} from "@/lib/pinImport";

describe("parseCoordinate", () => {
  it("reads numbers and treats blank/missing as NaN, never 0", () => {
    expect(parseCoordinate(" 40.25 ")).toBe(40.25);
    expect(parseCoordinate("-77.1")).toBe(-77.1);
    expect(parseCoordinate("")).toBeNaN();
    expect(parseCoordinate("   ")).toBeNaN();
    expect(parseCoordinate(null)).toBeNaN();
    expect(parseCoordinate(undefined)).toBeNaN();
    expect(parseCoordinate("abc")).toBeNaN();
  });
});

describe("parseKmlCoordinates", () => {
  it("reads a plain lng,lat,alt tuple", () => {
    expect(parseKmlCoordinates("-77.5,40.8,0")).toEqual({ lat: 40.8, lng: -77.5 });
  });

  it("handles spaces after the comma instead of reading lat as blank", () => {
    expect(parseKmlCoordinates("  -77.5, 40.8 ")).toEqual({ lat: 40.8, lng: -77.5 });
    expect(parseKmlCoordinates("-77.5 ,  40.8 , 312")).toEqual({ lat: 40.8, lng: -77.5 });
  });

  it("uses the first of several whitespace-separated tuples", () => {
    expect(parseKmlCoordinates("-77.5,40.8,0\n  -78,41,0")).toEqual({ lat: 40.8, lng: -77.5 });
  });

  it("rejects missing or unreadable values", () => {
    expect(parseKmlCoordinates("")).toBeNull();
    expect(parseKmlCoordinates("-77.5")).toBeNull();
    expect(parseKmlCoordinates("-77.5,")).toBeNull();
    expect(parseKmlCoordinates(",40.8")).toBeNull();
    expect(parseKmlCoordinates("x,y")).toBeNull();
    expect(parseKmlCoordinates("0,0")).toBeNull();
    expect(parseKmlCoordinates("200,40")).toBeNull();
  });
});

describe("parseGpxLatLng", () => {
  it("reads lat/lon attributes", () => {
    expect(parseGpxLatLng("40.8", "-77.5")).toEqual({ lat: 40.8, lng: -77.5 });
  });

  it("skips a waypoint missing either attribute instead of placing it at 0", () => {
    expect(parseGpxLatLng(null, "-77.5")).toBeNull();
    expect(parseGpxLatLng("40.8", null)).toBeNull();
    expect(parseGpxLatLng("", "-77.5")).toBeNull();
  });
});
