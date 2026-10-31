// Pure geometry helpers for the statewide parcel vector tiles
// (components/map/ParcelTilesLayer.tsx): turning a feature's tile-space
// geometry into a map position, and cheap "is this near that" checks used to
// keep owner-name tags and "your land" from colouring every same-named owner
// statewide. No Leaflet or DOM here, so it can be unit tested.

export type TilePt = { x: number; y: number };
export type GeoPoint = { lat: number; lng: number };
export type TileCoord = { z: number; x: number; y: number };
export type GeoBounds = { south: number; west: number; north: number; east: number };

/** How far from a tag's saved spot (or a hunt area) its colouring reaches. */
export const OWNER_NEAR_KM = 5;

const KM_PER_DEG_LAT = 111.32;

/** Fast equirectangular distance — plenty accurate over a few km. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (a.lat - b.lat) * KM_PER_DEG_LAT;
  const dLng = (a.lng - b.lng) * KM_PER_DEG_LAT * Math.cos(midLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** True when `point` lies within `km` of `bounds` (inside counts as 0). */
export function nearBounds(point: GeoPoint, bounds: GeoBounds, km: number): boolean {
  const lat = Math.max(bounds.south, Math.min(bounds.north, point.lat));
  const lng = Math.max(bounds.west, Math.min(bounds.east, point.lng));
  return distanceKm(point, { lat, lng }) <= km;
}

/** Bounding box of a lat/lng ring, or null for an empty ring. */
export function boundsOfRing(ring: GeoPoint[]): GeoBounds | null {
  if (!ring.length) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of ring) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}

/**
 * A protomaps tile-cache key ("x:y:z" in protomaps-leaflet; "z:x:y" also
 * accepted) parsed into a tile coordinate. Parcel tiles live at z12+, where x
 * and y over Pennsylvania are in the thousands, so the zoom is the one part
 * that is small; x stays before y in either order.
 */
export function parseTileKey(key: string): TileCoord | null {
  const parts = key.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const [a, b, c] = parts;
  if (c <= 24 && c < a && c < b) return { z: c, x: a, y: b };
  if (a <= 24 && a < b && a < c) return { z: a, x: b, y: c };
  return null;
}

/** A tile-space pixel (tileSize px per tile) at a tile, as a map position. */
export function tilePixelToLatLng(tile: TileCoord, tileSize: number, pt: TilePt): GeoPoint {
  const n = 2 ** tile.z;
  const worldX = (tile.x + pt.x / tileSize) / n;
  const worldY = (tile.y + pt.y / tileSize) / n;
  const lng = worldX * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180) / Math.PI;
  return { lat, lng };
}

/** Geographic bounds of one tile. */
export function tileBounds(tile: TileCoord): GeoBounds {
  const nw = tilePixelToLatLng(tile, 1, { x: 0, y: 0 });
  const se = tilePixelToLatLng(tile, 1, { x: 1, y: 1 });
  return { north: nw.lat, west: nw.lng, south: se.lat, east: se.lng };
}

export function boundsIntersect(a: GeoBounds, b: GeoBounds): boolean {
  return a.west <= b.east && b.west <= a.east && a.south <= b.north && b.south <= a.north;
}

/** Centre of a geometry's bounding box (cheap; may sit outside an odd shape). */
export function geomBoxCenter(geom: TilePt[][]): TilePt | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of geom) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (minX === Infinity) return undefined;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function pointInTileRing(point: TilePt, ring: TilePt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A point inside a polygon's largest ring: its area centroid when that falls
 * inside, otherwise the middle of the first span a horizontal line through the
 * ring's middle cuts (always inside for a simple ring, e.g. an L-shaped lot).
 * Points and lines fall back to their first vertex.
 */
export function geomInteriorPoint(geom: TilePt[][]): TilePt | undefined {
  let best: TilePt[] | undefined;
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
  if (!best || best.length < 3) return geom[0]?.[0];

  let cx = 0;
  let cy = 0;
  let a2 = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < best.length; i++) {
    const p = best[i];
    const q = best[(i + 1) % best.length];
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (a2 !== 0) {
    const centroid = { x: cx / (3 * a2), y: cy / (3 * a2) };
    if (pointInTileRing(centroid, best)) return centroid;
  }

  const y = (minY + maxY) / 2;
  const xs: number[] = [];
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const a = best[i];
    const b = best[j];
    if (a.y > y !== b.y > y) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
  }
  xs.sort((p, q) => p - q);
  if (xs.length >= 2) return { x: (xs[0] + xs[1]) / 2, y };
  return best[0];
}

/**
 * Sort rank for "smallest parcel wins" when taps hit overlapping parcels: a
 * missing or zero acreage is unknown, not tiny, so it never beats a parcel
 * whose acreage is published.
 */
export function parcelAcresRank(acres: number): number {
  return Number.isFinite(acres) && acres > 0 ? acres : Infinity;
}
