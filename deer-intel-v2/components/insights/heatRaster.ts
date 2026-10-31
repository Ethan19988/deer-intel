// Canvas raster for the sighting heat map: each spot is a soft radial blob,
// accumulated additively (overlapping stands and cameras reinforce each other),
// then colored through the same amber → orange → red ramp the main map's heat
// layers use, so "red means deer" stays one idea across the app. Browser-only
// (needs a canvas); returns null on the server.

import type { HeatSpot } from "@/lib/sightingHeat";
import { CAMERA_HEAT_RADIUS_M, STAND_HEAT_RADIUS_M } from "@/lib/sightingHeat";

export type HeatRaster = {
  url: string;
  bounds: [[number, number], [number, number]];
};

const CANVAS_WIDTH = 420;
const CANVAS_MAX_HEIGHT = 1400;
const CANVAS_MIN_SIDE = 60;
const M_PER_DEG_LAT = 110_540;

export type HeatCanvasSize = {
  width: number;
  height: number;
  /** Pixels per metre, the same along x and y. */
  pxPerM: number;
  /** Metres to add on each side (east+west / north+south) so a very thin
   * extent still gets a canvas CANVAS_MIN_SIDE px across at the same scale. */
  padXM: number;
  padYM: number;
};

/**
 * Canvas size for an extent in metres, at one scale on both axes so blobs stay
 * round: the scale comes from whichever dimension hits its limit first (width
 * 420 px, height 1400 px). A side that would come out thinner than the minimum
 * is widened by padding the extent, not by stretching the scale.
 */
export function heatCanvasSize(widthM: number, heightM: number): HeatCanvasSize {
  const w = Math.max(1, widthM);
  const h = Math.max(1, heightM);
  const pxPerM = Math.min(CANVAS_WIDTH / w, CANVAS_MAX_HEIGHT / h);
  const minM = CANVAS_MIN_SIDE / pxPerM;
  const padXM = w < minM ? (minM - w) / 2 : 0;
  const padYM = h < minM ? (minM - h) / 2 : 0;
  return {
    width: Math.max(1, Math.round((w + 2 * padXM) * pxPerM)),
    height: Math.max(1, Math.round((h + 2 * padYM) * pxPerM)),
    pxPerM,
    padXM,
    padYM,
  };
}

const RAMP: Array<[number, number, number]> = [
  [242, 193, 78],
  [239, 122, 36],
  [209, 53, 43],
];

function ramp(t: number): [number, number, number] {
  const safe = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  const x = safe * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export function renderSightingHeat(spots: HeatSpot[]): HeatRaster | null {
  if (typeof document === "undefined" || spots.length === 0) return null;

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const spot of spots) {
    south = Math.min(south, spot.lat);
    north = Math.max(north, spot.lat);
    west = Math.min(west, spot.lng);
    east = Math.max(east, spot.lng);
  }
  const midLat = (south + north) / 2;
  const mPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);
  const padM = 260;
  south -= padM / M_PER_DEG_LAT;
  north += padM / M_PER_DEG_LAT;
  west -= padM / mPerDegLng;
  east += padM / mPerDegLng;

  const size = heatCanvasSize((east - west) * mPerDegLng, (north - south) * M_PER_DEG_LAT);
  south -= size.padYM / M_PER_DEG_LAT;
  north += size.padYM / M_PER_DEG_LAT;
  west -= size.padXM / mPerDegLng;
  east += size.padXM / mPerDegLng;
  const { width, height, pxPerM } = size;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.globalCompositeOperation = "lighter";
  for (const spot of spots) {
    const baseM = spot.kind === "stand" ? STAND_HEAT_RADIUS_M : CAMERA_HEAT_RADIUS_M;
    // Area grows with the evidence; even the faintest spot stays visible.
    const r = Math.max(6, baseM * (0.7 + 0.8 * Math.sqrt(spot.intensity)) * pxPerM);
    const cx = ((spot.lng - west) / (east - west)) * width;
    const cy = ((north - spot.lat) / (north - south)) * height;
    const alpha = 0.25 + 0.7 * spot.intensity;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.45})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] / 255;
    if (value < 0.04) {
      data[i + 3] = 0;
      continue;
    }
    const [r, g, b] = ramp(Math.pow(value, 0.8));
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.round(255 * Math.min(0.72, 0.12 + value * 0.65));
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.putImageData(image, 0, 0);

  return {
    url: canvas.toDataURL("image/png"),
    bounds: [
      [south, west],
      [north, east],
    ],
  };
}
