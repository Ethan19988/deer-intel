import { inflateSync } from "node:zlib";

// Minimal server-side PNG decoder for small WMS map images (the land-cover
// read in /api/movement-grid). No dependency: node:zlib inflates the IDAT
// stream and the five PNG row filters are undone here.
//
// Supported: 8-bit truecolor (2), 8-bit truecolor + alpha (6), and palette
// (3) at 1/2/4/8 bits with optional tRNS alpha. Non-interlaced only.
// Anything else throws — callers treat that as "land cover unavailable".
//
// Server only (node:zlib) — never import into a "use client" file.

export type DecodedImage = {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major, row 0 = TOP of the image. */
  data: Uint8Array;
};

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** Refuse absurd sizes so a bad header can't allocate gigabytes. */
const MAX_PIXELS = 4096 * 4096;

export function decodePng(bytes: Uint8Array): DecodedImage {
  if (bytes.length < SIGNATURE.length + 25) throw new Error("PNG: too short");
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error("PNG: bad signature");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let paletteAlpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let sawHeader = false;

  let pos = SIGNATURE.length;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7],
    );
    const start = pos + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error("PNG: truncated chunk");
    const chunk = bytes.subarray(start, end);

    if (type === "IHDR") {
      if (length < 13) throw new Error("PNG: bad IHDR");
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      const compression = chunk[10];
      const filter = chunk[11];
      const interlace = chunk[12];
      if (compression !== 0 || filter !== 0) throw new Error("PNG: unknown method");
      if (interlace !== 0) throw new Error("PNG: interlaced images not supported");
      sawHeader = true;
    } else if (type === "PLTE") {
      palette = chunk;
    } else if (type === "tRNS") {
      paletteAlpha = chunk;
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    pos = end + 4; // skip CRC
  }

  if (!sawHeader) throw new Error("PNG: missing IHDR");
  if (width < 1 || height < 1 || width * height > MAX_PIXELS) {
    throw new Error("PNG: bad dimensions");
  }

  let channels: number;
  if (colorType === 2 && bitDepth === 8) channels = 3;
  else if (colorType === 6 && bitDepth === 8) channels = 4;
  else if (colorType === 3 && [1, 2, 4, 8].includes(bitDepth)) channels = 1;
  else throw new Error(`PNG: unsupported color type ${colorType} / bit depth ${bitDepth}`);
  if (colorType === 3 && (!palette || palette.length < 3)) {
    throw new Error("PNG: palette image without PLTE");
  }
  if (idat.length === 0) throw new Error("PNG: no image data");

  const raw = inflateSync(concat(idat));
  const bitsPerPixel = channels * bitDepth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  // Filter byte offset: bytes per complete pixel, at least 1.
  const bpp = Math.max(1, bitsPerPixel >> 3);
  if (raw.length < height * (stride + 1)) throw new Error("PNG: image data too short");

  const pixels = unfilter(raw, height, stride, bpp);
  const out = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      if (colorType === 2) {
        const i = row + x * 3;
        out[o] = pixels[i];
        out[o + 1] = pixels[i + 1];
        out[o + 2] = pixels[i + 2];
        out[o + 3] = 255;
      } else if (colorType === 6) {
        const i = row + x * 4;
        out[o] = pixels[i];
        out[o + 1] = pixels[i + 1];
        out[o + 2] = pixels[i + 2];
        out[o + 3] = pixels[i + 3];
      } else {
        const index = paletteIndex(pixels, row, x, bitDepth);
        const p = index * 3;
        if (!palette || p + 2 >= palette.length) throw new Error("PNG: palette index out of range");
        out[o] = palette[p];
        out[o + 1] = palette[p + 1];
        out[o + 2] = palette[p + 2];
        out[o + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
      }
    }
  }

  return { width, height, data: out };
}

function paletteIndex(pixels: Uint8Array, row: number, x: number, bitDepth: number): number {
  if (bitDepth === 8) return pixels[row + x];
  const perByte = 8 / bitDepth;
  const byte = pixels[row + Math.floor(x / perByte)];
  const shift = 8 - bitDepth * ((x % perByte) + 1);
  return (byte >> shift) & ((1 << bitDepth) - 1);
}

/** Undo the per-row PNG filters (None, Sub, Up, Average, Paeth). */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride; // only read when y > 0
    for (let i = 0; i < stride; i += 1) {
      const value = raw[src + i];
      const left = i >= bpp ? out[dst + i - bpp] : 0;
      const up = y > 0 ? out[prev + i] : 0;
      const upLeft = y > 0 && i >= bpp ? out[prev + i - bpp] : 0;
      let predictor: number;
      switch (filter) {
        case 0:
          predictor = 0;
          break;
        case 1:
          predictor = left;
          break;
        case 2:
          predictor = up;
          break;
        case 3:
          predictor = (left + up) >> 1;
          break;
        case 4:
          predictor = paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`PNG: bad filter type ${filter}`);
      }
      out[dst + i] = (value + predictor) & 0xff;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
