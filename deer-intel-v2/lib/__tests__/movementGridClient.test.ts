import { describe, expect, it } from "vitest";
import { clampGridBbox, movementGridRequestFor } from "@/lib/movementGridClient";
import { bboxSizeM } from "@/lib/landcover";

// Moore Hill-sized outline: ~7.5 km east-west, ~6.6 km north-south.
const big = { minLat: 41.41, minLng: -78.38, maxLat: 41.47, maxLng: -78.29 };

describe("clampGridBbox", () => {
  it("leaves a small outline alone", () => {
    const small = { minLat: 41.46, minLng: -78.29, maxLat: 41.47, maxLng: -78.28 };
    expect(clampGridBbox(small)).toEqual(small);
  });

  it("reads the middle of a big outline with no pins", () => {
    const out = clampGridBbox(big);
    const { heightM, widthM } = bboxSizeM(out);
    expect(heightM).toBeLessThanOrEqual(6000);
    expect(widthM).toBeLessThanOrEqual(6000);
    expect((out.minLng + out.maxLng) / 2).toBeCloseTo(-78.335, 3);
  });

  it("slides the window toward the hunter's pins and stays inside the outline", () => {
    const pins = [
      { lat: 41.463, lng: -78.2789 }, // outside the outline: ignored
      { lat: 41.4637, lng: -78.2774 }, // outside
      { lat: 41.4615, lng: -78.3203 },
      { lat: 41.469, lng: -78.2901 },
    ];
    const out = clampGridBbox(big, pins);
    expect(out.maxLng).toBeCloseTo(big.maxLng, 6); // pushed to the east edge
    expect(out.maxLat).toBeLessThanOrEqual(big.maxLat + 1e-9);
    expect(out.minLng).toBeGreaterThanOrEqual(big.minLng - 1e-9);
    for (const p of pins.slice(2)) {
      expect(p.lng).toBeGreaterThanOrEqual(out.minLng);
      expect(p.lng).toBeLessThanOrEqual(out.maxLng);
      expect(p.lat).toBeGreaterThanOrEqual(out.minLat);
      expect(p.lat).toBeLessThanOrEqual(out.maxLat);
    }
  });

  it("ignores pins with bad coordinates", () => {
    expect(clampGridBbox(big, [{ lat: NaN, lng: -78.3 }])).toEqual(clampGridBbox(big));
  });
});

describe("movementGridRequestFor", () => {
  it("keys the request by the focused window", () => {
    const huntArea = [
      { lat: big.minLat, lng: big.minLng },
      { lat: big.minLat, lng: big.maxLng },
      { lat: big.maxLat, lng: big.maxLng },
      { lat: big.maxLat, lng: big.minLng },
    ];
    const property = { latitude: undefined, longitude: undefined, huntArea } as unknown as Parameters<
      typeof movementGridRequestFor
    >[0];
    const plain = movementGridRequestFor(property);
    const focused = movementGridRequestFor(property, [{ lat: 41.469, lng: -78.2901 }]);
    expect(plain && focused).toBeTruthy();
    expect(plain!.key).not.toBe(focused!.key);
  });
});
