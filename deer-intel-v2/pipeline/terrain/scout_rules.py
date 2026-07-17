#!/usr/bin/env python3
"""Stage 2/3 — Penn State rule engine + Scout Picks.

Reads the Stage-1 rasters and turns landforms into scored predictions:
  bedding  — south-facing steep sidehills + spur points (thermal + security)
  travel   — drainage/draw centerlines
  pinch    — saddle crossings (funnels + prime stands)
  refuge   — steep, far-from-road sanctuary

Emits, into --out:
  terrain_movement.<name>.json  — TerrainMovementSet (drops into the app map)
  scout_picks.<name>.json       — ranked scouting list with reasons + best wind
  terrain_movement.<name>.geojson — FeatureCollection (GIS/QA)

Usage:
  python3 scout_rules.py --name moore-hill --out ../../lib/generated \
      [--roads roads.geojson]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess

import numpy as np
import rasterio
from affine import Affine
from rasterio import features
from scipy import ndimage
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.stats import circmean
from shapely.geometry import LineString, box, mapping, shape
from shapely.ops import transform as shp_transform, unary_union, linemerge
from pyproj import Transformer

# WhiteboxTools geomorphon "forms" coding (Jasiewicz & Stepinski 10-class).
FLAT, PEAK, RIDGE, SHOULDER, SPUR, SLOPE, HOLLOW, FOOTSLOPE, VALLEY, PIT = range(1, 11)

# --- Tunables (Penn State findings) -----------------------------------------
BED_SLOPE_MIN, BED_SLOPE_MAX = 18.0, 45.0     # steep sidehills, not cliffs
SOUTH_MIN, SOUTH_MAX = 112.5, 247.5           # SE..SW thermal aspect
REFUGE_SLOPE_MIN = 30.0                        # sanctuary is steep
FAR_FROM_ROAD_M = 900.0                        # ~1,000 yd security threshold
MIN_BED_AREA_M2 = 1500.0

# --- S1 "Goldilocks" security band ------------------------------------------
# Penn State: hunters kill mature bucks on ground roughly 450-900 m from a road.
# Closer than that, deer treat the ground as unsafe and move mostly after dark;
# farther, it becomes a refuge they rarely leave in daylight (and that costs the
# hunter access + scent). Applied as a score modifier on the scored picks, so it
# re-ranks bedding/saddle leads toward the huntable band. Needs --roads; a no-
# roads run is unaffected (bonus is 0).
SECURITY_BAND_M = (450.0, 900.0)
SECURITY_BONUS = 20.0
MIN_REFUGE_AREA_M2 = 8000.0
# A saddle smaller than this is curvature noise, not a gap deer would funnel to.
MIN_SADDLE_AREA_M2 = 150.0
# Smooth the DEM at this GROUND scale before reading saddle curvature, so a 1 m
# DEM is read at hill scale instead of micro-relief.
SADDLE_SMOOTH_M = 40.0
# Keep only the strongest curvature candidates (percentile, not an absolute
# cutoff — curvature magnitude depends heavily on cell size).
SADDLE_PERCENTILE = 92.0

# --- Bench (contour) travel corridors ---------------------------------------
# Penn State collar deer bed high on steep slopes but TRAVEL the lower/mid
# elevation bands "parallel to the ridges" — they skirt steep ground along
# benches (near-level shelves that hold a constant elevation) to save energy,
# rather than climbing over ridgetops. A bench reads as gentle ground sitting in
# the middle of an otherwise-steep hillside.
BENCH_SLOPE_MAX = 13.0        # gentle enough to walk along comfortably
BENCH_NBHD_STEEP_MIN = 15.0   # the surrounding hillside is steep (it's a shelf)
BENCH_NBHD_M = 60.0           # radius for "surrounding" slope
TRAVEL_ELEV_PCTL = 75.0       # favor the lower/mid band deer travel, not ridgetops
MIN_BENCH_AREA_M2 = 500.0
BENCH_MIN_ELONGATION = 1.8    # a corridor is long and thin, not a blob
BENCH_MAX = 70                # dense bench network across a whole big tract

# A big-woods tract is a network, not a handful of spots — surface the whole
# travel web (many benches + draws + saddles), not just the single best of each.
MAX_PER_KIND = {"bedding": 60, "travel": 70, "pinch": 50, "refuge": 10}

# --- Bed-to-feed routing (needs --food) -------------------------------------
# The straight terrain travel above is where deer CAN move; with a food source
# marked, we can also draw where they DO — the least-effort route from each bed
# to the food. Deer follow the path of least resistance (gentle grades, benches,
# saddles; they avoid climbing steep faces), so the corridor is the cheapest
# path across a slope-cost surface. Pathfinding runs on a downsampled grid — a
# route doesn't need 1 m precision, and 36 M cells won't fit a graph.
ROUTE_DS_FACTOR = 10          # metres per pathfinding cell (10x the 1 m DEM)
ROUTE_SLOPE_REF = 12.0        # slope (deg) at which effort has roughly doubled
ROUTE_MAX_SLOPE = 42.0        # steeper than this is treated as near-impassable
ROUTE_ROUGH_W = 0.25          # weight of "avoid generally steep ground" vs. the
                              # dominant per-step climb term (keeps deer off nasty
                              # faces even when they'd contour across them)
ROUTE_MAX = 24                # a bed-to-feed route from every worthwhile bed
XING_MAX = 18                 # water-crossing funnels (travel corridor x drainage)
XING_DRAINAGES = 30           # only the N longest drainages count as real water,
                              # not every 1 m micro-gully in the DEM stream net
XING_DEDUP_DEG = 0.0018       # ~200 m: don't stack crossings on top of each other

# When the tiler runs scout_rules on a slice of a big tract, it sets CAP_SCALE so
# each tile gets its SHARE of the whole-property caps (e.g. a quarter of the 60
# bedding slots). Without it, every tile independently fills the full caps and
# the merged feature count is multiplied by the tile count.
_CAP_SCALE = float(os.environ.get("CAP_SCALE", "1") or "1")
if _CAP_SCALE != 1.0:
    MAX_PER_KIND = {k: max(1, round(v * _CAP_SCALE)) for k, v in MAX_PER_KIND.items()}
    BENCH_MAX = max(1, round(BENCH_MAX * _CAP_SCALE))
    ROUTE_MAX = max(1, round(ROUTE_MAX * _CAP_SCALE))
    XING_MAX = max(1, round(XING_MAX * _CAP_SCALE))

DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def compass(deg: float) -> str:
    return DIRS[int(round((deg % 360) / 22.5)) % 16]


def reciprocal_wind(aspect_deg: float) -> str:
    """Best wind to hunt ground that FACES aspect_deg: wind from the opposite
    side carries scent up and over, away from bedded/approaching deer."""
    return compass(aspect_deg + 180)


def thermal_note(aspect_deg: float | None = None) -> str:
    """W2 — thermals override the prevailing wind at the ends of the day. Cool
    air drains DOWNHILL at dawn/dusk; sun-warmed air rises UPSLOPE by midday. On
    a slope, aspect points downhill, so downhill == aspect and upslope ==
    aspect+180. With a known aspect we name the directions; without one (draws,
    benches) we give the generic rule."""
    if aspect_deg is None:
        return ("Thermals: scent sinks downhill at dawn/dusk, rises upslope by "
                "midday — let the active thermal, not just the wind, pick your side.")
    down = compass(aspect_deg)
    up = compass(aspect_deg + 180)
    return (f"Thermals: at dawn scent drains {down} (downhill); by midday it "
            f"rises {up} (upslope) — cross-check that against the wind.")


def sample_road_dist(dist_road, transform, x, y):
    """Distance-to-road (m) at projected (x, y), or None if unavailable/off-grid."""
    if dist_road is None:
        return None
    col, row = ~transform * (x, y)
    r, c = int(round(row)), int(round(col))
    if 0 <= r < dist_road.shape[0] and 0 <= c < dist_road.shape[1]:
        v = dist_road[r, c]
        return None if np.isnan(v) else float(v)
    return None


def security_bonus(dist_m):
    """S1 — score bump peaking inside the huntable security band, tapering to 0
    on either side. Returns (bonus, human-readable tag). No roads -> (0, "")."""
    if dist_m is None:
        return 0.0, ""
    lo, hi = SECURITY_BAND_M
    if dist_m < lo:
        bonus = SECURITY_BONUS * (dist_m / lo)
        tag = f"{round(dist_m)} m from a road — a touch close; deer stay edgy in daylight."
    elif dist_m <= hi:
        bonus = SECURITY_BONUS
        tag = f"{round(dist_m)} m from the nearest road — squarely in the huntable security band."
    else:
        bonus = max(0.0, SECURITY_BONUS * (1 - (dist_m - hi) / hi))
        tag = f"{round(dist_m)} m from a road — deep sanctuary; a quiet approach costs you."
    return bonus, tag


def load(path):
    # float32, not float64: a multi-tile 1 m read is tens of millions of cells,
    # and five rasters plus the gradient intermediates blow past a typical WSL
    # memory budget at 8 bytes/cell. Terrain math doesn't need the extra digits.
    with rasterio.open(path) as ds:
        arr = ds.read(1).astype("float32")
        nod = ds.nodata
        if nod is not None:
            arr[arr == nod] = np.nan
        return arr, ds.transform, ds.crs


def component_stats(mask, dem, slope, aspect, transform, min_area_m2=0.0, max_keep=6):
    """Label connected True cells; return the biggest components with polygon
    (UTM) + stats, largest first.

    At 1 m a mask can hold millions of cells and tens of thousands of blobs, so
    areas are counted up-front with bincount and only the few winners are
    vectorized — inside their own bounding box, not the whole raster.
    """
    labels, n = ndimage.label(mask)
    if n == 0:
        return []

    px = abs(transform.a)
    py = abs(transform.e)
    cell_area = px * py

    counts = np.bincount(labels.ravel())
    counts[0] = 0  # background
    order = [cid for cid in np.argsort(counts)[::-1] if counts[cid] > 0]
    slices = ndimage.find_objects(labels)

    out = []
    for cid in order:
        area = float(counts[cid]) * cell_area
        if area < min_area_m2 or len(out) >= max_keep:
            break  # counts are sorted desc, so nothing later can qualify

        sl = slices[cid - 1]
        sub = labels[sl] == cid
        sub_transform = transform * Affine.translation(sl[1].start, sl[0].start)

        polys = [
            shape(geom)
            for geom, val in features.shapes(
                sub.astype("uint8"), mask=sub, transform=sub_transform
            )
            if val == 1
        ]
        if not polys:
            continue

        asp = aspect[sl][sub]
        asp = asp[~np.isnan(asp)]
        out.append({
            "geom": max(polys, key=lambda p: p.area),
            "area": area,
            "slope": float(np.nanmean(slope[sl][sub])),
            "elev": float(np.nanmean(dem[sl][sub])),
            "aspect": float(np.degrees(circmean(np.radians(asp)))) if asp.size else 0.0,
        })
    return out


def bench_centerlines(mask, dem, transform, to_wgs, min_area_m2, max_keep):
    """Extract elongated benches as travel centerlines.

    Each qualifying bench blob is reduced to a medial polyline: cells are
    projected onto the blob's long axis (PCA), binned along it, and the mean
    cross-position per bin traces the shelf's run. Blobby (non-linear) or tiny
    blobs are dropped — a travel corridor is long and thin. Returns the longest
    first, each with its polyline (lat/lng) and mean elevation.
    """
    labels, n = ndimage.label(mask)
    if n == 0:
        return []
    px = abs(transform.a)
    py = abs(transform.e)
    cell_area = px * py
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    order = [c for c in np.argsort(counts)[::-1] if counts[c] > 0]
    slices = ndimage.find_objects(labels)

    out = []
    for cid in order:
        area = float(counts[cid]) * cell_area
        if area < min_area_m2:
            break  # counts sorted desc — nothing later is bigger
        if len(out) >= max_keep * 4:
            break  # scanned enough big blobs to fill the quota after filtering

        sl = slices[cid - 1]
        sub = labels[sl] == cid
        ys, xs = np.nonzero(sub)
        gx = (xs + sl[1].start).astype(np.float64)
        gy = (ys + sl[0].start).astype(np.float64)
        pts = np.column_stack([gx, gy])
        center = pts.mean(axis=0)
        cov = np.cov((pts - center).T)
        evals, evecs = np.linalg.eigh(cov)
        if evals[0] <= 1e-9:
            continue
        elongation = float(np.sqrt(evals[1] / evals[0]))
        if elongation < BENCH_MIN_ELONGATION:
            continue  # a blob, not a corridor

        major = evecs[:, 1]
        proj = (pts - center) @ major
        length_m = float(proj.max() - proj.min()) * px
        nbins = int(min(10, max(2, length_m / 80)))
        edges = np.linspace(proj.min(), proj.max(), nbins + 1)
        poly_px = []
        for b in range(nbins):
            in_bin = (proj >= edges[b]) & (proj <= edges[b + 1])
            if in_bin.any():
                poly_px.append(pts[in_bin].mean(axis=0))
        if len(poly_px) < 2:
            continue

        coords = []
        for cx, cy in poly_px:
            x, y = transform * (cx, cy)
            lng, lat = to_wgs.transform(x, y)
            coords.append([round(lat, 5), round(lng, 5)])

        elev = float(np.nanmean(dem[sl][sub]))
        out.append({"coords": coords, "length": length_m, "elev": elev, "area": area})

    out.sort(key=lambda c: c["length"], reverse=True)
    return out[:max_keep]


def _grid_graph(slope_ds, elev_ds, cell_m):
    """8-connected least-effort graph.

    The dominant edge term is the GRADE of the step — the rise/run between the
    two cells — squared. Squaring is what makes a deer's path realistic: the
    cheapest way to lose (or gain) a fixed amount of elevation is to spread it
    over distance, so the path contours, sidehills, and eases down draws instead
    of running straight up a face or plunging straight down to the food. A
    smaller roughness term keeps it off generally steep ground even where it
    could contour across, and cells past ROUTE_MAX_SLOPE are near-impassable.
    """
    hh, ww = slope_ds.shape
    idx = np.arange(hh * ww).reshape(hh, ww)
    rough = (slope_ds / ROUTE_SLOPE_REF) ** 2
    blocked = slope_ds > ROUTE_MAX_SLOPE
    rows, cols, data = [], [], []
    steps = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
             (-1, -1, 1.41421), (-1, 1, 1.41421), (1, -1, 1.41421), (1, 1, 1.41421)]
    for dy, dx, dd in steps:
        ys0, ys1 = max(0, -dy), hh - max(0, dy)
        xs0, xs1 = max(0, -dx), ww - max(0, dx)
        a = (slice(ys0, ys1), slice(xs0, xs1))
        b = (slice(ys0 + dy, ys1 + dy), slice(xs0 + dx, xs1 + dx))
        horiz = dd * cell_m
        climb_deg = np.degrees(np.arctan2(np.abs(elev_ds[b] - elev_ds[a]), horiz))
        climb = (climb_deg / ROUTE_SLOPE_REF) ** 2
        edge_rough = 0.5 * (rough[a] + rough[b])
        w = horiz * (1.0 + climb + ROUTE_ROUGH_W * edge_rough)
        w = np.where(blocked[a] | blocked[b], horiz * 1e4, w)
        rows.append(idx[a].ravel())
        cols.append(idx[b].ravel())
        data.append(w.ravel())
    return csr_matrix(
        (np.concatenate(data), (np.concatenate(rows), np.concatenate(cols))),
        shape=(hh * ww, hh * ww),
    )


def _chaikin(coords, iters=2):
    """Round the 8-direction staircase into a natural trail (corner-cutting).
    Deer don't turn in 45 degree steps; this eases the polyline the way a game
    trail actually curves."""
    for _ in range(iters):
        if len(coords) < 3:
            break
        out = [coords[0]]
        for p, q in zip(coords[:-1], coords[1:]):
            out.append([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25])
            out.append([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75])
        out.append(coords[-1])
        coords = out
    return coords


def _crossing_points(geom):
    """Representative points where two lines meet: the point(s), or the midpoint
    of any stretch where they run together."""
    out = []
    if geom.is_empty:
        return out
    gt = geom.geom_type
    if gt == "Point":
        out.append(geom)
    elif gt == "MultiPoint":
        out.extend(geom.geoms)
    elif gt == "LineString":
        out.append(geom.interpolate(0.5, normalized=True))
    elif gt in ("MultiLineString", "GeometryCollection"):
        for g in geom.geoms:
            out.extend(_crossing_points(g))
    return out


def bed_to_feed_routes(slope, dem, transform, crs, to_wgs, food_lonlat, beds, max_routes):
    """Least-effort paths from the top beds to a food source — where deer
    actually travel bed<->feed, not just where terrain allows it. The cost is
    driven by the GRADE of each step (see _grid_graph), so the path follows the
    line of least resistance: it contours and eases down draws instead of running
    straight. Runs on a ROUTE_DS_FACTOR-metre downsampling (a route needs no 1 m
    precision, and 36 M cells won't fit a graph)."""
    if not beds or not food_lonlat:
        return []
    F = ROUTE_DS_FACTOR
    hh0, ww0 = slope.shape
    hh0, ww0 = (hh0 // F) * F, (ww0 // F) * F
    if hh0 == 0 or ww0 == 0:
        return []
    s = np.nan_to_num(slope[:hh0, :ww0], nan=90.0).reshape(hh0 // F, F, ww0 // F, F).mean(axis=(1, 3))
    e = np.nan_to_num(dem[:hh0, :ww0], nan=float(np.nanmean(dem))).reshape(
        hh0 // F, F, ww0 // F, F).mean(axis=(1, 3))
    hh, ww = s.shape
    cell_m = F * abs(transform.a)
    graph = _grid_graph(s, e, cell_m)

    to_crs = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

    def cell_of_xy(x, y):
        col, row = ~transform * (x, y)
        r, c = int(row // F), int(col // F)
        return r * ww + c if (0 <= r < hh and 0 <= c < ww) else None

    fx, fy = to_crs.transform(food_lonlat[0], food_lonlat[1])
    food_node = cell_of_xy(fx, fy)
    if food_node is None:
        return []
    dist, pred = dijkstra(graph, directed=False, indices=food_node, return_predecessors=True)

    routes = []
    for b in beds[:max_routes]:
        bx, by = b["geom"].representative_point().coords[0]
        node = cell_of_xy(bx, by)
        if node is None or not np.isfinite(dist[node]):
            continue
        path, cur, guard = [], node, 0
        while cur != food_node and cur >= 0 and guard < hh * ww:
            path.append(cur)
            cur = int(pred[cur])
            guard += 1
        if cur != food_node:
            continue
        path.append(food_node)
        coords = []
        for nd in path:
            r, c = divmod(nd, ww)
            x, y = transform * ((c + 0.5) * F, (r + 0.5) * F)
            lng, lat = to_wgs.transform(x, y)
            coords.append([lng, lat])
        line = LineString(_chaikin(coords, 2)).simplify(0.00006)
        latlng = [[round(la, 5), round(lo, 5)] for lo, la in line.coords]
        if len(latlng) >= 2:
            routes.append({"coords": latlng})
    return routes


def road_distance(roads_geojson, ref_ds_path):
    """Rasterize roads onto the DEM grid and return a distance-to-road array (m).

    The distance transform runs on a coarse (~8 m) grid, not the full DEM: a
    full-res EDT over a 100M+ cell tract needs several GB of float64 scratch
    (it thrashes swap), and road distance only feeds the 450-900 m security
    band, where a few metres is immaterial. Roads are rasterized straight onto
    the coarse grid — rasterize burns every touched cell, so thin roads survive
    the coarsening — then the result is upsampled back to the DEM grid.
    """
    with rasterio.open(ref_ds_path) as ds:
        H, W = ds.height, ds.width
        transform = ds.transform
        crs = ds.crs
    tr = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    geoms = []
    with open(roads_geojson) as f:
        gj = json.load(f)
    for feat in gj.get("features", []):
        g = shape(feat["geometry"])
        geoms.append(shp_transform(lambda x, y, z=None: tr.transform(x, y), g))
    if not geoms:
        return None
    px = abs(transform.a)
    f = max(1, int(round(8.0 / px)))
    ch, cw = (H + f - 1) // f, (W + f - 1) // f
    coarse = transform * Affine.scale(f)
    road_coarse = features.rasterize(
        [(g, 1) for g in geoms], out_shape=(ch, cw), transform=coarse, dtype="uint8"
    )
    edt = (ndimage.distance_transform_edt(road_coarse == 0) * (px * f)).astype("float32")
    if f == 1:
        return edt
    return np.repeat(np.repeat(edt, f, axis=0), f, axis=1)[:H, :W]


def to_latlng_ring(poly, to_wgs):
    ring = [to_wgs.transform(x, y) for x, y in poly.exterior.coords]
    # de-densify a touch so the app payload stays small
    return [[round(lat, 5), round(lng, 5)] for lng, lat in ring][:: max(1, len(ring) // 24)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--roads", help="Optional roads GeoJSON (WGS84) for security scoring")
    ap.add_argument("--food", action="append", default=[],
                    help="Food source 'lat,lng' (repeatable) for bed-to-feed routes")
    ap.add_argument("--area-name", default=None)
    ap.add_argument(
        "--focus", nargs=4, type=float, default=None,
        metavar=("MINLNG", "MINLAT", "MAXLNG", "MAXLAT"),
        help="Restrict detection to this WGS84 bbox — the ground actually hunted. "
             "The DEM can cover a whole tract; this keeps predictions (and the "
             "feature caps) to the hunter's area instead of distant terrain.",
    )
    ap.add_argument(
        "--focus-geojson", default=None,
        help="Path to a WGS84 GeoJSON polygon (the hunter's drawn outline). Like "
             "--focus but clips to the exact shape, not just its bounding box. "
             "Takes precedence over --focus.",
    )
    args = ap.parse_args()

    food_pts = []
    for spec in args.food:
        la, lo = (float(v) for v in spec.split(","))
        food_pts.append((lo, la))  # (lng, lat) for the always_xy transformer

    work = os.path.abspath(os.path.join("work", args.name))
    dem_path = os.path.join(work, "dem.tif")
    dem, transform, crs = load(dem_path)
    slope, _, _ = load(os.path.join(work, "slope.tif"))
    aspect, _, _ = load(os.path.join(work, "aspect.tif"))
    geom_r, _, _ = load(os.path.join(work, "geomorphons.tif"))
    tpi, _, _ = load(os.path.join(work, "tpi.tif"))

    to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    px = abs(transform.a)
    dist_road = road_distance(args.roads, dem_path) if args.roads else None

    valid = ~np.isnan(dem) & ~np.isnan(slope)

    # Optional focus area: the DEM may cover a whole tract, but the hunter only
    # hunts part of it. Restrict the master valid mask to their ground so every
    # detector (and its cap) fills from it, not distant mountains. --focus-geojson
    # clips to the exact drawn polygon; --focus is its bounding box.
    focus_poly = None
    if args.focus_geojson:
        with open(args.focus_geojson) as f:
            gj = json.load(f)
        geom = gj["features"][0]["geometry"] if gj.get("type") == "FeatureCollection" \
            else gj.get("geometry", gj)
        focus_poly = shape(geom)  # WGS84 (used to clip the draws too)
        from_wgs = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        poly_crs = shp_transform(from_wgs.transform, focus_poly)
        focus_mask = features.geometry_mask(
            [mapping(poly_crs)], out_shape=dem.shape, transform=transform, invert=True
        )
        valid &= focus_mask
        print(f"[rules] focus polygon -> {int(focus_mask.sum())} cells in outline "
              f"({int((~np.isnan(dem)).sum())} in DEM)", flush=True)
    elif args.focus:
        fminlng, fminlat, fmaxlng, fmaxlat = args.focus
        focus_poly = box(fminlng, fminlat, fmaxlng, fmaxlat)
        from_wgs = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        inv = ~transform
        cols, rows = [], []
        for lo, la in [(fminlng, fminlat), (fminlng, fmaxlat),
                       (fmaxlng, fminlat), (fmaxlng, fmaxlat)]:
            x, y = from_wgs.transform(lo, la)
            c, r = inv * (x, y)
            cols.append(c)
            rows.append(r)
        c0 = max(0, int(np.floor(min(cols))))
        c1 = min(dem.shape[1], int(np.ceil(max(cols))))
        r0 = max(0, int(np.floor(min(rows))))
        r1 = min(dem.shape[0], int(np.ceil(max(rows))))
        focus_mask = np.zeros(dem.shape, dtype=bool)
        focus_mask[r0:r1, c0:c1] = True
        valid &= focus_mask
        print(f"[rules] focus box -> {int(focus_mask.sum())} cells "
              f"(rows {r0}:{r1}, cols {c0}:{c1})", flush=True)

    south = (aspect >= SOUTH_MIN) & (aspect <= SOUTH_MAX)
    steep = (slope >= BED_SLOPE_MIN) & (slope <= BED_SLOPE_MAX)
    upper = tpi > 0
    is_spur = geom_r == SPUR
    bed_landform = np.isin(geom_r, [SHOULDER, SPUR, SLOPE])

    bedding_mask = valid & bed_landform & steep & upper & (south | is_spur)

    refuge_mask = valid & (slope >= REFUGE_SLOPE_MIN)
    if dist_road is not None:
        refuge_mask &= dist_road >= FAR_FROM_ROAD_M

    # Saddles: smooth the DEM, then find cells where curvature flips sign between
    # the two axes (convex one way, concave the other) while sitting on a crest.
    #
    # Both the smoothing and the cutoff must be resolution-aware. Smoothing is
    # done at a fixed GROUND scale (metres -> cells) so a 1 m DEM isn't read as
    # micro-relief, and the cutoff is a percentile of the actual curvature rather
    # than an absolute number — at 1 m the second derivatives are orders of
    # magnitude smaller than at 10 m, so any fixed threshold rejects everything.
    # Each intermediate is a full-size raster, so free them as we go — at 1 m
    # over several tiles, holding them all at once is what OOMs the run.
    sigma_cells = max(SADDLE_SMOOTH_M / px, 1.0)
    sm = ndimage.gaussian_filter(
        np.nan_to_num(dem, nan=float(np.nanmean(dem))), sigma=sigma_cells
    )
    gy, gx = np.gradient(sm, px, px)
    del sm
    gxx = np.gradient(gx, px, axis=1)
    del gx
    gyy = np.gradient(gy, px, axis=0)
    del gy

    prod = gxx * gyy
    del gxx, gyy
    candidate = valid & (prod < 0) & upper  # opposite curvature, up on a crest
    strength = np.abs(prod)
    del prod
    if candidate.any():
        cutoff = np.percentile(strength[candidate], SADDLE_PERCENTILE)
        saddle_mask = candidate & (strength >= cutoff)
    else:
        saddle_mask = candidate
    del candidate

    features_out = []
    picks = []

    # ---- Bedding (polygons) ----
    print("[rules] bedding components", flush=True)
    beds = component_stats(
        bedding_mask, dem, slope, aspect, transform, MIN_BED_AREA_M2,
        MAX_PER_KIND["bedding"],
    )
    for k, c in enumerate(beds[: MAX_PER_KIND["bedding"]]):
        spur = SOUTH_MIN <= c["aspect"] <= SOUTH_MAX
        wind = reciprocal_wind(c["aspect"])
        title = "South-face beds" if spur else "Spur-point beds"
        detail = (
            f"{'SSE-facing' if spur else 'A spur nose'} bench near "
            f"{round(c['elev'] * 3.281)} ft, ~{c['slope']:.0f}° — thermal sun and a "
            "downhill escape; Penn State collar deer bed exactly this."
        )
        note = (f"Beds hold a {wind} wind. Approach from the ridge above. "
                + thermal_note(c["aspect"]))
        cx, cy = c["geom"].representative_point().coords[0]
        lng, lat = to_wgs.transform(cx, cy)
        road_d = sample_road_dist(dist_road, transform, cx, cy)
        sec, sec_tag = security_bonus(road_d)
        feature = {
            "id": f"{args.name}-bed-{k}", "kind": "bedding",
            "title": title, "detail": detail, "windNote": note,
            "polygon": to_latlng_ring(c["geom"], to_wgs),
        }
        if road_d is not None:
            feature["roadDistM"] = round(road_d)
        features_out.append(feature)
        pick = {"kind": "bedding", "title": title, "lat": round(lat, 5),
                "lng": round(lng, 5), "elevationFt": round(c["elev"] * 3.281),
                "slopeDeg": round(c["slope"]), "aspect": compass(c["aspect"]),
                "bestWind": wind, "reason": detail + (f" {sec_tag}" if sec_tag else ""),
                "score": c["area"] / 1000 + c["slope"] + sec}
        if road_d is not None:
            pick["roadDistM"] = round(road_d)
        picks.append(pick)

    # ---- Refuge (polygon, largest steep-far block) ----
    print("[rules] refuge components", flush=True)
    refs = component_stats(
        refuge_mask, dem, slope, aspect, transform, MIN_REFUGE_AREA_M2,
        MAX_PER_KIND["refuge"],
    )
    for k, c in enumerate(refs[: MAX_PER_KIND["refuge"]]):
        features_out.append({
            "id": f"{args.name}-refuge-{k}", "kind": "refuge",
            "title": "Steep sanctuary",
            "detail": (
                f"The steepest {'and farthest-from-road ' if dist_road is not None else ''}"
                f"ground (~{c['slope']:.0f}°) — where deer ride out the season. "
                "Hunt its upper edge and the saddles leading out, don't push it."
            ),
            "polygon": to_latlng_ring(c["geom"], to_wgs),
        })

    # ---- Saddles (pinch points) ----
    # Vectorized: at 1 m this mask holds thousands of clusters, so drop the
    # noise-sized ones by count and let ndimage reduce the survivors in one pass
    # rather than materializing a full-raster boolean per cluster.
    print("[rules] saddle clusters", flush=True)
    labels, n = ndimage.label(saddle_mask)
    sad = []
    if n > 0:
        cell_area = abs(transform.a) * abs(transform.e)
        counts = np.bincount(labels.ravel())
        counts[0] = 0
        keep = [c for c in range(1, n + 1) if counts[c] * cell_area >= MIN_SADDLE_AREA_M2]
        keep.sort(key=lambda c: counts[c], reverse=True)
        keep = keep[:200]
        if keep:
            demz = np.nan_to_num(dem, nan=float(np.nanmean(dem)))
            coms = ndimage.center_of_mass(saddle_mask, labels, keep)
            elevs = ndimage.mean(demz, labels, keep)
            strengths = ndimage.mean(strength, labels, keep)
            del demz
            for (yi, xi), e, s in zip(coms, np.atleast_1d(elevs), np.atleast_1d(strengths)):
                x, y = transform * (xi, yi)
                lng, lat = to_wgs.transform(x, y)
                sad.append({"lat": lat, "lng": lng, "x": x, "y": y,
                            "elev": float(e), "strength": float(s)})
    sad.sort(key=lambda s: s["strength"], reverse=True)
    for k, s in enumerate(sad[: MAX_PER_KIND["pinch"]]):
        detail = (
            f"A ridge saddle near {round(s['elev'] * 3.281)} ft — deer cross ridges "
            "at their low gaps, funneling travel between bedding areas. Prime stand."
        )
        road_d = sample_road_dist(dist_road, transform, s["x"], s["y"])
        sec, sec_tag = security_bonus(road_d)
        feature = {
            "id": f"{args.name}-pinch-{k}", "kind": "pinch",
            "title": "Saddle crossing", "detail": detail,
            "windNote": "Sit the downhill side on a crosswind. " + thermal_note(),
            "point": [round(s["lat"], 5), round(s["lng"], 5)],
        }
        if road_d is not None:
            feature["roadDistM"] = round(road_d)
        features_out.append(feature)
        pick = {"kind": "pinch", "title": "Saddle crossing", "lat": round(s["lat"], 5),
                "lng": round(s["lng"], 5), "elevationFt": round(s["elev"] * 3.281),
                "bestWind": "crosswind", "reason": detail + (f" {sec_tag}" if sec_tag else ""),
                "score": 1000 + s["strength"] * 1e6 + sec}
        if road_d is not None:
            pick["roadDistM"] = round(road_d)
        picks.append(pick)

    # ---- Bench travel corridors (contour trails on steep hillsides) ----
    # Gentle shelves sitting in otherwise-steep ground, in the lower/mid
    # elevation band — the sidehill trails Penn State collar deer travel along
    # instead of climbing over the ridgetops.
    print("[rules] bench corridors", flush=True)
    nbhd = max(int(BENCH_NBHD_M / px), 1)
    nbhd_slope = ndimage.uniform_filter(np.nan_to_num(slope, nan=0.0), size=nbhd)
    elev_cut = float(np.percentile(dem[valid], TRAVEL_ELEV_PCTL))
    bench_mask = (
        valid
        & (slope <= BENCH_SLOPE_MAX)
        & (nbhd_slope >= BENCH_NBHD_STEEP_MIN)
        & (dem <= elev_cut)
        & ~np.isin(geom_r, [PEAK, RIDGE, VALLEY, PIT])
    )
    del nbhd_slope
    benches = bench_centerlines(
        bench_mask, dem, transform, to_wgs, MIN_BENCH_AREA_M2, BENCH_MAX
    )
    for k, b in enumerate(benches):
        features_out.append({
            "id": f"{args.name}-bench-{k}", "kind": "travel",
            "title": f"Bench trail ({round(b['elev'] * 3.281)} ft)",
            "detail": (
                "A near-level shelf on a steep hillside — deer sidehill along "
                "benches like this at a constant elevation to save energy, "
                "traveling the lower slopes parallel to the ridge rather than "
                "climbing over the top."
            ),
            "windNote": ("Deer walk it into the wind; sit the downwind end, above or "
                         "below the trail. " + thermal_note()),
            "line": b["coords"],
        })

    # ---- Bed-to-feed routes (least-cost paths bed -> marked food) ----
    if food_pts and beds:
        print("[rules] bed-to-feed routes", flush=True)
        for pk, food in enumerate(food_pts):
            routes = bed_to_feed_routes(
                slope, dem, transform, crs, to_wgs, food, beds, ROUTE_MAX
            )
            for k, rt in enumerate(routes):
                features_out.append({
                    "id": f"{args.name}-route-{pk}-{k}", "kind": "travel",
                    "title": "Bed-to-feed route",
                    "detail": (
                        "The least-effort path from bedding to your marked food — the "
                        "route deer actually take between bed and feed, following gentle "
                        "grades and benches and skirting the steep faces."
                    ),
                    "windNote": (
                        "Deer move it toward feed in the evening, back to bed at dawn — "
                        "hunt it downwind of the trail. " + thermal_note()
                    ),
                    "line": rt["coords"],
                })

    # ---- Travel (draw centerlines from the stream vector) ----
    shp = os.path.join(work, "streams.shp")
    draws_geojson = os.path.join(work, "streams_wgs.geojson")
    if os.path.exists(shp):
        subprocess.run(
            ["ogr2ogr", "-f", "GeoJSON", "-s_srs", str(crs), "-t_srs", "EPSG:4326",
             draws_geojson, shp], check=True,
        )
        with open(draws_geojson) as f:
            gj = json.load(f)
        lines = []
        for feat in gj.get("features", []):
            g = shape(feat["geometry"])
            # Draws come from the stream vector, which spans the whole DEM — clip
            # them to the focus box so drainages outside the hunted ground drop.
            if focus_poly is not None:
                g = g.intersection(focus_poly)
                if g.is_empty:
                    continue
            if g.geom_type == "LineString":
                lines.append(g)
            elif g.geom_type == "MultiLineString":
                lines.extend(list(g.geoms))
        lines.sort(key=lambda ln: ln.length, reverse=True)
        for k, ln in enumerate(lines[: MAX_PER_KIND["travel"]]):
            ln = ln.simplify(0.0003)
            coords = [[round(lat, 5), round(lng, 5)] for lng, lat in ln.coords]
            features_out.append({
                "id": f"{args.name}-draw-{k}", "kind": "travel",
                "title": "Draw travel corridor",
                "detail": ("A drainage carrying bed-to-feed travel and your quietest, "
                           "lowest-scent way in."),
                "windNote": thermal_note() + " Hunt the lower end at dawn, the upper end midday.",
                "line": coords,
            })

        # ---- Water-crossing funnels: where a travel corridor meets a real
        # drainage. A deer sidehilling a bench, or routing bed<->feed, dips
        # through the draw to get across — that crossing pinches movement AND
        # sits on water, one of the highest-odds stands. Only the longest
        # drainages count (creeks + major draws), not every 1 m micro-gully.
        merged = linemerge(unary_union(lines)) if lines else None
        drains = []
        if merged is not None and not merged.is_empty:
            drains = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
            drains.sort(key=lambda ln: ln.length, reverse=True)
        major = unary_union(drains[:XING_DRAINAGES]) if drains else None
        if major is not None and not major.is_empty:
            existing = [tuple(f["point"]) for f in features_out if f.get("kind") == "pinch"]
            cand = []  # (lat, lng, on_route)
            for feat in features_out:
                if feat.get("kind") != "travel":
                    continue
                fid = feat.get("id", "")
                is_route = "-route-" in fid
                if not is_route and "-bench-" not in fid:
                    continue
                trav = LineString([(c[1], c[0]) for c in feat["line"]])
                for p in _crossing_points(trav.intersection(major)):
                    cand.append((round(p.y, 5), round(p.x, 5), is_route))
            cand.sort(key=lambda c: 0 if c[2] else 1)  # route crossings first
            kept = []
            for lat, lng, is_route in cand:
                if any(abs(lat - a) + abs(lng - b) < XING_DEDUP_DEG for a, b, _ in kept):
                    continue
                if any(abs(lat - a) + abs(lng - b) < XING_DEDUP_DEG for a, b in existing):
                    continue
                kept.append((lat, lng, is_route))
                if len(kept) >= XING_MAX:
                    break
            for k, (lat, lng, is_route) in enumerate(kept):
                via = "bed-to-feed route" if is_route else "travel corridor"
                features_out.append({
                    "id": f"{args.name}-xing-{k}", "kind": "pinch",
                    "title": "Water crossing",
                    "detail": (f"Where a {via} crosses a drainage — deer funnel through the "
                               "low gap to get across, with reliable water right there. One of "
                               "the highest-odds stands on the property."),
                    "windNote": ("Sit the downwind bank. Morning thermals sink into the "
                                 "drainage, so hunt the low end at first light. " + thermal_note()),
                    "point": [lat, lng],
                })
            if kept:
                print(f"[rules] {len(kept)} water crossings", flush=True)

    # Center = mean of all feature anchor points (for the app map focus).
    all_pts = []
    for feat in features_out:
        if "point" in feat:
            all_pts.append(feat["point"])
        elif "polygon" in feat:
            all_pts.append(feat["polygon"][0])
        elif "line" in feat:
            all_pts.append(feat["line"][0])
    center = [round(np.mean([p[0] for p in all_pts]), 5),
              round(np.mean([p[1] for p in all_pts]), 5)] if all_pts else [0, 0]

    movement_set = {
        "areaName": args.area_name or args.name.replace("-", " ").title(),
        "center": center,
        "source": "1 m LiDAR terrain read · Penn State Deer-Forest rules",
        "features": features_out,
    }

    picks.sort(key=lambda p: p["score"], reverse=True)
    for p in picks:
        p.pop("score", None)

    os.makedirs(args.out, exist_ok=True)
    mv = os.path.join(args.out, f"terrain_movement.{args.name}.json")
    pk = os.path.join(args.out, f"scout_picks.{args.name}.json")
    fc = os.path.join(args.out, f"terrain_movement.{args.name}.geojson")
    with open(mv, "w") as f:
        json.dump(movement_set, f, indent=2)
    with open(pk, "w") as f:
        json.dump({"area": movement_set["areaName"], "picks": picks}, f, indent=2)
    with open(fc, "w") as f:
        json.dump(to_feature_collection(features_out), f, indent=2)

    print(f"[rules] {len(features_out)} features, {len(picks)} scout picks")
    print(f"[rules] wrote {mv}")
    print(f"[rules] wrote {pk}")


def to_feature_collection(features_out):
    feats = []
    for feat in features_out:
        if "point" in feat:
            geom = {"type": "Point", "coordinates": [feat["point"][1], feat["point"][0]]}
        elif "line" in feat:
            geom = mapping(LineString([(c[1], c[0]) for c in feat["line"]]))
        else:
            ring = [(c[1], c[0]) for c in feat["polygon"]]
            geom = {"type": "Polygon", "coordinates": [ring + [ring[0]]]}
        feats.append({"type": "Feature", "geometry": geom,
                      "properties": {k: v for k, v in feat.items()
                                     if k not in ("point", "line", "polygon")}})
    return {"type": "FeatureCollection", "features": feats}


if __name__ == "__main__":
    main()
