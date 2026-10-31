import { describe, expect, it } from "vitest";
import {
  boundsOfRing,
  distanceKm,
  geomInteriorPoint,
  nearBounds,
  parcelAcresRank,
  parseTileKey,
  pointInTileRing,
  tileBounds,
  tilePixelToLatLng,
} from "@/lib/parcelTileMath";

describe("parcelAcresRank", () => {
  it("treats missing or zero acreage as unknown, never smallest", () => {
    expect(parcelAcresRank(0)).toBe(Infinity);
    expect(parcelAcresRank(Number.NaN)).toBe(Infinity);
    expect(parcelAcresRank(-1)).toBe(Infinity);
    expect(parcelAcresRank(0.21)).toBeLessThan(parcelAcresRank(0));
    expect(parcelAcresRank(84)).toBe(84);
  });
});

describe("distance helpers", () => {
  it("measures a few km about right", () => {
    // ~1 degree of latitude is ~111 km.
    expect(distanceKm({ lat: 40, lng: -77 }, { lat: 41, lng: -77 })).toBeCloseTo(111.3, 0);
    // 0.05 deg longitude at 41N is ~4.2 km.
    const d = distanceKm({ lat: 41, lng: -77 }, { lat: 41, lng: -76.95 });
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(4.4);
  });

  it("checks nearness to a hunt area's box", () => {
    const box = boundsOfRing([
      { lat: 41, lng: -77 },
      { lat: 41.01, lng: -77 },
      { lat: 41.01, lng: -76.99 },
    ]);
    expect(box).not.toBeNull();
    if (!box) return;
    expect(nearBounds({ lat: 41.005, lng: -76.995 }, box, 5)).toBe(true);
    expect(nearBounds({ lat: 41.05, lng: -76.995 }, box, 5)).toBe(true); // ~4.4 km north
    expect(nearBounds({ lat: 41.2, lng: -76.995 }, box, 5)).toBe(false);
    expect(boundsOfRing([])).toBeNull();
  });
});

describe("tile coordinates", () => {
  it("parses protomaps tile-cache keys in either order", () => {
    expect(parseTileKey("1171:1527:12")).toEqual({ z: 12, x: 1171, y: 1527 });
    expect(parseTileKey("12:1171:1527")).toEqual({ z: 12, x: 1171, y: 1527 });
    expect(parseTileKey("not:a:key")).toBeNull();
    expect(parseTileKey("1:2")).toBeNull();
  });

  it("converts a tile pixel back to a map position", () => {
    const tile = { z: 12, x: 1171, y: 1527 };
    const nw = tilePixelToLatLng(tile, 512, { x: 0, y: 0 });
    const se = tilePixelToLatLng(tile, 512, { x: 512, y: 512 });
    const bounds = tileBounds(tile);
    expect(nw.lat).toBeCloseTo(bounds.north, 9);
    expect(nw.lng).toBeCloseTo(bounds.west, 9);
    expect(se.lat).toBeCloseTo(bounds.south, 9);
    expect(se.lng).toBeCloseTo(bounds.east, 9);
    // Tile 1171/1527 at z12 sits in central PA.
    expect(nw.lat).toBeGreaterThan(39.5);
    expect(nw.lat).toBeLessThan(42.5);
    expect(nw.lng).toBeGreaterThan(-81);
    expect(nw.lng).toBeLessThan(-74.5);
  });
});

describe("geomInteriorPoint", () => {
  it("uses the centroid of a simple square", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const p = geomInteriorPoint([square]);
    expect(p?.x).toBeCloseTo(5);
    expect(p?.y).toBeCloseTo(5);
  });

  it("stays inside a U-shaped lot whose centroid falls outside", () => {
    const u = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
      { x: 20, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 30 },
      { x: 0, y: 30 },
    ];
    const p = geomInteriorPoint([u]);
    expect(p).toBeDefined();
    if (p) expect(pointInTileRing(p, u)).toBe(true);
  });

  it("falls back to the first vertex for points", () => {
    expect(geomInteriorPoint([[{ x: 3, y: 4 }]])).toEqual({ x: 3, y: 4 });
    expect(geomInteriorPoint([])).toBeUndefined();
  });
});
