#!/usr/bin/env python3
"""Fetch the road network over a property's DEM extent from OpenStreetMap.

Writes work/<name>/roads.geojson (WGS84 LineStrings) for scout_rules.py --roads,
which turns it into a distance-to-road surface for the Penn State "Goldilocks"
security band (hunters kill mature bucks ~450-900 m from a road; closer, deer
go nocturnal; farther, it's untouchable sanctuary).

Usage:
  python3 fetch_roads.py --name moore-hill
"""
from __future__ import annotations

import argparse
import json
import os

import rasterio
from rasterio.warp import transform_bounds
import requests

# Several mirrors — some reject the default requests User-Agent with a 406, and
# any one can be busy, so try them in order with a real UA.
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
HEADERS = {"User-Agent": "deer-intel-terrain/1.0 (hunting terrain analysis)"}


def overpass_query(query: str):
    last = None
    for url in OVERPASS_MIRRORS:
        try:
            resp = requests.post(url, data={"data": query}, headers=HEADERS, timeout=180)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001 — try the next mirror
            print(f"[roads] {url} failed: {exc}", flush=True)
            last = exc
    raise SystemExit(f"All Overpass mirrors failed: {last}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    args = ap.parse_args()

    work = os.path.abspath(os.path.join("work", args.name))
    dem = os.path.join(work, "dem.tif")
    with rasterio.open(dem) as ds:
        # transform_bounds -> (min_lng, min_lat, max_lng, max_lat)
        w, s, e, n = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)

    # Any drivable/forest road counts as access + hunting pressure.
    query = (
        f"[out:json][timeout:120];"
        f'way["highway"]({s},{w},{n},{e});'
        f"out geom;"
    )
    print(f"[roads] querying OSM for {args.name} ({s:.4f},{w:.4f} -> {n:.4f},{e:.4f})", flush=True)
    elements = overpass_query(query).get("elements", [])

    feats = []
    for el in elements:
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
        coords = [[p["lon"], p["lat"]] for p in geom]
        feats.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"highway": el.get("tags", {}).get("highway", "")},
        })

    out = os.path.join(work, "roads.geojson")
    with open(out, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    print(f"[roads] wrote {len(feats)} roads to {out}")


if __name__ == "__main__":
    main()
