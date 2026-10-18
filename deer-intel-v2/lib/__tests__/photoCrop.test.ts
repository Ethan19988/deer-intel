import { describe, expect, it } from "vitest";
import { detectPhotoBand } from "@/lib/photoCrop";

// Deterministic pseudo-random texture so tests don't flake.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

type Band = { from: number; to: number; kind: "flat" | "text" | "photo" | "dimPhoto" };

function image(width: number, height: number, bands: Band[]): number[] {
  const rand = noise(7);
  const gray = new Array(width * height).fill(17);
  for (const band of bands) {
    for (let y = band.from; y < band.to; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = 17;
        if (band.kind === "photo") value = 40 + Math.floor(rand() * 180);
        if (band.kind === "dimPhoto") value = 8 + Math.floor(rand() * 50);
        // Text: a few bright glyph pixels on the flat panel.
        if (band.kind === "text") value = x % 9 < 2 && y % 4 < 2 ? 225 : 17;
        gray[y * width + x] = value;
      }
    }
  }
  return gray;
}

const W = 160;
const H = 347;
const screenshot: Band[] = [
  { from: 0, to: 12, kind: "text" }, // status bar
  { from: 52, to: 122, kind: "photo" },
  { from: 150, to: 158, kind: "text" },
  { from: 165, to: 173, kind: "text" },
  { from: 180, to: 188, kind: "text" },
];

describe("detectPhotoBand", () => {
  it("finds the camera photo inside an app screenshot", () => {
    const band = detectPhotoBand(image(W, H, screenshot), W, H);

    expect(band).toEqual({ left: 0, top: 52, right: W, bottom: 122 });
  });

  it("finds a dark night (IR) photo too", () => {
    const night = screenshot.map((b) => (b.kind === "photo" ? { ...b, kind: "dimPhoto" as const } : b));

    expect(detectPhotoBand(image(W, H, night), W, H)).toMatchObject({ top: 52, bottom: 122 });
  });

  it("leaves a normal landscape camera photo alone", () => {
    const h = 120;
    expect(detectPhotoBand(image(W, h, [{ from: 0, to: h, kind: "photo" }]), W, h)).toBeNull();
  });

  it("leaves a tall image alone when the photo fills it", () => {
    expect(detectPhotoBand(image(W, H, [{ from: 0, to: H, kind: "photo" }]), W, H)).toBeNull();
  });

  it("returns null for an all-text screenshot", () => {
    expect(detectPhotoBand(image(W, H, [{ from: 100, to: 140, kind: "text" }]), W, H)).toBeNull();
  });

  it("trims flat side margins around an inset photo", () => {
    const gray = image(W, H, screenshot);
    for (let y = 52; y < 122; y += 1) {
      for (let x = 0; x < 10; x += 1) gray[y * W + x] = 240;
      for (let x = 150; x < W; x += 1) gray[y * W + x] = 240;
    }

    expect(detectPhotoBand(gray, W, H)).toEqual({ left: 10, top: 52, right: 150, bottom: 122 });
  });
});
