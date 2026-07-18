import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import {
  leafletLayer,
  LineSymbolizer,
  PolygonSymbolizer,
  type Feature,
  type LabelSymbolizer,
  type Layout,
} from "protomaps-leaflet";
import { ownerAcresText } from "@/lib/ownerLabel";

// Statewide land-owner parcels, served as a single PMTiles vector-tile archive
// and rendered client-side. Unlike the baked-JSON overlay (which loads every
// parcel into memory), the map only fetches the tiles in view, so this scales
// to the whole state. The tiles carry only what the overlay renders in their
// `parcels` layer: { owner, acres, pub }.
//
// The ~342 MB archive is hosted on Cloudflare R2 (public bucket with CORS +
// range support), which the browser range-fetches directly — Vercel can't
// serve the Git LFS pointer, and a serverless proxy buckled under protomaps'
// concurrent range-request burst.
const PMTILES_URL =
  "https://pub-d5fa85d2972147979d3a9820dd7195f2.r2.dev/pa-parcels.pmtiles";

// The archive itself starts at z12 — below that there is no tile to fetch, so
// nothing draws AND nothing is tappable (the pick queries loaded tiles). The
// map opens at z8, so callers need this to explain the empty screen rather than
// leaving the overlay looking broken.
export const PARCEL_TILES_MIN_ZOOM = 12;

// Owner labels only make sense zoomed in; below this they collide into mush.
// (protomaps' labeler also drops overlapping labels automatically.)
const LABEL_MIN_ZOOM = 15;

// Boundaries and tap-to-identify work from PARCEL_TILES_MIN_ZOOM, but names
// only start here — worth telling the hunter apart, since "I see lines but no
// names" and "I see nothing" have different fixes.
export const PARCEL_LABEL_MIN_ZOOM = LABEL_MIN_ZOOM;

// Spartan-Forge-style labels: a uniform, modest font (not sized to the parcel),
// plain white regular-weight lettering (no halo, no bold), the owner in CAPS
// with the acreage spelled out on the line below. Long names wrap to fit the
// parcel width instead of shrinking.
const OWNER_NAME_FONT_PX = 13;
const OWNER_ACRES_FONT_PX = 11;
const OWNER_NAME_LINE_PX = OWNER_NAME_FONT_PX * 1.18;
const OWNER_ACRES_LINE_PX = OWNER_ACRES_FONT_PX * 1.3;
// Don't wrap a name into more lines than this — beyond it the block is too tall
// to sit cleanly in a parcel, so the label is gated out until you zoom in.
const OWNER_NAME_MAX_LINES = 3;

// One owner's holding is usually several adjacent tax parcels (and a single big
// parcel gets clipped into a separate feature per vector tile), so the same name
// would otherwise print once per piece — cluttered and confusing. Tag each label
// with the owner name so protomaps' labeler drops a repeat of the same owner
// within this many screen pixels, collapsing a property to a single name.
const OWNER_LABEL_DEDUP_PX = 600;

// Aptos leads the stack (user preference). It ships with modern Windows and
// Office but not iOS/Android; Seravek (bundled with iOS) is the closest
// Aptos-like face on iPhones, then the system font — canvas text falls back
// per-device just like DOM text.
const LABEL_FONT_STACK =
  "Aptos, Seravek, system-ui, -apple-system, Segoe UI, sans-serif";

// Thin the label candidates at lower zoom so only bigger parcels get names
// until you zoom onto a property — mirrors the JSON overlay's acreage gate.
function labelPasses(zoom: number, feature: { props: Record<string, unknown> }) {
  const acres = Number(feature.props.acres) || 0;

  // Acreage is only a cheap pre-filter for "big enough to be worth naming", and
  // plenty of parcels carry none — their county publishes no acreage field, or
  // it's blank for that record. At Moore Hill that's 53 of 93 features in view,
  // STATE GAME LANDS among them. Treating unknown acreage as 0 acres meant
  // those owners never drew until z17, even though tapping the same parcel
  // named them instantly. Let them through and leave it to the fit gate below,
  // which measures whether the name actually fits the parcel on screen — the
  // honest test, and one that doesn't depend on the county's data quality.
  if (!acres) return true;

  if (zoom >= 17) return true;
  if (zoom >= 16) return acres >= 1;
  return acres >= 4;
}

type Pt = { x: number; y: number };

// Greedy word-wrap: break `text` into as few lines as possible that each fit
// within maxWidth at the context's current font, up to maxLines. A single word
// longer than maxWidth stays on its own (over-long) line — the caller's fit
// check then decides whether the whole block still fits the parcel.
function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [text];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const trial = `${current} ${word}`;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else if (lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      // Out of allowed lines — cram the rest onto the last one and let the
      // caller's fit check reject the label if it's now too wide.
      current = `${current} ${words.slice(i).join(" ")}`;
      break;
    }
  }
  lines.push(current);
  return lines;
}

// Squared distance from (px, py) to the segment a-b.
function segDistSq(px: number, py: number, a: Pt, b: Pt): number {
  let x = a.x;
  let y = a.y;
  const dx0 = b.x - x;
  const dy0 = b.y - y;
  if (dx0 !== 0 || dy0 !== 0) {
    const t = ((px - x) * dx0 + (py - y) * dy0) / (dx0 * dx0 + dy0 * dy0);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx0 * t;
      y += dy0 * t;
    }
  }
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy;
}

// Signed distance from a point to the ring boundary: positive inside the ring,
// negative outside (even-odd rule).
function signedRingDist(px: number, py: number, ring: Pt[]): number {
  let inside = false;
  let minSq = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.y > py !== b.y > py &&
      px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
    minSq = Math.min(minSq, segDistSq(px, py, a, b));
  }
  return (inside ? 1 : -1) * Math.sqrt(minSq);
}

// Pole of inaccessibility (Mapbox's polylabel, simplified): the interior point
// farthest from every edge — the visual center a person would label, robust for
// L-shaped/concave parcels where the plain centroid sits near an edge or even
// outside the polygon. Grid cells are refined only while they might still beat
// the best point found, to a tolerance that scales with the ring's size.
function poleOfInaccessibility(ring: Pt[]): Pt {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  const bboxCenter: Pt = { x: minX + width / 2, y: minY + height / 2 };
  if (cellSize <= 0) return bboxCenter;
  const precision = Math.max(cellSize / 16, 1);

  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const makeCell = (x: number, y: number, h: number): Cell => {
    const d = signedRingDist(x, y, ring);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  let best = makeCell(bboxCenter.x, bboxCenter.y, 0);
  const queue: Cell[] = [];
  const h0 = cellSize / 2;
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(makeCell(x + h0, y + h0, h0));
    }
  }

  while (queue.length) {
    // Pop the most promising cell (small queues make a linear scan fine here).
    let bi = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].max > queue[bi].max) bi = i;
    }
    const cell = queue[bi];
    queue[bi] = queue[queue.length - 1];
    queue.pop();

    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;

    const h = cell.h / 2;
    queue.push(
      makeCell(cell.x - h, cell.y - h, h),
      makeCell(cell.x + h, cell.y - h, h),
      makeCell(cell.x - h, cell.y + h, h),
      makeCell(cell.x + h, cell.y + h, h),
    );
  }

  return { x: best.x, y: best.y };
}

// A protomaps label symbolizer that renders each owner name as a uniform,
// Spartan-Forge-style label centered in the parcel: CAPS name (wrapped to fit
// the width) with the acreage spelled out beneath, in plain white. The label is
// only placed once the parcel's on-screen footprint can hold the block — small
// parcels stay unlabeled until you zoom in far enough.
class FitToParcelOwnerSymbolizer {
  place(layout: Layout, geom: Pt[][], feature: Feature) {
    const owner = String(feature.props.owner ?? "")
      .trim()
      .toUpperCase();
    if (!owner) return undefined;

    // Footprint bbox over every ring; the largest ring *by area* (not vertex
    // count — a tiny but vertex-dense ring must not win) carries the label.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let largest: Pt[] = geom[0] ?? [];
    let largestArea = -1;
    for (const ring of geom) {
      let area2 = 0;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        area2 += p.x * q.y - q.x * p.y;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const area = Math.abs(area2);
      if (area > largestArea) {
        largestArea = area;
        largest = ring;
      }
    }
    if (!Number.isFinite(minX) || largest.length === 0) return undefined;

    // Anchor at the ring's pole of inaccessibility — the interior point
    // farthest from every boundary — so the name sits where a person would
    // hand-place it, even in L-shaped or concave parcels where the plain
    // centroid drifts to an edge (or outside the lot entirely).
    const anchor = poleOfInaccessibility(largest);

    const widthPx = maxX - minX;
    const heightPx = maxY - minY;

    const acresText = ownerAcresText(Number(feature.props.acres) || 0);

    // Wrap the CAPS name to the parcel width at the fixed font, then lay out the
    // (optional) acreage caption beneath it.
    const nameFont = `400 ${OWNER_NAME_FONT_PX}px ${LABEL_FONT_STACK}`;
    const acresFont = `400 ${OWNER_ACRES_FONT_PX}px ${LABEL_FONT_STACK}`;
    const widthBudget = widthPx * 0.92;

    layout.scratch.font = nameFont;
    const nameLines = wrapWords(
      layout.scratch,
      owner,
      widthBudget,
      OWNER_NAME_MAX_LINES,
    );

    let textWidth = 0;
    for (const line of nameLines) {
      textWidth = Math.max(textWidth, layout.scratch.measureText(line).width);
    }
    if (acresText) {
      layout.scratch.font = acresFont;
      textWidth = Math.max(textWidth, layout.scratch.measureText(acresText).width);
    }

    const textHeight =
      nameLines.length * OWNER_NAME_LINE_PX +
      (acresText ? OWNER_ACRES_LINE_PX : 0);

    // Gate on fit: only label the parcel once its footprint can actually hold
    // the block. Below that the parcel is too small at this zoom, so leave it
    // unlabeled and let zooming in (which grows the footprint) reveal it.
    if (textWidth > widthPx * 0.98 || textHeight > heightPx * 0.98) {
      return undefined;
    }

    const bboxes = [
      {
        minX: anchor.x - textWidth / 2,
        minY: anchor.y - textHeight / 2,
        maxX: anchor.x + textWidth / 2,
        maxY: anchor.y + textHeight / 2,
      },
    ];

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      // The canvas is translated to the anchor, so lay the block out from the
      // top edge (−textHeight/2) downward, advancing one line at a time.
      let y = -textHeight / 2;
      const fillLine = (line: string, font: string, linePx: number) => {
        ctx.font = font;
        ctx.fillText(line, 0, y + linePx / 2);
        y += linePx;
      };
      for (const line of nameLines) {
        fillLine(line, nameFont, OWNER_NAME_LINE_PX);
      }
      if (acresText) fillLine(acresText, acresFont, OWNER_ACRES_LINE_PX);
    };

    return [
      {
        anchor,
        bboxes,
        draw,
        deduplicationKey: owner,
        deduplicationDistance: OWNER_LABEL_DEDUP_PX,
      },
    ];
  }
}

// A parcel picked by tapping the map: the owner record under the tap, straight
// from the loaded vector tiles (no network lookup).
export type ParcelTileOwnerPick = {
  ownerName: string;
  acres: number;
  isPublic: boolean;
};

type ParcelTilesLayerProps = {
  enabled: boolean;
  // Tap-to-identify: while true, a map tap reports the parcel under it (or null
  // for empty ground) via onOwnerPick. Lets small parcels — whose labels are
  // zoom-gated out — still reveal their owner on demand. The tap location rides
  // along so the caller can look the parcel up in its county's record, which
  // carries fields the vector tile doesn't (parcel ID, situs address).
  pickEnabled?: boolean;
  onOwnerPick?: (
    pick: ParcelTileOwnerPick | null,
    at: { lat: number; lng: number },
  ) => void;
};

export default function ParcelTilesLayer({
  enabled,
  pickEnabled = false,
  onOwnerPick,
}: ParcelTilesLayerProps) {
  const map = useMap();

  // The click handler reads these through a ref so toggling pick mode (e.g.
  // while placing a pin) doesn't tear down and re-create the tile layer.
  const pickRef = useRef({ pickEnabled, onOwnerPick });
  useEffect(() => {
    pickRef.current = { pickEnabled, onOwnerPick };
  });

  useEffect(() => {
    if (!enabled) return;

    const layer = leafletLayer({
      url: PMTILES_URL,
      // Tiles top out at z15; keep drawing them (overzoomed) past that.
      maxDataZoom: 15,
      paintRules: [
        // Public / government land gets a translucent blaze fill.
        {
          dataLayer: "parcels",
          symbolizer: new PolygonSymbolizer({
            fill: "#f97316",
            opacity: 0.18,
          }),
          filter: (_z, f) => f.props.pub === 1,
        },
        // Every parcel gets a light boundary line, legible over satellite.
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#f8fafc",
            width: 0.8,
            opacity: 0.7,
          }),
        },
      ],
      labelRules: [
        {
          dataLayer: "parcels",
          minzoom: LABEL_MIN_ZOOM,
          filter: (z, f) => labelPasses(z, f),
          // Place bigger parcels first so that when several parcels share an
          // owner, the owner-name dedup keeps the label on the largest one — the
          // most central spot for the name across their holding.
          sort: (a, b) => (Number(b.acres) || 0) - (Number(a.acres) || 0),
          symbolizer: new FitToParcelOwnerSymbolizer() as unknown as LabelSymbolizer,
        },
      ],
    });

    layer.addTo(map);

    // Tap-to-identify against the tiles already in the browser (despite the
    // "Debug" name, queryTileFeaturesDebug is the layer's public feature-picking
    // API). When parcels overlap or nest, report the smallest — that's the tiny
    // lot the tap was aimed at, not the farm surrounding it.
    const handleClick = (event: LeafletMouseEvent) => {
      const { pickEnabled: canPick, onOwnerPick: report } = pickRef.current;
      if (!canPick || !report) return;

      const { lat, lng } = event.latlng;
      const picked = layer.queryTileFeaturesDebug(lng, lat, 8);

      let best: ParcelTileOwnerPick | null = null;
      for (const picks of picked.values()) {
        for (const pick of picks) {
          if (pick.layerName !== "parcels") continue;
          const ownerName = String(pick.feature.props.owner ?? "").trim();
          if (!ownerName) continue;
          const acres = Number(pick.feature.props.acres) || 0;
          if (!best || acres < best.acres) {
            best = {
              ownerName,
              acres,
              isPublic: pick.feature.props.pub === 1,
            };
          }
        }
      }

      report(best, { lat, lng });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
      layer.remove();
    };
  }, [enabled, map]);

  return null;
}
