#!/usr/bin/env python3
"""Tiled rule detection for tracts too big to run scout_rules in one pass.

scout_rules loads the full derivative rasters into memory, so a whole-tract 1 m
read (e.g. 130M cells) peaks past what an 8 GB worker has. This splits the
ALREADY-COMPUTED derivatives into core tiles — each small enough to run in a few
GB — runs scout_rules unchanged on every crop, and merges the features.

Correctness:
  * Each tile's focus polygon is `outline ∩ core-box`, so scout_rules detects (and
    caps) only features whose ground is in that tile's core. Every feature lands
    in exactly one tile → no seam duplication.
  * The crop carries a halo beyond the core so the edge cells have correct
    neighbourhood context for the two things scout_rules recomputes from the DEM
    (saddle smoothing ~40 px, bench neighbourhood ~60 px). Everything else
    (geomorphons, slope, aspect, TPI) was computed globally by
    terrain_derivatives, so the crops already hold correct values.

Same CLI as scout_rules, plus --max-cells. Delegates to a single scout_rules run
when the tract already fits, so it's a safe drop-in for the worker.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import rasterio
from pyproj import Transformer
from shapely.geometry import box, mapping, shape
from shapely.ops import transform as shp_transform

HALO_PX = 128  # covers the saddle gaussian (sigma 40) + bench window (60)
DERIV_RASTERS = ["dem.tif", "slope.tif", "aspect.tif", "geomorphons.tif", "tpi.tif"]
STREAM_FILES = ["streams.shp", "streams.shx", "streams.dbf", "streams.prj", "streams.cpg"]


def run(cmd: list[str], env=None) -> None:
    print("[tile] $ " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, env=env)


def scout_rules_cmd(name, out, roads, focus, food, area):
    cmd = [sys.executable, "scout_rules.py", "--name", name, "--out", out,
           "--focus-geojson", focus]
    if area:
        cmd += ["--area-name", area]
    if roads and os.path.exists(roads):
        cmd += ["--roads", roads]
    for f in food:
        cmd += ["--food", f]
    return cmd


def load_focus_polygon(path):
    with open(path) as f:
        gj = json.load(f)
    geom = gj["features"][0]["geometry"] if gj.get("type") == "FeatureCollection" \
        else gj.get("geometry", gj)
    return shape(geom)


def window_box(transform, c0, r0, c1, r1):
    """UTM bounding box of a pixel window [c0:c1, r0:r1]."""
    x0, y0 = transform * (c0, r0)
    x1, y1 = transform * (c1, r1)
    return box(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def anchor(feat):
    if "point" in feat:
        return feat["point"]
    if "line" in feat:
        ln = feat["line"]
        return ln[len(ln) // 2]
    ring = feat["polygon"]
    return [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]


def to_feature_collection(features):
    feats = []
    for feat in features:
        if "point" in feat:
            geom = {"type": "Point", "coordinates": [feat["point"][1], feat["point"][0]]}
        elif "line" in feat:
            geom = {"type": "LineString", "coordinates": [[c[1], c[0]] for c in feat["line"]]}
        else:
            ring = [[c[1], c[0]] for c in feat["polygon"]]
            geom = {"type": "Polygon", "coordinates": [ring + [ring[0]]]}
        props = {k: feat[k] for k in ("id", "kind", "title") if k in feat}
        feats.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": feats}


def write_merged(args, features, picks):
    area = args.area_name or args.name.replace("-", " ").title()
    pts = [anchor(f) for f in features]
    center = [round(float(np.mean([p[0] for p in pts])), 5),
              round(float(np.mean([p[1] for p in pts])), 5)] if pts else [0, 0]
    movement = {
        "areaName": area, "center": center,
        "source": "1 m LiDAR terrain read (tiled) · Penn State Deer-Forest rules",
        "features": features,
    }
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, f"terrain_movement.{args.name}.json"), "w") as f:
        json.dump(movement, f, indent=2)
    with open(os.path.join(args.out, f"terrain_movement.{args.name}.geojson"), "w") as f:
        json.dump(to_feature_collection(features), f, indent=2)
    with open(os.path.join(args.out, f"scout_picks.{args.name}.json"), "w") as f:
        json.dump({"area": area, "picks": picks}, f, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--roads")
    ap.add_argument("--food", action="append", default=[])
    ap.add_argument("--focus-geojson", dest="focus_geojson", required=True)
    ap.add_argument("--area-name", dest="area_name", default=None)
    ap.add_argument("--max-cells", type=int, default=35_000_000,
                    help="Tile so each core stays under this many cells.")
    args = ap.parse_args()

    work = os.path.join("work", args.name)
    with rasterio.open(os.path.join(work, "dem.tif")) as ds:
        H, W = ds.height, ds.width
        transform = ds.transform
        crs = ds.crs
    cells = H * W

    # Fits in one pass — hand straight to scout_rules (writes all its outputs).
    if cells <= args.max_cells:
        print(f"[tile] {cells/1e6:.0f}M cells fits; single scout_rules pass", flush=True)
        run(scout_rules_cmd(args.name, args.out, args.roads, args.focus_geojson,
                            args.food, args.area_name))
        return 0

    # Grid: enough tiles to get each core under the cap, split ~squarely.
    ntiles = math.ceil(cells / args.max_cells)
    ny = max(1, round(math.sqrt(ntiles * H / W)))
    nx = max(1, math.ceil(ntiles / ny))
    print(f"[tile] {cells/1e6:.0f}M cells -> {nx}x{ny} tiles "
          f"(core <= {args.max_cells/1e6:.0f}M)", flush=True)

    outline_wgs = load_focus_polygon(args.focus_geojson)
    to_crs = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    outline_utm = shp_transform(to_crs.transform, outline_wgs)

    roads_abs = os.path.abspath(args.roads) if args.roads else None

    # First pass: which grid cells actually cover the outline? Their count sets
    # the per-tile cap share so the merged total matches a single whole-tract run
    # (each tile fills its slice of the 60 bedding / 70 travel / … caps).
    active = []
    for iy in range(ny):
        for ix in range(nx):
            c0, c1 = ix * W // nx, (ix + 1) * W // nx
            r0, r1 = iy * H // ny, (iy + 1) * H // ny
            focus_utm = outline_utm.intersection(window_box(transform, c0, r0, c1, r1))
            if not focus_utm.is_empty:
                active.append((c0, r0, c1, r1, shp_transform(to_wgs.transform, focus_utm)))
    scale = 1.0 / max(1, len(active))
    print(f"[tile] {len(active)} active tiles, cap scale {scale:.3f}", flush=True)

    merged, picks = [], []
    tmp_root = tempfile.mkdtemp(prefix="tile-out-")
    for t, (c0, r0, c1, r1, focus_wgs) in enumerate(active):
        cc0, cc1 = max(0, c0 - HALO_PX), min(W, c1 + HALO_PX)
        cr0, cr1 = max(0, r0 - HALO_PX), min(H, r1 + HALO_PX)
        tname = f"{args.name}__t{t}"
        tdir = os.path.join("work", tname)
        os.makedirs(tdir, exist_ok=True)
        try:
            for rast in DERIV_RASTERS:
                run(["gdal_translate", "-q", "-srcwin",
                     str(cc0), str(cr0), str(cc1 - cc0), str(cr1 - cr0),
                     os.path.join(work, rast), os.path.join(tdir, rast)])
            for sf in STREAM_FILES:
                src = os.path.join(work, sf)
                if os.path.exists(src):
                    shutil.copy(src, os.path.join(tdir, sf))
            fpath = os.path.join(tdir, "focus.geojson")
            with open(fpath, "w") as f:
                json.dump({"type": "FeatureCollection", "features": [
                    {"type": "Feature", "properties": {}, "geometry": mapping(focus_wgs)}]}, f)

            out_tile = os.path.join(tmp_root, tname)
            os.makedirs(out_tile, exist_ok=True)
            run(scout_rules_cmd(tname, out_tile, roads_abs, fpath, args.food, args.area_name),
                env={**os.environ, "CAP_SCALE": f"{scale:.4f}"})

            with open(os.path.join(out_tile, f"terrain_movement.{tname}.json")) as f:
                tset = json.load(f)
            for k, feat in enumerate(tset.get("features", [])):
                feat["id"] = f"t{t}-{feat.get('id', 'f' + str(k))}"
                merged.append(feat)
            pk = os.path.join(out_tile, f"scout_picks.{tname}.json")
            if os.path.exists(pk):
                with open(pk) as f:
                    picks.extend(json.load(f).get("picks", []))
        finally:
            shutil.rmtree(tdir, ignore_errors=True)

    write_merged(args, merged, picks)
    print(f"[tile] merged {len(merged)} features from {len(active)} tiles", flush=True)
    shutil.rmtree(tmp_root, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
