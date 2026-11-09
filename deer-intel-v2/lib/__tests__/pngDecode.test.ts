import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePng } from "@/lib/pngDecode";

// Hand-built PNGs: chunks with zeroed CRCs (the decoder skips CRC checks).

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  return out;
}

function ihdr(width: number, height: number, bitDepth: number, colorType: number, interlace = 0) {
  const d = new Uint8Array(13);
  const v = new DataView(d.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  d[8] = bitDepth;
  d[9] = colorType;
  d[12] = interlace;
  return chunk("IHDR", d);
}

function png(parts: Uint8Array[]): Uint8Array {
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const all = [sig, ...parts, chunk("IEND", new Uint8Array(0))];
  const total = all.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** rows: each row already prefixed with its filter byte. */
function idat(rows: number[][]): Uint8Array {
  return chunk("IDAT", new Uint8Array(deflateSync(Uint8Array.from(rows.flat()))));
}

describe("decodePng", () => {
  it("decodes 8-bit RGB with None and Sub filters", () => {
    // 2×2: red, green / blue, white. Row 1 uses Sub (deltas from the left pixel).
    const bytes = png([
      ihdr(2, 2, 8, 2),
      idat([
        [0, 255, 0, 0, 0, 255, 0],
        [1, 0, 0, 255, (255 - 0) & 0xff, (255 - 0) & 0xff, (255 - 255) & 0xff],
      ]),
    ]);
    const img = decodePng(bytes);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(Array.from(img.data)).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]);
  });

  it("decodes RGBA with Up, Average and Paeth filters", () => {
    // 1×3 column of the same pixel (10,20,30,40), each row a different filter.
    const px = [10, 20, 30, 40];
    const bytes = png([
      ihdr(1, 3, 8, 6),
      idat([
        [0, ...px],
        [2, 0, 0, 0, 0], // Up: equals the row above
        [3, ...px.map((v) => (v - (v >> 1)) & 0xff)], // Average: (0 + up) >> 1
      ]),
    ]);
    const img = decodePng(bytes);
    expect(Array.from(img.data)).toEqual([...px, ...px, ...px]);

    const paeth = png([
      ihdr(2, 2, 8, 6),
      idat([
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        // Paeth: x=0 → predictor = up; x=1 → a=left,b=up,c=upleft.
        [4, 0, 0, 0, 0, 0, 0, 0, 0],
      ]),
    ]);
    // Row 1 pixel 0 = up (1,2,3,4). Pixel 1: a=(1,2,3,4), b=(5,6,7,8), c=(1,2,3,4)
    // → p=b → predictor = b, so (5,6,7,8).
    expect(Array.from(decodePng(paeth).data.slice(8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("decodes 8-bit palette images with tRNS alpha", () => {
    const plte = chunk("PLTE", Uint8Array.from([0x68, 0xaa, 0x63, 0xdb, 0xd8, 0x3d, 0, 0, 0]));
    const trns = chunk("tRNS", Uint8Array.from([255, 255, 0]));
    const bytes = png([ihdr(3, 1, 8, 3), plte, trns, idat([[0, 0, 1, 2]])]);
    expect(Array.from(decodePng(bytes).data)).toEqual([
      0x68, 0xaa, 0x63, 255, 0xdb, 0xd8, 0x3d, 255, 0, 0, 0, 0,
    ]);
  });

  it("decodes packed 2-bit palette rows", () => {
    const plte = chunk("PLTE", Uint8Array.from([0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30]));
    // 5 pixels: indices 3,2,1,0,3 → 0b11100100, 0b11000000
    const bytes = png([ihdr(5, 1, 2, 3), plte, idat([[0, 0b11100100, 0b11000000]])]);
    const reds = Array.from(decodePng(bytes).data).filter((_, i) => i % 4 === 0);
    expect(reds).toEqual([30, 20, 10, 0, 30]);
  });

  it("joins multiple IDAT chunks", () => {
    const z = new Uint8Array(deflateSync(Uint8Array.from([0, 9, 8, 7])));
    const bytes = png([ihdr(1, 1, 8, 2), chunk("IDAT", z.slice(0, 3)), chunk("IDAT", z.slice(3))]);
    expect(Array.from(decodePng(bytes).data)).toEqual([9, 8, 7, 255]);
  });

  it("rejects bad signatures and unsupported formats", () => {
    expect(() => decodePng(new Uint8Array(40))).toThrow(/signature/);
    // 16-bit RGB
    expect(() => decodePng(png([ihdr(1, 1, 16, 2), idat([[0, 0, 0, 0, 0, 0, 0]])]))).toThrow(
      /unsupported/,
    );
    // Grayscale
    expect(() => decodePng(png([ihdr(1, 1, 8, 0), idat([[0, 0]])]))).toThrow(/unsupported/);
    // Interlaced
    expect(() => decodePng(png([ihdr(1, 1, 8, 2, 1), idat([[0, 0, 0, 0]])]))).toThrow(/interlaced/);
    // Palette without PLTE
    expect(() => decodePng(png([ihdr(1, 1, 8, 3), idat([[0, 0]])]))).toThrow(/PLTE/);
  });
});
