import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECLINATION,
  headingFromOrientation,
  magneticDeclination,
  magneticToTrue,
} from "@/lib/deviceHeading";
import { guideReading } from "@/lib/fieldGuide";

describe("magneticDeclination", () => {
  it("is about −9° to −12° west across PA and MD", () => {
    // Pittsburgh, Harrisburg, Philadelphia, Baltimore (NOAA WMM, mid-2020s).
    expect(magneticDeclination(40.44, -80.0)).toBeCloseTo(-9.1, 0);
    expect(magneticDeclination(40.27, -76.88)).toBeCloseTo(-11, 0);
    expect(magneticDeclination(39.95, -75.17)).toBeCloseTo(-12, 0);
    expect(magneticDeclination(39.29, -76.61)).toBeCloseTo(-11, 0);
  });

  it("clamps outside the fit box and falls back without a position", () => {
    expect(magneticDeclination(60, -120)).toBe(magneticDeclination(43, -81));
    expect(magneticDeclination(NaN, NaN)).toBe(DEFAULT_DECLINATION);
  });
});

describe("magneticToTrue", () => {
  it("adds a west (negative) declination and wraps", () => {
    expect(magneticToTrue(0, -11)).toBe(349);
    expect(magneticToTrue(90, -11)).toBe(79);
    expect(magneticToTrue(355, 10)).toBe(5);
  });
});

describe("headingFromOrientation", () => {
  it("reads iOS's magnetic webkitCompassHeading", () => {
    const event = { webkitCompassHeading: 45, absolute: false, alpha: 10 } as unknown as DeviceOrientationEvent;
    expect(headingFromOrientation(event)).toBe(45);
  });

  it("reads an absolute alpha and skips a relative one", () => {
    expect(headingFromOrientation({ absolute: true, alpha: 90 } as DeviceOrientationEvent)).toBe(270);
    expect(headingFromOrientation({ absolute: false, alpha: 90 } as DeviceOrientationEvent)).toBeNull();
  });
});

describe("Guide me with a corrected heading", () => {
  it("points straight ahead when the true heading matches the bearing", () => {
    const from = { lat: 41, lng: -77.5 };
    const to = { lat: 41.01, lng: -77.5 }; // due north (true)
    // Phone's magnetic compass reads ~11° when facing true north here.
    const declination = magneticDeclination(from.lat, from.lng);
    const trueHeading = magneticToTrue(-declination, declination);
    expect(guideReading(from, to, trueHeading).arrowRotation).toBe(0);
  });
});
