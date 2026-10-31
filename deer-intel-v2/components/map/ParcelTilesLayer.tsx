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
import { PMTiles } from "pmtiles";
import { isPublicOwnerName, ownerAcresText, ownerDisplayName } from "@/lib/ownerLabel";
import { landTagKey, type LandTagKind } from "@/lib/landTags";
import {
  OWNER_NEAR_KM,
  boundsIntersect,
  boundsOfRing,
  distanceKm,
  geomBoxCenter,
  geomInteriorPoint,
  nearBounds,
  parcelAcresRank,
  parseTileKey,
  pointInTileRing,
  tileBounds,
  tilePixelToLatLng,
  type GeoBounds,
  type GeoPoint,
  type TileCoord,
} from "@/lib/parcelTileMath";
import {
  matchOfflineVectorTile,
  useOfflineMapPacks,
  type OfflineTileSource,
} from "@/lib/offlineMaps";

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

// Deepest zoom the archive has real tiles for; deeper zooms overzoom it.
export const PARCEL_TILES_MAX_DATA_ZOOM = 15;

// What an offline map pack saves of this layer: the archive's decoded vector
// tiles over the pack area, z12–15 (see lib/offlineMaps).
export const PARCEL_OFFLINE_SOURCE: OfflineTileSource = {
  kind: "pmtiles",
  url: PMTILES_URL,
  minNativeZoom: PARCEL_TILES_MIN_ZOOM,
  maxNativeZoom: PARCEL_TILES_MAX_DATA_ZOOM,
};

// Offline-first archive reader, used only once a pack has saved parcel tiles.
// A saved tile is returned straight from Cache Storage — no header/directory
// range reads, so it works with no signal — and anything not saved falls
// through to the normal range-request read from R2.
class OfflineFirstPMTiles extends PMTiles {
  constructor(url: string) {
    super(url);
  }

  async getZxy(
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<PMTiles["getZxy"]>>> {
    const saved = await matchOfflineVectorTile(PMTILES_URL, z, x, y);
    // An empty saved tile means the archive has no parcels there.
    if (saved) return saved.byteLength > 0 ? { data: saved } : undefined;
    return super.getZxy(z, x, y, signal);
  }
}

// Every other tile overlay on this map sets an explicit zIndex inside the
// tilePane — base imagery 650+, land cover 660, water 670, slope 690, contours
// 695 — but Leaflet's GridLayer defaults to zIndex 1. Without this the parcel
// canvas is painted UNDER the satellite imagery and the always-on water layer,
// so boundaries and owner names are invisible while tapping still works (the
// pick queries loaded tile data, not pixels) — which is exactly how the bug
// presented. Sits at the top of the raster stack; the app's own vector layers
// and pins live in overlayPane/markerPane, which are above tilePane entirely.
const PARCEL_TILES_Z_INDEX = 700;

// Labels track the parcel layer itself rather than waiting for a zoom of their
// own: whether a name shows is decided by whether it fits inside its parcel, so
// the big tracts get named as soon as parcels are drawn at all and the smaller
// ones fill in as you zoom. (protomaps' labeler also drops overlapping labels.)
const LABEL_MIN_ZOOM = PARCEL_TILES_MIN_ZOOM;

// Boundaries and tap-to-identify work from PARCEL_TILES_MIN_ZOOM, but names
// only start here — worth telling the hunter apart, since "I see lines but no
// names" and "I see nothing" have different fixes.
export const PARCEL_LABEL_MIN_ZOOM = LABEL_MIN_ZOOM;

// Spartan-Forge-style labels: owner in CAPS with the acreage beneath, placed
// once per holding. Styling (type, colours, tags) lives with the symbolizer.
// A thin dark edge under every glyph; the soft shadow does the rest.
const OWNER_LABEL_EDGE = "rgba(0, 0, 0, 0.55)";
const OWNER_LABEL_EDGE_PX = 2;

// Don't wrap a name into more lines than this — beyond it the block is too tall
// to sit cleanly in a parcel, so the label is gated out until you zoom in.
const OWNER_NAME_MAX_LINES = 3;

// One owner's holding is usually several adjacent tax parcels (and a single big
// parcel gets clipped into a separate feature per vector tile), so the same name
// would otherwise print once per piece — cluttered and confusing. Tag each label
// with the owner name so protomaps' labeler drops a repeat of the same owner
// within a radius, collapsing a holding to a single name.

const OWNER_LABEL_DEDUP_MIN_PX = 600;

// Every parcel with an owner is a label candidate; whether it actually gets one
// is decided geometrically in the symbolizer, by whether the name fits inside
// the parcel on screen.
//
// This used to gate on acreage (>=4 ac at z15, >=1 at z16), which was wrong on
// both ends: it hid parcels that would have fit their name perfectly well, and
// because a missing acreage reads as 0, it hid every parcel whose county
// publishes no acreage at all — 53 of 93 features in view at Moore Hill, STATE
// GAME LANDS among them, each of which named itself instantly when tapped.
// Fit doesn't care how good a county's attribute data is.
function hasOwnerName(feature: { props: Record<string, unknown> }) {
  return String(feature.props.owner ?? "").trim().length > 0;
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

// Width a holding name wraps to. The point layer carries no polygon, so there
// is nothing to measure against — but the zoom at which the name fits its
// ground was already decided at build time (the baked `mz`), so this only has
// to keep long names to a tidy block rather than one long streak.
const HOLDING_LABEL_WRAP_PX = 150;

// What a label needs to know about you: your tags, the owners whose land sits
// under your drawn hunt areas, and the owner whose card is open. Read when a
// tile's labels are laid out, so changing any of it re-lays the labels.
//
// Tags and "mine" follow an owner NAME (the tiles carry no parcel id), so
// `near` limits them to parcels close to where they belong — the tag's saved
// spot, or your hunt areas — or tagging one "SMITH JOHN" would colour every
// John Smith in the state.
export type LabelStyleState = {
  tags: Record<string, LandTagKind>;
  mine: Set<string>;
  selected: string;
  near: (feature: Feature, key: string, what: "tag" | "mine") => boolean;
};

const NEAR_ANYWHERE: LabelStyleState["near"] = () => true;

/** Your tag on this parcel, if it's tagged and near where you tagged it. */
function tagOfFeature(feature: Feature, state: LabelStyleState): LandTagKind | undefined {
  const key = landTagKey(String(feature.props.owner ?? ""));
  const tag = key ? state.tags[key] : undefined;
  return tag && state.near(feature, key, "tag") ? tag : undefined;
}

/** Whether this parcel is the land under (or right by) your hunt areas. */
function isMineFeature(feature: Feature, state: LabelStyleState): boolean {
  const key = landTagKey(String(feature.props.owner ?? ""));
  return Boolean(key) && state.mine.has(key) && state.near(feature, key, "mine");
}

type LabelRole = LandTagKind | "mine" | "public" | "selected" | "plain";

// Name colour and the small tag line under the acres, per role. Untagged
// owners stay white so the colours only ever mean "this is about you".
const ROLE_STYLE: Record<LabelRole, { color: string; tag: string }> = {
  mine: { color: "#ff7a2e", tag: "YOUR PROPERTY" },
  permission: { color: "#b9c79a", tag: "PERMISSION" },
  neighbor: { color: "#c9ccc2", tag: "NEIGHBOR" },
  public: { color: "#9cc47f", tag: "PUBLIC" },
  selected: { color: "#ffffff", tag: "" },
  plain: { color: "#ffffff", tag: "" },
};

// Tactical label type: owner names in the app's display face (Bebas Neue —
// narrow caps, so long names take less room), acres and tags in Geist Mono.
// next/font hashes the family names, so the real ones are read from the CSS
// variables once the page is up; until then the fallbacks stand in.
export const labelFonts = {
  display: '"Bebas Neue", "Arial Narrow", sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
};

const NAME_PX = 17;
const NAME_SELECTED_PX = 21;
const ACRES_PX = 9.5;
const TAG_PX = 8.5;
const LINE = { name: 1.0, small: 1.45 };

function roleOf(feature: Feature, state: LabelStyleState): LabelRole {
  const key = landTagKey(String(feature.props.owner ?? ""));
  if (state.selected && key === state.selected) return "selected";
  if (isMineFeature(feature, state)) return "mine";
  const tag = tagOfFeature(feature, state);
  if (tag) return tag;
  if (feature.props.pub === 1) return "public";
  return "plain";
}

// Labels for the baked holding points: one per owner holding, at an anchor
// computed over whole parcels at build time. Nothing here depends on polygon
// geometry, which is the entire point — a tile clips polygons at its seams, so
// any centre derived from what's in a tile shifts as the tiles change under it.
class HoldingLabelSymbolizer {
  private readonly getState: () => LabelStyleState;
  private readonly anchorOf: (geom: Pt[][]) => Pt | undefined;
  private readonly dedupPx: number;

  constructor(
    getState: () => LabelStyleState,
    anchorOf: (geom: Pt[][]) => Pt | undefined = (geom) => geom[0]?.[0],
    dedupPx = OWNER_LABEL_DEDUP_MIN_PX,
  ) {
    this.getState = getState;
    this.anchorOf = anchorOf;
    this.dedupPx = dedupPx;
  }

  place(layout: Layout, geom: Pt[][], feature: Feature) {
    const rawOwner = String(feature.props.owner ?? "").trim();
    if (!rawOwner) return undefined;
    const owner = ownerDisplayName(rawOwner);

    const anchor = this.anchorOf(geom);
    if (!anchor) return undefined;

    const role = roleOf(feature, this.getState());
    const { color, tag } = ROLE_STYLE[role];
    const namePx = role === "selected" ? NAME_SELECTED_PX : NAME_PX;
    const acresText = ownerAcresText(Number(feature.props.acres) || 0).toUpperCase();

    const nameFont = `400 ${namePx}px ${labelFonts.display}`;
    const smallFont = (px: number) => `400 ${px}px ${labelFonts.mono}`;
    const nameTracking = `${(namePx * 0.05).toFixed(2)}px`;
    const smallTracking = "0.8px";

    const lines: LabelLine[] = [];
    layout.scratch.font = nameFont;
    layout.scratch.letterSpacing = nameTracking;
    for (const line of wrapWords(layout.scratch, owner, HOLDING_LABEL_WRAP_PX, OWNER_NAME_MAX_LINES)) {
      lines.push({
        text: line,
        font: nameFont,
        tracking: nameTracking,
        color,
        height: namePx * LINE.name,
        width: layout.scratch.measureText(line).width,
      });
    }
    const addSmall = (text: string, px: number, lineColor: string) => {
      const font = smallFont(px);
      layout.scratch.font = font;
      layout.scratch.letterSpacing = smallTracking;
      lines.push({
        text,
        font,
        tracking: smallTracking,
        color: lineColor,
        height: px * LINE.small,
        width: layout.scratch.measureText(text).width,
      });
    };
    if (acresText) {
      addSmall(acresText, ACRES_PX, role === "selected" ? "#ffffff" : "rgba(255, 255, 255, 0.85)");
    }
    if (tag) addSmall(`■ ${tag}`, TAG_PX, color);

    const textWidth = Math.max(...lines.map((line) => line.width));
    const textHeight = lines.reduce((sum, line) => sum + line.height, 0) + 2;

    return [
      {
        anchor,
        bboxes: [
          {
            minX: anchor.x - textWidth / 2,
            minY: anchor.y - textHeight / 2,
            maxX: anchor.x + textWidth / 2,
            maxY: anchor.y + textHeight / 2,
          },
        ],
        draw: makeLabelDraw(lines, textHeight),
        deduplicationKey: landTagKey(rawOwner),
        deduplicationDistance: this.dedupPx,
      },
    ];
  }
}

/** True for owners whose names must always show: yours, tagged, or open. */
function isPriorityOwner(feature: Feature, state: LabelStyleState): boolean {
  const key = landTagKey(String(feature.props.owner ?? ""));
  if (!key) return false;
  return (
    key === state.selected ||
    isMineFeature(feature, state) ||
    Boolean(tagOfFeature(feature, state))
  );
}

// A label spot inside one parcel piece, for priority owners when the
// holding's own label point is off screen. Uses the biggest ring's area
// centroid (its vertex average when the centroid falls outside, as on an
// L-shaped lot); pieces too small to read on screen get none.
function pieceAnchor(geom: Pt[][]): Pt | undefined {
  let best: Pt[] | undefined;
  let bestArea = 0;
  for (const ring of geom) {
    let a2 = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      a2 += p.x * q.y - q.x * p.y;
    }
    if (Math.abs(a2) > bestArea) {
      bestArea = Math.abs(a2);
      best = ring;
    }
  }
  if (!best || best.length < 3) return undefined;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;
  let a2 = 0;
  for (let i = 0; i < best.length; i++) {
    const p = best[i];
    const q = best[(i + 1) % best.length];
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (maxX - minX < 40 || maxY - minY < 24 || a2 === 0) return undefined;
  const centroid = { x: cx / (3 * a2), y: cy / (3 * a2) };
  if (pointInTileRing(centroid, best)) return centroid;
  const avg = best.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
  const fallback = { x: avg.x / best.length, y: avg.y / best.length };
  return pointInTileRing(fallback, best) ? fallback : undefined;
}

type LabelLine = {
  text: string;
  font: string;
  tracking: string;
  color: string;
  height: number;
  width: number;
};

// Lettering sits straight on aerial imagery, which runs from near-black timber
// to sunlit stubble and snow. A thin dark edge plus a soft shadow keeps it
// readable on all of it without the heavy "stamped on" outline.
function makeLabelDraw(lines: LabelLine[], textHeight: number) {
  return (ctx: CanvasRenderingContext2D) => {
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    let y = -textHeight / 2 + 1;
    for (const line of lines) {
      const baseline = y + line.height / 2;
      ctx.font = line.font;
      ctx.letterSpacing = line.tracking;
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = OWNER_LABEL_EDGE;
      ctx.lineWidth = OWNER_LABEL_EDGE_PX;
      ctx.strokeText(line.text, 0, baseline);
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 4 * dpr;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 0, baseline);
      y += line.height;
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  };
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
  /** Owner names you've tagged (keyed by landTagKey) → how to color them. */
  ownerTags?: Record<string, LandTagKind>;
  /**
   * Where each tag was saved (keyed like ownerTags). A tag only colours
   * parcels within OWNER_NEAR_KM of its spot, so one tagged "SMITH JOHN"
   * doesn't mark every John Smith statewide. A tag with no spot colours all.
   */
  ownerTagPoints?: Record<string, GeoPoint>;
  /** Owner of the parcel whose card is open, drawn with a bright outline. */
  selectedOwner?: string | null;
  /** Receives a search over the parcels loaded in the current view. */
  onSearchReady?: (search: ((query: string) => ParcelTileOwnerHit[]) | null) => void;
  /** Your drawn hunt areas: owners of the land under them get orange names. */
  ownedAreas?: Array<Array<{ lat: number; lng: number }>>;
};

type LatLngPoint = { lat: number; lng: number };

function insideArea(point: LatLngPoint, ring: LatLngPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Sample points spread through a hunt area, for finding whose land it covers.
function samplePoints(ring: LatLngPoint[], perSide = 7): LatLngPoint[] {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of ring) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const points: LatLngPoint[] = [];
  for (let row = 0; row < perSide; row += 1) {
    for (let col = 0; col < perSide; col += 1) {
      const point = {
        lat: minLat + ((row + 0.5) / perSide) * (maxLat - minLat),
        lng: minLng + ((col + 0.5) / perSide) * (maxLng - minLng),
      };
      if (insideArea(point, ring)) points.push(point);
    }
  }
  return points;
}

// protomaps-leaflet keeps each view's decoded tiles in a cache it doesn't
// type publicly: layer.views → view.tileCache → cache (Map keyed "x:y:z" →
// { data: Map<layerName, Feature[]> }), parsed at tileCache.tileSize px per
// tile. Read defensively — if a release reshapes it, callers fall back.
type CachedTileLike = { data?: unknown };
type TileCacheLike = { cache?: unknown; tileSize?: unknown };

function forEachCachedTile(
  layer: unknown,
  visit: (tile: TileCoord, tileSize: number, data: Map<string, Feature[]>) => void,
): boolean {
  const views = (layer as { views?: unknown } | null)?.views;
  if (!(views instanceof Map)) return false;
  let reached = false;
  for (const view of views.values()) {
    const tileCache = (view as { tileCache?: TileCacheLike } | null)?.tileCache;
    const cache = tileCache?.cache;
    if (!(cache instanceof Map)) continue;
    reached = true;
    const tileSize =
      typeof tileCache?.tileSize === "number" && tileCache.tileSize > 0 ? tileCache.tileSize : 512;
    for (const [key, entry] of cache.entries()) {
      const data = (entry as CachedTileLike | null)?.data;
      if (typeof key !== "string" || !(data instanceof Map)) continue;
      const tile = parseTileKey(key);
      if (tile) visit(tile, tileSize, data as Map<string, Feature[]>);
    }
  }
  return reached;
}

// next/font serves its faces under hashed family names; read the real ones
// from the CSS variables the root layout sets, then wait for them to load so
// labels aren't measured in a fallback face.
async function loadLabelFonts(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue("--font-display").trim();
  const mono = css.getPropertyValue("--font-geist-mono").trim();
  if (display) labelFonts.display = display;
  if (mono) labelFonts.mono = mono;
  try {
    await Promise.all([
      document.fonts.load(`400 17px ${labelFonts.display}`, "MOORE HILL"),
      document.fonts.load(`400 10px ${labelFonts.mono}`, "84.2 ACRES"),
    ]);
  } catch {
    // A face that won't load just leaves the fallback in place.
  }
  return true;
}

/** One owner found by searching the parcels already loaded on screen. */
export type ParcelTileOwnerHit = {
  ownerName: string;
  acres: number;
  isPublic: boolean;
  lat: number;
  lng: number;
};

export default function ParcelTilesLayer({
  enabled,
  pickEnabled = false,
  onOwnerPick,
  ownerTags,
  ownerTagPoints,
  selectedOwner,
  onSearchReady,
  ownedAreas,
}: ParcelTilesLayerProps) {
  const map = useMap();
  // Only switch to the offline-first reader once a saved pack holds parcel
  // tiles; with none saved, the layer streams from R2 exactly as before.
  const offlinePacks = useOfflineMapPacks();
  const hasOfflineParcels = offlinePacks.some((pack) =>
    pack.sources.some((source) => source.kind === "pmtiles" && source.url === PMTILES_URL),
  );

  // Paint and label rules read tags, your land and the selection through a
  // ref, so tagging a parcel re-lays the labels instead of rebuilding the layer.
  const styleRef = useRef<LabelStyleState>({
    tags: ownerTags ?? {},
    mine: new Set(),
    selected: selectedOwner ? landTagKey(selectedOwner) : "",
    near: NEAR_ANYWHERE,
  });
  const layerRef = useRef<{ refresh: () => void; findMine: () => void } | null>(null);
  const tagPointsRef = useRef<Record<string, GeoPoint>>({});
  const tagSignature = JSON.stringify([ownerTags ?? {}, ownerTagPoints ?? {}]);
  const selectedKey = selectedOwner ? landTagKey(selectedOwner) : "";
  useEffect(() => {
    const points: Record<string, GeoPoint> = {};
    for (const [key, at] of Object.entries(ownerTagPoints ?? {})) {
      if (Number.isFinite(at?.lat) && Number.isFinite(at?.lng)) points[key] = at;
    }
    tagPointsRef.current = points;
    styleRef.current = { ...styleRef.current, tags: ownerTags ?? {}, selected: selectedKey };
    layerRef.current?.refresh();
    // tagSignature stands in for ownerTags so a new-but-equal object doesn't repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagSignature, selectedKey]);
  const areasRef = useRef(ownedAreas ?? []);
  const areaBoundsRef = useRef<GeoBounds[]>([]);
  const areasSignature = JSON.stringify(ownedAreas ?? []);
  useEffect(() => {
    areasRef.current = ownedAreas ?? [];
    areaBoundsRef.current = (ownedAreas ?? [])
      .filter((area) => area.length >= 3)
      .map(boundsOfRing)
      .filter((bounds): bounds is GeoBounds => bounds !== null);
    styleRef.current = { ...styleRef.current, mine: new Set() };
    layerRef.current?.findMine();
    // areasSignature stands in for ownedAreas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasSignature]);
  const searchReadyRef = useRef(onSearchReady);
  useEffect(() => {
    searchReadyRef.current = onSearchReady;
  });

  // The click handler reads these through a ref so toggling pick mode (e.g.
  // while placing a pin) doesn't tear down and re-create the tile layer.
  const pickRef = useRef({ pickEnabled, onOwnerPick });
  useEffect(() => {
    pickRef.current = { pickEnabled, onOwnerPick };
  });

  useEffect(() => {
    if (!enabled) return;

    const ownerKeyOf = (feature: { props: Record<string, unknown> }) =>
      landTagKey(String(feature.props.owner ?? ""));
    const tagOf = (feature: Feature) => tagOfFeature(feature, styleRef.current);

    const layer = leafletLayer({
      url: hasOfflineParcels ? new OfflineFirstPMTiles(PMTILES_URL) : PMTILES_URL,
      zIndex: PARCEL_TILES_Z_INDEX,
      // Tiles top out at z15; keep drawing them (overzoomed) past that.
      maxDataZoom: PARCEL_TILES_MAX_DATA_ZOOM,
      paintRules: [
        // Public / government land gets a translucent green fill.
        {
          dataLayer: "parcels",
          symbolizer: new PolygonSymbolizer({
            fill: "#5f8c46",
            opacity: 0.32,
          }),
          filter: (_z, f) => f.props.pub === 1,
        },
        // Land you have permission to hunt: a soft olive fill.
        {
          dataLayer: "parcels",
          symbolizer: new PolygonSymbolizer({
            fill: "#6b7a4f",
            opacity: 0.28,
          }),
          filter: (_z, f) => tagOf(f) === "permission",
        },
        // Boundaries are drawn twice: a dark casing, then the bright line on
        // top of it. A single light hairline is the amateur tell — it holds up
        // over timber and then dissolves into pale stubble, snow or a gravel
        // pit. The casing gives every boundary its own contrast so the line
        // reads the same over anything the imagery does, which is what OnX and
        // Spartan are actually doing when their parcel lines look "crisp".
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "rgba(17, 24, 39, 0.55)",
            width: 2.4,
          }),
        },
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#ffffff",
            width: 1.1,
            opacity: 0.95,
          }),
        },
        // Tagged land and the parcel you tapped sit on top of the plain lines.
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#a9b88a",
            width: 2.6,
          }),
          filter: (_z, f) => tagOf(f) === "permission",
        },
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#c9ccc2",
            width: 2.2,
            opacity: 0.9,
          }),
          filter: (_z, f) => tagOf(f) === "neighbor",
        },
        {
          dataLayer: "parcels",
          symbolizer: new LineSymbolizer({
            color: "#ffffff",
            width: 3.4,
          }),
          filter: (_z, f) => {
            const selected = styleRef.current.selected;
            return Boolean(selected) && ownerKeyOf(f) === selected;
          },
        },
      ],
      // Rule order is priority: a label from an earlier rule bumps any
      // later-rule label it collides with. So your land, tagged land and the
      // parcel whose card is open are laid out first and always win over a
      // neighbor's name.
      labelRules: [
        // 1. Priority owners at their holding point, from z14 even when the
        //    baked fit zoom (`mz`) is later — it's your ground, show it.
        {
          dataLayer: "parcel_labels",
          minzoom: PARCEL_TILES_MIN_ZOOM,
          filter: (z, f) =>
            hasOwnerName(f) &&
            isPriorityOwner(f, styleRef.current) &&
            z >= Math.min(Number(f.props.mz) || PARCEL_TILES_MIN_ZOOM, 14),
          symbolizer: new HoldingLabelSymbolizer(
            () => styleRef.current,
          ) as unknown as LabelSymbolizer,
        },
        // 2. Zoomed in close, the holding point can be off screen while the
        //    land fills it — so priority owners also get a name on the parcel
        //    pieces in view (one per owner nearby, via the dedup key).
        {
          dataLayer: "parcels",
          minzoom: 15,
          filter: (_z, f) => hasOwnerName(f) && isPriorityOwner(f, styleRef.current),
          symbolizer: new HoldingLabelSymbolizer(
            () => styleRef.current,
            pieceAnchor,
            // Short reach: only skip a piece when the same name is already
            // close enough to be on screen with it.
            220,
          ) as unknown as LabelSymbolizer,
        },
        // 3. Everyone else: the baked holding points. One per owner holding,
        //    anchored over whole parcels, with the zoom it becomes legible
        //    baked in as `mz` — the name lands in the same spot at every zoom.
        {
          dataLayer: "parcel_labels",
          minzoom: PARCEL_TILES_MIN_ZOOM,
          filter: (z, f) =>
            hasOwnerName(f) &&
            !isPriorityOwner(f, styleRef.current) &&
            z >= (Number(f.props.mz) || PARCEL_TILES_MIN_ZOOM),
          sort: (a, b) => (Number(b.acres) || 0) - (Number(a.acres) || 0),
          symbolizer: new HoldingLabelSymbolizer(
            () => styleRef.current,
          ) as unknown as LabelSymbolizer,
        },
      ],
    });

    layer.addTo(map);

    // Where each loaded feature sits on the map, so tags and "your land" can be
    // limited to parcels near where they belong. Built per tile the first time
    // a filter asks about one of its features (one pass over that tile's
    // features), then a WeakMap lookup — cheap enough for every paint on a
    // phone. Features the cache can't place stay unrestricted.
    const featurePos = new WeakMap<Feature, GeoPoint>();
    const indexedTiles = new WeakSet<object>();
    // A miss is only re-scanned once the tile cache has changed, so a
    // feature the cache can't place doesn't cost a scan on every paint.
    let scannedSignature = -1;
    const cacheSignature = () => {
      let total = 0;
      const views = (layer as unknown as { views?: unknown }).views;
      if (views instanceof Map) {
        for (const view of views.values()) {
          const cache = (view as { tileCache?: TileCacheLike } | null)?.tileCache?.cache;
          if (cache instanceof Map) total += cache.size;
        }
      }
      return total;
    };
    const positionOf = (feature: Feature): GeoPoint | undefined => {
      const known = featurePos.get(feature);
      if (known) return known;
      const signature = cacheSignature();
      if (signature === scannedSignature) return undefined;
      scannedSignature = signature;
      forEachCachedTile(layer, (tile, tileSize, data) => {
        if (indexedTiles.has(data)) return;
        indexedTiles.add(data);
        for (const features of data.values()) {
          if (!Array.isArray(features)) continue;
          for (const f of features) {
            const center = f?.geom ? geomBoxCenter(f.geom) : undefined;
            if (center) featurePos.set(f, tilePixelToLatLng(tile, tileSize, center));
          }
        }
      });
      return featurePos.get(feature);
    };
    styleRef.current = {
      ...styleRef.current,
      near: (feature, key, what) => {
        const at = positionOf(feature);
        if (!at) return true;
        if (what === "tag") {
          const tagAt = tagPointsRef.current[key];
          return !tagAt || distanceKm(at, tagAt) <= OWNER_NEAR_KM;
        }
        return areaBoundsRef.current.some((bounds) => nearBounds(at, bounds, OWNER_NEAR_KM));
      },
    };

    // Re-lay every label (tags, your land or the selection changed, or the
    // label fonts finished loading) and repaint the tiles already on screen.
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      layer.clearLayout();
      layer.rerenderTiles();
    };

    // Whose land sits under your hunt areas: sample each area against the
    // loaded tiles and keep owners covering a real share of it (a sliver of a
    // neighbor's lot along the edge doesn't make it yours). Grows as more of
    // your areas come into view; never shrinks until the areas change.
    const findMine = () => {
      if (cancelled || map.getZoom() < PARCEL_TILES_MIN_ZOOM) return;
      const mine = new Set(styleRef.current.mine);
      const before = mine.size;
      const view = map.getBounds();
      for (const area of areasRef.current) {
        if (area.length < 3) continue;
        const points = samplePoints(area).filter((point) => view.contains([point.lat, point.lng]));
        if (points.length === 0) continue;
        const counts = new Map<string, number>();
        for (const point of points) {
          const seen = new Set<string>();
          for (const picks of layer.queryTileFeaturesDebug(point.lng, point.lat, 1).values()) {
            for (const pick of picks) {
              if (pick.layerName !== "parcels") continue;
              // Public land under a hunt area is still public, never "yours".
              if (pick.feature.props.pub === 1) continue;
              const owner = String(pick.feature.props.owner ?? "");
              if (isPublicOwnerName(owner)) continue;
              const key = landTagKey(owner);
              if (key) seen.add(key);
            }
          }
          for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const needed = Math.max(1, Math.ceil(points.length * 0.15));
        for (const [key, count] of counts) if (count >= needed) mine.add(key);
      }
      if (mine.size !== before) {
        styleRef.current = { ...styleRef.current, mine };
        refresh();
      }
    };
    layer.on("load", findMine);
    layerRef.current = { refresh, findMine };

    loadLabelFonts().then((changed) => {
      if (changed) refresh();
    });

    // Search the parcels already loaded around the current view by owner name.
    // The statewide archive has no owner index, so this covers what's on
    // screen (plus a margin), not the whole state. Each hit carries a point
    // inside the matching parcel — it becomes the tag's saved spot — so it
    // scans the loaded tiles' features directly rather than sampling the view.
    const searchInView = (query: string): ParcelTileOwnerHit[] => {
      const needle = query.trim().toUpperCase();
      if (needle.length < 2) return [];
      const view = map.getBounds().pad(0.25);
      const viewBounds: GeoBounds = {
        south: view.getSouth(),
        west: view.getWest(),
        north: view.getNorth(),
        east: view.getEast(),
      };
      const center = map.getCenter();
      const hits = new Map<string, ParcelTileOwnerHit>();
      const scores = new Map<string, number>();
      const consider = (feature: Feature, at: GeoPoint | undefined) => {
        const ownerName = String(feature.props.owner ?? "").trim();
        if (!at || !ownerName || !ownerName.toUpperCase().includes(needle)) return;
        const key = landTagKey(ownerName);
        const acres = Number(feature.props.acres) || 0;
        // Prefer the piece nearest the middle of the screen.
        const score = distanceKm(at, center);
        const existing = hits.get(key);
        if (existing) {
          existing.acres = Math.max(existing.acres, acres);
          if (score < (scores.get(key) ?? Infinity)) {
            existing.lat = at.lat;
            existing.lng = at.lng;
            scores.set(key, score);
          }
          return;
        }
        scores.set(key, score);
        hits.set(key, {
          ownerName,
          acres,
          isPublic: feature.props.pub === 1,
          lat: at.lat,
          lng: at.lng,
        });
      };

      const reached = forEachCachedTile(layer, (tile, tileSize, data) => {
        if (!boundsIntersect(tileBounds(tile), viewBounds)) return;
        const parcels = data.get("parcels");
        if (!Array.isArray(parcels)) return;
        for (const feature of parcels) {
          if (!feature?.geom) continue;
          const inside = geomInteriorPoint(feature.geom);
          consider(feature, inside ? tilePixelToLatLng(tile, tileSize, inside) : undefined);
        }
      });

      // Fallback if the tile cache can't be read: a dense grid of exact-point
      // picks. A tight brush means each sample really is inside its parcel.
      if (!reached) {
        const steps = 12;
        const latStep = (viewBounds.north - viewBounds.south) / steps;
        const lngStep = (viewBounds.east - viewBounds.west) / steps;
        for (let row = 0; row < steps; row += 1) {
          for (let col = 0; col < steps; col += 1) {
            const at = {
              lat: viewBounds.south + latStep * (row + 0.5),
              lng: viewBounds.west + lngStep * (col + 0.5),
            };
            for (const picks of layer.queryTileFeaturesDebug(at.lng, at.lat, 1).values()) {
              for (const pick of picks) {
                if (pick.layerName === "parcels") consider(pick.feature, at);
              }
            }
          }
        }
      }

      return [...hits.entries()]
        .sort(([a], [b]) => (scores.get(a) ?? Infinity) - (scores.get(b) ?? Infinity))
        .slice(0, 12)
        .map(([, hit]) => hit);
    };
    searchReadyRef.current?.(searchInView);

    // Tap-to-identify against the tiles already in the browser (despite the
    // "Debug" name, queryTileFeaturesDebug is the layer's public feature-picking
    // API). When parcels overlap or nest, report the smallest — that's the tiny
    // lot the tap was aimed at, not the farm surrounding it.
    const handleClick = (event: LeafletMouseEvent) => {
      const { pickEnabled: canPick, onOwnerPick: report } = pickRef.current;
      if (!canPick || !report) return;

      const { lat, lng } = event.latlng;
      const picked = layer.queryTileFeaturesDebug(lng, lat, 8);

      // A parcel with no published acreage is unknown, not tiny: it must not
      // beat an overlapping parcel whose acreage is known.
      let best: ParcelTileOwnerPick | null = null;
      let bestRank = Infinity;
      for (const picks of picked.values()) {
        for (const pick of picks) {
          if (pick.layerName !== "parcels") continue;
          const ownerName = String(pick.feature.props.owner ?? "").trim();
          if (!ownerName) continue;
          const acres = Number(pick.feature.props.acres) || 0;
          const rank = parcelAcresRank(acres);
          if (!best || rank < bestRank) {
            bestRank = rank;
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
      cancelled = true;
      map.off("click", handleClick);
      layer.off("load", findMine);
      layer.remove();
      layerRef.current = null;
      styleRef.current = { ...styleRef.current, near: NEAR_ANYWHERE };
      searchReadyRef.current?.(null);
    };
  }, [enabled, map, hasOfflineParcels]);

  return null;
}
