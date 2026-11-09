// Pure view helpers for the terrain-aware Movement layer (DeerRoutePlan →
// lines, arrows, funnel cards, panel rows). No React, no Leaflet, so the
// on-map wording and styling rules are unit-tested in node.

import type {
  DeerRoute,
  DeerRoutePlan,
  LatLng,
  RouteFunnel,
  StandRouteFit,
} from "@/lib/movementGridTypes";
import type { MovementCorridor, MovementPeriod } from "@/lib/movementPrediction";
import type { SitPeriodKey } from "@/lib/todayVerdict";
import { compassToDegrees } from "@/lib/compass";
import { trustedPhotoDate } from "@/lib/photoDateTime";

/** Deer heading back to bed at dawn, out to food at dusk; no pull otherwise. */
export type RouteTravel = "to-bed" | "to-food" | null;

export function routeTravel(period: MovementPeriod): RouteTravel {
  if (period === "dawn") return "to-bed";
  if (period === "dusk") return "to-food";
  return null;
}

/** The route's path in the direction deer walk it now (paths are bed → food). */
export function orientedPath(path: LatLng[], travel: RouteTravel): LatLng[] {
  return travel === "to-bed" ? [...path].reverse() : path;
}

export const ROUTE_COLOR = "#a855f7";
export const ROUTE_CAMERA_COLOR = "#d8b4fe";
export const FUNNEL_COLOR = "#ff7a2f";
/** Below this strength a route draws dashed: a guess, not a trail. */
export const WEAK_ROUTE_STRENGTH = 0.35;

export function routeStyle(
  strength: number,
  cameraBacked: boolean,
): { color: string; weight: number; opacity: number; dashArray?: string } {
  const s = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
  const weight = 2 + s * 4 + (cameraBacked ? 1 : 0);
  const opacity = cameraBacked ? Math.max(0.92, 0.45 + s * 0.45) : 0.45 + s * 0.45;
  return {
    color: cameraBacked ? ROUTE_CAMERA_COLOR : ROUTE_COLOR,
    weight: Math.round(weight * 10) / 10,
    opacity: Math.round(opacity * 100) / 100,
    dashArray: s < WEAK_ROUTE_STRENGTH ? "4 7" : undefined,
  };
}

/**
 * Chaikin corner-cutting: grid paths come back as stair-steps, this rounds
 * them into a walkable-looking line while keeping both endpoints fixed.
 */
export function smoothPath(path: LatLng[], iterations = 2): LatLng[] {
  let points = path;
  for (let pass = 0; pass < iterations && points.length > 2; pass += 1) {
    const next: LatLng[] = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      next.push(
        { lat: a.lat * 0.75 + b.lat * 0.25, lng: a.lng * 0.75 + b.lng * 0.25 },
        { lat: a.lat * 0.25 + b.lat * 0.75, lng: a.lng * 0.25 + b.lng * 0.75 },
      );
    }
    next.push(points[points.length - 1]);
    points = next;
  }
  return points;
}

const M_PER_DEG_LAT = 111_320;

function segmentMeters(a: LatLng, b: LatLng): number {
  const cos = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
  const dx = (b.lng - a.lng) * M_PER_DEG_LAT * cos;
  return Math.hypot(dx, dy);
}

/** Compass bearing a → b in degrees (0 = north, 90 = east). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const cos = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = b.lat - a.lat;
  const dx = (b.lng - a.lng) * cos;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Arrowheads along an (already oriented) path: one per ~200 m, 1–4 of them,
 * evenly spaced, each pointing the way deer walk at that spot.
 */
export function arrowMarks(
  path: LatLng[],
  spacingM = 200,
): Array<{ point: LatLng; bearing: number }> {
  if (path.length < 2) return [];
  const cumulative = [0];
  for (let i = 1; i < path.length; i += 1) {
    cumulative.push(cumulative[i - 1] + segmentMeters(path[i - 1], path[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return [];
  const count = Math.max(1, Math.min(4, Math.round(total / spacingM)));
  const marks: Array<{ point: LatLng; bearing: number }> = [];
  let seg = 1;
  for (let k = 0; k < count; k += 1) {
    const target = ((k + 0.5) / count) * total;
    while (seg < cumulative.length - 1 && cumulative[seg] < target) seg += 1;
    const a = path[seg - 1];
    const b = path[seg];
    const span = cumulative[seg] - cumulative[seg - 1];
    const t = span > 0 ? (target - cumulative[seg - 1]) / span : 0;
    marks.push({
      point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
      bearing: bearingDeg(a, b),
    });
  }
  return marks;
}

/** The point halfway along a path, by distance (camera tick placement). */
export function pathMidpoint(path: LatLng[]): LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  return arrowMarks(path, Number.POSITIVE_INFINITY)[0]?.point ?? path[0];
}

/** Ring radius (px) for a funnel: bigger the more routes squeeze through it. */
export function funnelRadius(routeCount: number): number {
  return 7 + 2 * Math.max(1, Math.min(routeCount, 6));
}

export function funnelHeadline(funnel: Pick<RouteFunnel, "feature" | "routeCount">): string {
  const parts = ["Funnel"];
  if (funnel.feature.trim()) parts.push(funnel.feature.trim());
  parts.push(`${funnel.routeCount} ${funnel.routeCount === 1 ? "route" : "routes"}`);
  return parts.join(" · ");
}

/** "✓ Scent blows away" / "✕ NW wind blows scent onto the trail". */
export function windLine(wind: { ok: boolean; note: string } | undefined): string | null {
  if (!wind) return null;
  const note = wind.note.trim();
  if (wind.ok) return `✓ ${note || "Scent blows away"}`;
  return `✕ ${note || "Wind blows scent onto the trail"}`;
}

export function nearestStandLine(funnel: Pick<RouteFunnel, "nearestStand">): string {
  const stand = funnel.nearestStand;
  if (!stand) return "No stand within 300 yd";
  return `Nearest stand: ${stand.name} · ${Math.round(stand.yards)} yd`;
}

/** "Oak Flat · 40 yd from 2 routes · wind ✓". */
export function standFitLine(fit: StandRouteFit): string {
  const n = fit.routeIds.length;
  const parts = [
    fit.standName || "Stand",
    n > 0
      ? `${Math.round(fit.yardsToRoute)} yd from ${n} ${n === 1 ? "route" : "routes"}`
      : `${Math.round(fit.yardsToRoute)} yd to nearest route`,
  ];
  if (fit.wind) parts.push(`wind ${fit.wind.ok ? "✓" : "✕"}`);
  return parts.join(" · ");
}

export function topFunnels(funnels: RouteFunnel[], count = 3): RouteFunnel[] {
  return [...funnels]
    .sort((a, b) => b.score - a.score || b.routeCount - a.routeCount)
    .slice(0, count);
}

/** Stands closest to the routes first. */
export function rankedStandFits(stands: StandRouteFit[]): StandRouteFit[] {
  return [...stands].sort((a, b) => a.yardsToRoute - b.yardsToRoute);
}

/** The plan's routes in the old straight-line corridor shape (DeerHeatLayer). */
export function routesAsCorridors(routes: DeerRoute[]): MovementCorridor[] {
  return routes.map((route) => ({
    id: route.id,
    bedding: route.from.point,
    resource: route.to.point,
    resourceKind: route.to.kind,
    distanceM: route.lengthM,
    strength: route.strength,
  }));
}

export function planIsEmpty(plan: DeerRoutePlan | null): boolean {
  return !plan || (plan.routes.length === 0 && plan.funnels.length === 0);
}

/** The next sit's wind (verdict compass + sit) as the route planner wants it. */
export function sitWindFor(
  windCompass: string | undefined,
  period: SitPeriodKey,
): { fromDeg: number; label: string; period: "AM" | "PM" } | undefined {
  if (!windCompass) return undefined;
  const fromDeg = compassToDegrees(windCompass);
  if (fromDeg === null) return undefined;
  return {
    fromDeg,
    label: windCompass.trim().toUpperCase(),
    period: period === "evening" ? "PM" : "AM",
  };
}

type CameraLike = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
};

type PhotoLike = {
  cameraSiteId: string;
  photoDate: string;
  species: string;
  buckName?: string;
  deerProfileId?: string;
  captureTimeSource?: Parameters<typeof trustedPhotoDate>[0]["captureTimeSource"];
};

function isDeerPhoto(photo: PhotoLike): boolean {
  if (photo.buckName?.trim() || photo.deerProfileId) return true;
  const species = (photo.species ?? "").toLowerCase();
  return ["deer", "buck", "doe", "fawn"].some((term) => species.includes(term));
}

/** Aug 1 of the current hunting season (Jan–Jul belongs to last fall's). */
export function seasonStart(now: Date): Date {
  const year = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear();
  return new Date(year, 7, 1);
}

/**
 * Located cameras with this season's deer photos split AM / PM by capture
 * time. Date-only photos count toward `visits` but neither half.
 */
export function cameraVisits(
  cameras: CameraLike[],
  photos: PhotoLike[],
  now: Date,
): Array<{ name: string; lat: number; lng: number; visitsAM: number; visitsPM: number; visits: number }> {
  const since = seasonStart(now).getTime();
  const tally = new Map<string, { am: number; pm: number; all: number }>();
  for (const photo of photos) {
    if (!isDeerPhoto(photo)) continue;
    const raw = trustedPhotoDate(photo);
    const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
    if (Number.isNaN(time) || time < since) continue;
    const entry = tally.get(photo.cameraSiteId) ?? { am: 0, pm: 0, all: 0 };
    entry.all += 1;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      if (new Date(time).getHours() < 12) entry.am += 1;
      else entry.pm += 1;
    }
    tally.set(photo.cameraSiteId, entry);
  }

  return cameras
    .filter(
      (camera) =>
        typeof camera.latitude === "number" &&
        typeof camera.longitude === "number" &&
        Number.isFinite(camera.latitude) &&
        Number.isFinite(camera.longitude),
    )
    .map((camera) => {
      const entry = tally.get(camera.id) ?? { am: 0, pm: 0, all: 0 };
      return {
        name: camera.name,
        lat: camera.latitude as number,
        lng: camera.longitude as number,
        visitsAM: entry.am,
        visitsPM: entry.pm,
        visits: entry.all,
      };
    });
}

/** The fixed Food pin kinds a hunter can tag (MapPin.foodKind). */
export const FOOD_KINDS = [
  "White oak acorns",
  "Red oak acorns",
  "Apples/soft mast",
  "Food plot",
  "Ag field",
  "Browse/cutover",
] as const;

export function isFoodPinType(type: string): boolean {
  return type === "Food" || type === "Food Source";
}
