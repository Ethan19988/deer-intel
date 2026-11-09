import { describe, expect, it } from "vitest";
import { farFromPropertyMeters, isAlreadyOnMap } from "@/lib/pinImportReview";

const pin = { name: "Ridge Stand", lat: 40.8, lng: -77.5 };

describe("isAlreadyOnMap", () => {
  it("matches the same name within about a meter", () => {
    expect(isAlreadyOnMap({ name: " ridge stand ", lat: 40.800005, lng: -77.5 }, [pin])).toBe(true);
  });

  it("doesn't match a different name or a pin a few meters away", () => {
    expect(isAlreadyOnMap({ name: "Creek Stand", lat: 40.8, lng: -77.5 }, [pin])).toBe(false);
    // ~11 m north.
    expect(isAlreadyOnMap({ name: "Ridge Stand", lat: 40.8001, lng: -77.5 }, [pin])).toBe(false);
    expect(isAlreadyOnMap({ name: "Ridge Stand", lat: 40.8, lng: -77.5 }, [])).toBe(false);
  });
});

describe("farFromPropertyMeters", () => {
  const center = { lat: 40.8, lng: -77.5 };

  it("is null inside 5 km or without a center", () => {
    expect(farFromPropertyMeters({ lat: 40.82, lng: -77.5 }, center)).toBeNull();
    expect(farFromPropertyMeters({ lat: 45, lng: -77.5 }, null)).toBeNull();
  });

  it("returns the distance beyond 5 km", () => {
    const meters = farFromPropertyMeters({ lat: 40.9, lng: -77.5 }, center);
    expect(meters).not.toBeNull();
    expect(meters!).toBeGreaterThan(10_000);
    expect(meters!).toBeLessThan(12_000);
  });
});
