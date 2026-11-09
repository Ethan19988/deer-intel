import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECLINATION,
  headingDelta,
  headingFromOrientation,
  magneticDeclination,
  magneticToTrue,
  shouldEmitHeading,
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

describe("heading throttle", () => {
  it("measures the short way round", () => {
    expect(headingDelta(359, 1)).toBe(2);
    expect(headingDelta(10, 350)).toBe(20);
    expect(headingDelta(90, 270)).toBe(180);
    expect(headingDelta(45, 45)).toBe(0);
  });

  it("emits the first reading, then 2°+ turns at most every 250 ms", () => {
    expect(shouldEmitHeading(null, 100, 0)).toBe(true);
    const last = { heading: 100, at: 1_000 };
    expect(shouldEmitHeading(last, 110, 1_100)).toBe(false); // too soon
    expect(shouldEmitHeading(last, 101, 1_400)).toBe(false); // too small
    expect(shouldEmitHeading(last, 102, 1_400)).toBe(true);
    expect(shouldEmitHeading({ heading: 359, at: 0 }, 1, 500)).toBe(true); // wraps
    expect(shouldEmitHeading({ heading: 359, at: 0 }, 0, 500)).toBe(false);
  });
});
