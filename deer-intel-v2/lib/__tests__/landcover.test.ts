import { describe, expect, it } from "vitest";
import {
  MOVEMENT_GRID_LIMITS,
  NLCD_CLASSES,
  bboxSizeM,
  classifyLandcoverImage,
  gridCellCenter,
  gridPlanKey,
  isDeveloped,
  isForest,
  isOpenFood,
  isShrubRegen,
  isWater,
  nlcdClassForColor,
  nlcdGetMapUrl,
  parseMovementGridQuery,
  planMovementGrid,
} from "@/lib/landcover";

describe("NLCD color → class", () => {
  it("maps every legend color to its own class", () => {
    for (const c of NLCD_CLASSES) {
      expect(nlcdClassForColor(...c.rgb)).toBe(c.code);
    }
  });

  it("snaps near colors (resampling/antialias drift) to the nearest class", () => {
    expect(nlcdClassForColor(0x6a, 0xa8, 0x60)).toBe(41); // ~deciduous
    expect(nlcdClassForColor(0xdd, 0xd6, 0x40)).toBe(81); // ~pasture
    // Classic NLCD legend colors (slightly different) still land right.
    expect(nlcdClassForColor(0x68, 0xab, 0x5f)).toBe(41);
    expect(nlcdClassForColor(0xab, 0x6c, 0x28)).toBe(82);
  });

  it("returns 0 for transparent or off-legend pixels", () => {
    expect(nlcdClassForColor(0x68, 0xaa, 0x63, 0)).toBe(0);
    expect(nlcdClassForColor(255, 0, 255)).toBe(0);
  });

  it("groups classes for the route model", () => {
    expect([41, 42, 43].every(isForest)).toBe(true);
    expect(isForest(52)).toBe(false);
    expect([71, 81, 82].every(isOpenFood)).toBe(true);
    expect(isOpenFood(41)).toBe(false);
    expect(isShrubRegen(52)).toBe(true);
    expect(isWater(11)).toBe(true);
    expect(isWater(90)).toBe(false);
    expect([21, 22, 23, 24].every(isDeveloped)).toBe(true);
    expect(isDeveloped(31)).toBe(false);
  });

  it("flips image rows so grid row 0 is south", () => {
    // 2×2 image, top row forest/forest, bottom row crops/water.
    const px = (rgb: readonly number[]) => [...rgb, 255];
    const forest = NLCD_CLASSES.find((c) => c.code === 41)!.rgb;
    const crops = NLCD_CLASSES.find((c) => c.code === 82)!.rgb;
    const water = NLCD_CLASSES.find((c) => c.code === 11)!.rgb;
    const data = Uint8Array.from([...px(forest), ...px(forest), ...px(crops), ...px(water)]);
    expect(classifyLandcoverImage({ width: 2, height: 2, data })).toEqual([82, 11, 41, 41]);
  });
});

describe("grid geometry", () => {
  const center = { lat: 41.2, lng: -77.5 };

  it("defaults to a ~1.4 km square of 40 m cells around a point", () => {
    const plan = planMovementGrid(center);
    expect(plan.cellM).toBe(40);
    expect(plan.rows).toBe(35);
    expect(plan.cols).toBe(35);
    const { heightM, widthM } = bboxSizeM(plan.bbox);
    expect(heightM).toBeCloseTo(1400, 0);
    expect(widthM).toBeCloseTo(1400, 0);
    // Centered on the point.
    expect((plan.bbox.minLat + plan.bbox.maxLat) / 2).toBeCloseTo(center.lat, 9);
    expect((plan.bbox.minLng + plan.bbox.maxLng) / 2).toBeCloseTo(center.lng, 9);
  });

  it("raises the cell size to stay within 40×40 on big areas", () => {
    const dLat = 4000 / 111_320;
    const dLng = 2000 / (111_320 * Math.cos((41.2 * Math.PI) / 180));
    const plan = planMovementGrid(center, {
      minLat: 41.2 - dLat / 2,
      maxLat: 41.2 + dLat / 2,
      minLng: -77.5 - dLng / 2,
      maxLng: -77.5 + dLng / 2,
    });
    expect(plan.cellM).toBe(100);
    expect(plan.rows).toBe(40);
    expect(plan.cols).toBe(20);
    expect(plan.rows).toBeLessThanOrEqual(MOVEMENT_GRID_LIMITS.maxCells);
  });

  it("covers the whole bbox and pads tiny outlines", () => {
    const bbox = { minLat: 41.2, maxLat: 41.2013, minLng: -77.5, maxLng: -77.4991 };
    const plan = planMovementGrid(center, bbox);
    expect(plan.bbox.minLat).toBeLessThanOrEqual(bbox.minLat);
    expect(plan.bbox.maxLat).toBeGreaterThanOrEqual(bbox.maxLat);
    expect(plan.bbox.minLng).toBeLessThanOrEqual(bbox.minLng);
    expect(plan.bbox.maxLng).toBeGreaterThanOrEqual(bbox.maxLng);
    expect(plan.rows * plan.cellM).toBeGreaterThanOrEqual(MOVEMENT_GRID_LIMITS.minSideM);
  });

  it("uses square cells in meters with consistent degree steps", () => {
    const plan = planMovementGrid(center);
    expect(plan.cellLat * 111_320).toBeCloseTo(plan.cellM, 6);
    expect(plan.cellLng * 111_320 * Math.cos((center.lat * Math.PI) / 180)).toBeCloseTo(
      plan.cellM,
      3,
    );
    const sw = gridCellCenter(plan, 0, 0);
    expect(sw.lat).toBeCloseTo(plan.origin.lat + plan.cellLat / 2, 12);
    expect(sw.lng).toBeCloseTo(plan.origin.lng + plan.cellLng / 2, 12);
    const ne = gridCellCenter(plan, plan.rows - 1, plan.cols - 1);
    expect(ne.lat).toBeCloseTo(plan.bbox.maxLat - plan.cellLat / 2, 12);
    expect(ne.lng).toBeCloseTo(plan.bbox.maxLng - plan.cellLng / 2, 12);
  });

  it("gives the same cache key for the same ground", () => {
    expect(gridPlanKey(planMovementGrid(center))).toBe(gridPlanKey(planMovementGrid({ ...center })));
    expect(gridPlanKey(planMovementGrid(center))).not.toBe(
      gridPlanKey(planMovementGrid({ lat: 41.21, lng: -77.5 })),
    );
  });

  it("builds a WMS 1.1.1 GetMap with lng,lat bbox order and one pixel per cell", () => {
    const plan = planMovementGrid(center);
    const url = new URL(nlcdGetMapUrl(plan.bbox, plan.cols, plan.rows));
    expect(url.searchParams.get("version")).toBe("1.1.1");
    expect(url.searchParams.get("srs")).toBe("EPSG:4326");
    expect(url.searchParams.get("width")).toBe("35");
    expect(url.searchParams.get("height")).toBe("35");
    const [minx, miny, maxx, maxy] = url.searchParams.get("bbox")!.split(",").map(Number);
    expect(minx).toBeCloseTo(plan.bbox.minLng, 6);
    expect(miny).toBeCloseTo(plan.bbox.minLat, 6);
    expect(maxx).toBeCloseTo(plan.bbox.maxLng, 6);
    expect(maxy).toBeCloseTo(plan.bbox.maxLat, 6);
  });
});

describe("parseMovementGridQuery", () => {
  const q = (s: string) => parseMovementGridQuery(new URLSearchParams(s));

  it("accepts a bare point", () => {
    const r = q("lat=41.23456&lng=-77.54321");
    expect(r).toEqual({ ok: true, center: { lat: 41.2346, lng: -77.5432 }, bbox: null });
  });

  it("rejects missing or out-of-range coordinates", () => {
    expect(q("lat=41").ok).toBe(false);
    expect(q("lat=&lng=").ok).toBe(false);
    expect(q("lat=91&lng=0").ok).toBe(false);
    expect(q("lat=41&lng=200").ok).toBe(false);
    expect(q("lat=abc&lng=-77").ok).toBe(false);
  });

  it("requires all four bbox params, ordered", () => {
    expect(q("lat=41&lng=-77&minLat=41").ok).toBe(false);
    expect(q("lat=41&lng=-77&minLat=41.01&maxLat=41&minLng=-77.01&maxLng=-77").ok).toBe(false);
    const r = q("lat=41&lng=-77&minLat=41&maxLat=41.01&minLng=-77.01&maxLng=-77");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bbox).toEqual({ minLat: 41, maxLat: 41.01, minLng: -77.01, maxLng: -77 });
      expect(r.center.lat).toBeCloseTo(41.005, 9);
    }
  });

  it("rejects areas over 6 km per side", () => {
    // 0.06° of latitude ≈ 6.7 km
    expect(q("lat=41&lng=-77&minLat=41&maxLat=41.06&minLng=-77.01&maxLng=-77").ok).toBe(false);
    // 0.05° ≈ 5.6 km is fine
    expect(q("lat=41&lng=-77&minLat=41&maxLat=41.05&minLng=-77.01&maxLng=-77").ok).toBe(true);
  });
});
