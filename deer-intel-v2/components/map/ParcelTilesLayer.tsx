import { useEffect } from "react";
import { useMap } from "react-leaflet";
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

// Owner labels only make sense zoomed in; below this they collide into mush.
// (protomaps' labeler also drops overlapping labels automatically.)
const LABEL_MIN_ZOOM = 15;

// Spartan-Forge-style labels: a uniform, modest font (not sized to the parcel),
// white with a dark halo, the owner in CAPS with the acreage spelled out on the
// line below. Long names wrap to fit the parcel width instead of shrinking.
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
// within this many screen pixels, collapsing a property to a single name. Big
// enough to span a typical property at label zooms (>=15); genuinely distinct
// owners who happen to share an identical name this close are vanishingly rare.
const OWNER_LABEL_DEDUP_PX = 600;

const LABEL_FONT_STACK = "system-ui, -apple-system, Segoe UI, sans-serif";

// Thin the label candidates at lower zoom so only bigger parcels get names
// until you zoom onto a property — mirrors the JSON overlay's acreage gate.
function labelPasses(zoom: number, feature: { props: Record<string, unknown> }) {
  const acres = Number(feature.props.acres) || 0;
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

// A protomaps label symbolizer that renders each owner name as a uniform,
// Spartan-Forge-style label centered in the parcel: CAPS name (wrapped to fit
// the width) with the acreage spelled out beneath, white with a dark halo. The
// label is only placed once the parcel's on-screen footprint can hold the block
// — small parcels stay unlabeled until you zoom in far enough.
class FitToParcelOwnerSymbolizer {
  place(layout: Layout, geom: Pt[][], feature: Feature) {
    const owner = String(feature.props.owner ?? "")
      .trim()
      .toUpperCase();
    if (!owner) return undefined;

    // Footprint bbox over every ring, plus the largest ring for centering.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let largest: Pt[] = geom[0] ?? [];
    for (const ring of geom) {
      if (ring.length > largest.length) largest = ring;
      for (const p of ring) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (!Number.isFinite(minX) || largest.length === 0) return undefined;

    // Anchor at the largest ring's area-weighted (shoelace) centroid so the name
    // sits at the visual middle of the parcel, instead of drifting toward an
    // edge where the vertices happen to bunch up. Falls back to the bbox center
    // for a degenerate (near-zero-area) ring.
    let signedArea2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < largest.length; i++) {
      const p0 = largest[i];
      const p1 = largest[(i + 1) % largest.length];
      const cross = p0.x * p1.y - p1.x * p0.y;
      signedArea2 += cross;
      cx += (p0.x + p1.x) * cross;
      cy += (p0.y + p1.y) * cross;
    }
    const anchor: Pt =
      Math.abs(signedArea2) > 1e-6
        ? { x: cx / (3 * signedArea2), y: cy / (3 * signedArea2) }
        : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    const widthPx = maxX - minX;
    const heightPx = maxY - minY;

    const acresText = ownerAcresText(Number(feature.props.acres) || 0);

    // Wrap the CAPS name to the parcel width at the fixed font, then lay out the
    // (optional) acreage caption beneath it.
    const nameFont = `700 ${OWNER_NAME_FONT_PX}px ${LABEL_FONT_STACK}`;
    const acresFont = `500 ${OWNER_ACRES_FONT_PX}px ${LABEL_FONT_STACK}`;
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
      ctx.lineJoin = "round";
      // The canvas is translated to the anchor, so lay the block out from the
      // top edge (−textHeight/2) downward, advancing one line at a time.
      let y = -textHeight / 2;
      const drawLine = (line: string, font: string, linePx: number) => {
        ctx.font = font;
        const cy = y + linePx / 2;
        // Dark halo so the light text reads over any satellite imagery.
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "rgba(10, 15, 20, 0.85)";
        ctx.strokeText(line, 0, cy);
        y += linePx;
      };
      for (const line of nameLines) {
        drawLine(line, nameFont, OWNER_NAME_LINE_PX);
      }
      if (acresText) drawLine(acresText, acresFont, OWNER_ACRES_LINE_PX);

      // Second pass fills the text on top of every halo so adjacent lines'
      // strokes never overlap a neighbor's fill.
      y = -textHeight / 2;
      const fillLine = (
        line: string,
        font: string,
        linePx: number,
        color: string,
      ) => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.fillText(line, 0, y + linePx / 2);
        y += linePx;
      };
      for (const line of nameLines) {
        fillLine(line, nameFont, OWNER_NAME_LINE_PX, "#f8fafc");
      }
      if (acresText) {
        fillLine(acresText, acresFont, OWNER_ACRES_LINE_PX, "rgba(226, 232, 240, 0.92)");
      }
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

type ParcelTilesLayerProps = {
  enabled: boolean;
};

export default function ParcelTilesLayer({ enabled }: ParcelTilesLayerProps) {
  const map = useMap();

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
          // owner, the owner-name dedup keeps the label on the largest one —
          // the most central spot for the name across their holding.
          sort: (a, b) => (Number(b.acres) || 0) - (Number(a.acres) || 0),
          symbolizer: new FitToParcelOwnerSymbolizer() as unknown as LabelSymbolizer,
        },
      ],
    });

    layer.addTo(map);

    return () => {
      layer.remove();
    };
  }, [enabled, map]);

  return null;
}
