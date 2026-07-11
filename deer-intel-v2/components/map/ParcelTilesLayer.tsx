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
import { fitLabelFontPx, ownerAcresText } from "@/lib/ownerLabel";

// Statewide land-owner parcels, served as a single PMTiles vector-tile archive
// and rendered client-side. Unlike the baked-JSON overlay (which loads every
// parcel into memory), the map only fetches the tiles in view, so this scales
// to the whole state. The tiles carry the shared parcel schema in their
// `parcels` layer: { owner, acres, pin, addr, pub }.
//
// The ~342 MB archive is hosted as a GitHub Release asset (too large/CORS-less
// to ship in the deployment), streamed to the browser via the same-origin
// /api/parcel-tiles range-proxy route.
const PMTILES_URL = "/api/parcel-tiles";

// Owner labels only make sense zoomed in; below this they collide into mush.
// (protomaps' labeler also drops overlapping labels automatically.)
const LABEL_MIN_ZOOM = 15;

// Clamp for the fit-to-parcel font. Slightly tighter than the baked overlay's
// range since the statewide view is denser with small suburban parcels.
const LABEL_MIN_PX = 9;
const LABEL_MAX_PX = 28;

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

    // Footprint bbox over every ring, plus the largest ring's centroid as the
    // label anchor (a reasonable interior point for typical parcel shapes).
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

    let sumX = 0;
    let sumY = 0;
    for (const p of largest) {
      sumX += p.x;
      sumY += p.y;
    }
    const anchor: Pt = { x: sumX / largest.length, y: sumY / largest.length };

    const widthPx = maxX - minX;
    const heightPx = maxY - minY;

    const acresText = ownerAcresText(Number(feature.props.acres) || 0);
    const lines = acresText ? [owner, acresText] : [owner];

    const fontPx = fitLabelFontPx(
      widthPx,
      heightPx,
      owner,
      acresText,
      LABEL_MIN_PX,
      LABEL_MAX_PX,
    );
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

    return [{ anchor, bboxes, draw }];
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
