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
import { idealLabelFontPx, ownerAcresText } from "@/lib/ownerLabel";

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

// Clamp for the fit-to-parcel font. Slightly tighter than the baked overlay's
// range since the statewide view is denser with small suburban parcels.
const LABEL_MIN_PX = 9;
const LABEL_MAX_PX = 28;

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

// A protomaps label symbolizer that sizes each owner name to fit inside its
// parcel's on-screen footprint (Spartan-Forge style), instead of a fixed font.
// place() receives the polygon already transformed into display pixels, so the
// footprint — and therefore the label size — grows and shrinks with zoom.
class FitToParcelOwnerSymbolizer {
  place(layout: Layout, geom: Pt[][], feature: Feature) {
    const owner = String(feature.props.owner ?? "").trim();
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
    const lines = acresText ? [owner, acresText] : [owner];

    // Only label a parcel once it's physically big enough on screen to hold the
    // name at a readable size. If the best-fit font would fall below the
    // minimum, the parcel is too small at this zoom — skip it so the name is
    // revealed by zooming in (the footprint grows with zoom), not crammed over
    // the boundary. Replaces clamping a tiny parcel's name up to the minimum.
    const idealPx = idealLabelFontPx(widthPx, heightPx, owner, acresText);
    if (idealPx < LABEL_MIN_PX) return undefined;
    const fontPx = Math.min(idealPx, LABEL_MAX_PX);
    const lineHeight = fontPx * 1.2;

    // Measure the widest line for a collision bbox the labeler can index.
    layout.scratch.font = `600 ${fontPx}px ${LABEL_FONT_STACK}`;
    let textWidth = 0;
    for (const line of lines) {
      textWidth = Math.max(textWidth, layout.scratch.measureText(line).width);
    }
    const textHeight = lineHeight * lines.length;

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
      // The canvas is already translated to the anchor, so lay the block out
      // vertically centered around the origin.
      lines.forEach((line, i) => {
        const isName = i === 0;
        const size = isName ? fontPx : fontPx * 0.8;
        const y = (i - (lines.length - 1) / 2) * lineHeight;
        ctx.font = `${isName ? 600 : 500} ${size}px ${LABEL_FONT_STACK}`;
        // Light halo keeps the name legible over any satellite imagery.
        ctx.lineWidth = Math.max(size / 5, 1.5);
        ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
        ctx.strokeText(line, 0, y);
        ctx.fillStyle = isName ? "#0b1120" : "#334155";
        ctx.fillText(line, 0, y);
      });
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
