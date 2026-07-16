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
from scipy.stats import circmean
from shapely.geometry import LineString, mapping, shape
from shapely.ops import transform as shp_transform
from pyproj import Transformer

# WhiteboxTools geomorphon "forms" coding (Jasiewicz & Stepinski 10-class).
FLAT, PEAK, RIDGE, SHOULDER, SPUR, SLOPE, HOLLOW, FOOTSLOPE, VALLEY, PIT = range(1, 11)

# --- Tunables (Penn State findings) -----------------------------------------
BED_SLOPE_MIN, BED_SLOPE_MAX = 18.0, 45.0     # steep sidehills, not cliffs
SOUTH_MIN, SOUTH_MAX = 112.5, 247.5           # SE..SW thermal aspect
REFUGE_SLOPE_MIN = 30.0                        # sanctuary is steep
FAR_FROM_ROAD_M = 900.0                        # ~1,000 yd security threshold
MIN_BED_AREA_M2 = 1500.0
MIN_REFUGE_AREA_M2 = 8000.0
# A saddle smaller than this is curvature noise, not a gap deer would funnel to.
MIN_SADDLE_AREA_M2 = 150.0
# Smooth the DEM at this GROUND scale before reading saddle curvature, so a 1 m
# DEM is read at hill scale instead of micro-relief.
SADDLE_SMOOTH_M = 40.0
# Keep only the strongest curvature candidates (percentile, not an absolute
# cutoff — curvature magnitude depends heavily on cell size).
SADDLE_PERCENTILE = 92.0
MAX_PER_KIND = {"bedding": 2, "travel": 2, "pinch": 2, "refuge": 1}

DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def compass(deg: float) -> str:
    return DIRS[int(round((deg % 360) / 22.5)) % 16]


def reciprocal_wind(aspect_deg: float) -> str:
    """Best wind to hunt ground that FACES aspect_deg: wind from the opposite
    side carries scent up and over, away from bedded/approaching deer."""
    return compass(aspect_deg + 180)


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


def road_distance(roads_geojson, ref_ds_path):
    """Rasterize roads onto the DEM grid and return a distance-to-road array (m)."""
    with rasterio.open(ref_ds_path) as ds:
        shape_hw = (ds.height, ds.width)
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
    road_raster = features.rasterize(
        [(g, 1) for g in geoms], out_shape=shape_hw, transform=transform, dtype="uint8"
    )
    px = abs(transform.a)
    return ndimage.distance_transform_edt(road_raster == 0) * px


def to_latlng_ring(poly, to_wgs):
    ring = [to_wgs.transform(x, y) for x, y in poly.exterior.coords]
    # de-densify a touch so the app payload stays small
    return [[round(lat, 5), round(lng, 5)] for lng, lat in ring][:: max(1, len(ring) // 24)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--roads", help="Optional roads GeoJSON (WGS84) for security scoring")
    ap.add_argument("--area-name", default=None)
    args = ap.parse_args()

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
        bedding_mask, dem, slope, aspect, transform, MIN_BED_AREA_M2, 6
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
        note = f"Beds hold a {wind} wind. Approach from the ridge above."
        features_out.append({
            "id": f"{args.name}-bed-{k}", "kind": "bedding",
            "title": title, "detail": detail, "windNote": note,
            "polygon": to_latlng_ring(c["geom"], to_wgs),
        })
        cx, cy = c["geom"].representative_point().coords[0]
        lng, lat = to_wgs.transform(cx, cy)
        picks.append({"kind": "bedding", "title": title, "lat": round(lat, 5),
                      "lng": round(lng, 5), "elevationFt": round(c["elev"] * 3.281),
                      "slopeDeg": round(c["slope"]), "aspect": compass(c["aspect"]),
                      "bestWind": wind, "reason": detail,
                      "score": c["area"] / 1000 + c["slope"]})

    # ---- Refuge (polygon, largest steep-far block) ----
    print("[rules] refuge components", flush=True)
    refs = component_stats(
        refuge_mask, dem, slope, aspect, transform, MIN_REFUGE_AREA_M2, 3
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
                sad.append({"lat": lat, "lng": lng, "elev": float(e), "strength": float(s)})
    sad.sort(key=lambda s: s["strength"], reverse=True)
    for k, s in enumerate(sad[: MAX_PER_KIND["pinch"]]):
        detail = (
            f"A ridge saddle near {round(s['elev'] * 3.281)} ft — deer cross ridges "
            "at their low gaps, funneling travel between bedding areas. Prime stand."
        )
        features_out.append({
            "id": f"{args.name}-pinch-{k}", "kind": "pinch",
            "title": "Saddle crossing", "detail": detail,
            "windNote": "Sit the downhill side on a crosswind.",
            "point": [round(s["lat"], 5), round(s["lng"], 5)],
        })
        picks.append({"kind": "pinch", "title": "Saddle crossing", "lat": round(s["lat"], 5),
                      "lng": round(s["lng"], 5), "elevationFt": round(s["elev"] * 3.281),
                      "bestWind": "crosswind", "reason": detail,
                      "score": 1000 + s["strength"] * 1e6})

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
                "windNote": "Morning thermals fall downhill — hunt the lower end at dawn.",
                "line": coords,
            })

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
