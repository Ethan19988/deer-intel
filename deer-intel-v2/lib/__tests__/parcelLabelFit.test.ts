import { describe, expect, it } from "vitest";
import {
  LABEL_MAX_Z,
  LABEL_MIN_Z,
  bebasTextWidth,
  labelBlockSize,
  labelMinZoom,
  strictFitZoom,
  wrapName,
} from "../../scripts/parcel-label-fit.mjs";

// A square parcel of `acres` at central-PA latitude, in metres per side.
const side = (acres: number) => Math.sqrt(acres * 4046.86);
const LAT = 41;

// The estimate the tiles were built with before (0.62em per char at 13px).
function previousMinZoom(name: string, wM: number, hM: number): number {
  const full = name.length * (13 * 0.62 + 0.4);
  for (let z = 12; z <= 17; z++) {
    const mpp = (156543.03392 * Math.cos((LAT * Math.PI) / 180)) / 2 ** z;
    const wPx = wM / mpp;
    const hPx = hM / mpp;
    const lines = Math.min(3, Math.max(1, Math.ceil(full / (wPx * 0.92))));
    if (full / lines <= wPx * 0.98 && lines * 13 * 1.18 + 14.3 <= hPx * 0.98) return z;
  }
  return 18;
}

describe("Bebas label metrics", () => {
  it("measures caps narrower than the old 0.62em estimate", () => {
    const name = "ZIMMERMAN HAROLD E JR";
    expect(bebasTextWidth(name)).toBeLessThan(name.length * 13 * 0.62 * (17 / 13));
    expect(bebasTextWidth("W")).toBeGreaterThan(bebasTextWidth("I"));
  });

  it("wraps like the renderer, at most three lines", () => {
    expect(wrapName("SMITH JOHN R & MARY L", 60).length).toBeLessThanOrEqual(3);
    expect(wrapName("MILLER", 150)).toEqual(["MILLER"]);
    expect(labelBlockSize("SMITH JOHN", true).h).toBeGreaterThan(labelBlockSize("SMITH JOHN", false).h);
  });
});

describe("labelMinZoom", () => {
  const names = [
    "SMITH JOHN R & MARY L",
    "STATE GAME LANDS 211",
    "MILLER",
    "PENNSYLVANIA POWER & LIGHT CO",
    "ZIMMERMAN HAROLD E JR",
    "KAUFFMAN FARMS LLC",
  ];
  const sizes = [2, 5, 10, 20, 40, 80, 160, 320, 640];
  const aspects = [0.5, 1, 2];

  it("never shows a name later than before, and often one zoom sooner", () => {
    let sooner = 0;
    let total = 0;
    for (const name of names) {
      for (const acres of sizes) {
        for (const aspect of aspects) {
          const w = side(acres) * Math.sqrt(aspect);
          const h = side(acres) / Math.sqrt(aspect);
          const before = previousMinZoom(name, w, h);
          const now = labelMinZoom(name, true, w, h, LAT);
          expect(now).toBeLessThanOrEqual(before);
          expect(now).toBeGreaterThanOrEqual(before - 1);
          if (now < before) sooner += 1;
          total += 1;
        }
      }
    }
    expect(sooner / total).toBeGreaterThan(0.3);
  });

  it("is at most one zoom ahead of a strict fit inside the parcel", () => {
    for (const name of names) {
      for (const acres of sizes) {
        const s = side(acres);
        const strict = strictFitZoom(name, true, s, s, LAT);
        const mz = labelMinZoom(name, true, s, s, LAT);
        expect(strict - mz).toBeLessThanOrEqual(1);
        expect(mz).toBeGreaterThanOrEqual(LABEL_MIN_Z);
      }
    }
  });

  it("still skips parcels too small to ever label", () => {
    expect(labelMinZoom("PENNSYLVANIA POWER & LIGHT CO", true, 8, 8, LAT)).toBe(LABEL_MAX_Z + 1);
  });

  it("names a big state game land at the first parcel zoom", () => {
    expect(labelMinZoom("STATE GAME LANDS 211", true, side(2000), side(2000), LAT)).toBe(LABEL_MIN_Z);
  });
});
