import { describe, expect, it } from "vitest";
import { heatCanvasSize } from "@/components/insights/heatRaster";

describe("heatCanvasSize", () => {
  const ratio = (s: { width: number; height: number }) => s.width / s.height;

  it("keeps the usual 420 px width for a squarish extent", () => {
    const size = heatCanvasSize(1000, 800);
    expect(size.width).toBe(420);
    expect(size.height).toBe(336);
  });

  it("keeps equal x/y scale for a very tall extent", () => {
    const size = heatCanvasSize(1000, 20_000);
    expect(size.height).toBe(1400);
    expect(size.width).toBe(70);
    expect(size.padXM).toBe(0);
    expect(ratio(size)).toBeCloseTo(1000 / 20_000, 3);
  });

  it("pads a very wide, thin extent instead of stretching it", () => {
    const size = heatCanvasSize(50_000, 600);
    expect(size.width).toBeLessThanOrEqual(420);
    expect(size.height).toBe(60);
    // Padded height in metres at the same scale as the width.
    expect((600 + 2 * size.padYM) * size.pxPerM).toBeCloseTo(60, 5);
    expect(50_000 * size.pxPerM).toBeCloseTo(size.width, 0);
  });
});
