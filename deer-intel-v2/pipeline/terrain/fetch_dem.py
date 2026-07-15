#!/usr/bin/env python3
"""Stage 0 — fetch a bare-earth DEM for a property bounding box.

Queries the USGS National Map (TNM) for the best available DEM covering the box
(1 m 3DEP preferred, then 1/3 arc-second ~10 m NED), downloads the tiles, and
mosaics + clips + reprojects them into a single metric-CRS GeoTIFF the rest of
the pipeline analyzes: work/<name>/dem.tif (UTM, so slope is in real degrees).

Requires GDAL CLI (gdalbuildvrt, gdalwarp) on PATH.

Usage:
  python3 fetch_dem.py --name moore-hill --bbox -78.3322 41.4495 -78.3062 41.4695
"""
from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
import tempfile
from urllib.parse import urlencode

import requests

TNM_API = "https://tnmaccess.nationalmap.gov/api/v1/products"

# Preference order: finest first. Dataset names are TNM's exact strings.
DATASETS = [
    "Digital Elevation Model (DEM) 1 meter",
    "National Elevation Dataset (NED) 1/3 arc-second",
]


def utm_epsg(lng: float, lat: float) -> int:
    """EPSG code for the UTM zone containing (lng, lat). PA is 17N/18N."""
    zone = int((lng + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


def query_tnm(bbox: list[float]) -> list[str]:
    """Return download URLs for the finest dataset that covers the bbox."""
    min_lng, min_lat, max_lng, max_lat = bbox
    for dataset in DATASETS:
        params = {
            "datasets": dataset,
            "bbox": f"{min_lng},{min_lat},{max_lng},{max_lat}",
            "outputFormat": "JSON",
            "max": 50,
        }
        url = f"{TNM_API}?{urlencode(params)}"
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        items = resp.json().get("items", [])
        urls = [it["downloadURL"] for it in items if it.get("downloadURL")]
        if urls:
            print(f"[fetch] {dataset}: {len(urls)} tile(s)")
            return urls
        print(f"[fetch] {dataset}: no coverage, trying coarser")
    raise SystemExit(
        "No DEM found on The National Map for this bbox. "
        "For PA, download PAMAP LiDAR DEM from PASDA manually and place it at "
        "work/<name>/source/ then re-run terrain_derivatives.py."
    )


def download(urls: list[str], dest_dir: str) -> list[str]:
    os.makedirs(dest_dir, exist_ok=True)
    paths = []
    for u in urls:
        name = u.split("/")[-1].split("?")[0]
        path = os.path.join(dest_dir, name)
        if not os.path.exists(path):
            print(f"[fetch] downloading {name}")
            with requests.get(u, stream=True, timeout=600) as r:
                r.raise_for_status()
                with open(path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
        paths.append(path)
    return paths


def run(cmd: list[str]) -> None:
    print("[gdal]", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument(
        "--bbox", nargs=4, type=float, required=True,
        metavar=("MINLNG", "MINLAT", "MAXLNG", "MAXLAT"),
    )
    ap.add_argument("--buffer-m", type=float, default=150.0,
                    help="Extra ground around the bbox so edge features aren't clipped.")
    args = ap.parse_args()

    work = os.path.join("work", args.name)
    os.makedirs(work, exist_ok=True)
    src_dir = os.path.join(work, "source")

    tiles = download(query_tnm(args.bbox), src_dir)

    min_lng, min_lat, max_lng, max_lat = args.bbox
    center_lng = (min_lng + max_lng) / 2
    center_lat = (min_lat + max_lat) / 2
    epsg = utm_epsg(center_lng, center_lat)

    # Buffer the bbox in degrees (rough, generous — exact clip happens in UTM).
    dlat = args.buffer_m / 111_000
    dlng = args.buffer_m / (111_000 * math.cos(math.radians(center_lat)))
    te_wgs = [min_lng - dlng, min_lat - dlat, max_lng + dlng, max_lat + dlat]

    vrt = os.path.join(work, "mosaic.vrt")
    dem = os.path.join(work, "dem.tif")
    run(["gdalbuildvrt", vrt, *tiles])
    # Reproject to UTM, clip to buffered bbox, resample to 1 m (or native if coarser).
    run([
        "gdalwarp", "-overwrite",
        "-t_srs", f"EPSG:{epsg}",
        "-te", str(te_wgs[0]), str(te_wgs[1]), str(te_wgs[2]), str(te_wgs[3]),
        "-te_srs", "EPSG:4326",
        "-tr", "1", "1",
        "-r", "bilinear",
        "-of", "GTiff", "-co", "COMPRESS=DEFLATE", "-co", "TILED=YES",
        vrt, dem,
    ])
    # Record the CRS so downstream stages don't have to re-derive it.
    with open(os.path.join(work, "crs.txt"), "w") as f:
        f.write(str(epsg))
    print(f"[fetch] wrote {dem} (EPSG:{epsg})")


if __name__ == "__main__":
    sys.exit(main())
