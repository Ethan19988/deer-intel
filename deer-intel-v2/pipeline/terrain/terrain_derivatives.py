#!/usr/bin/env python3
"""Stage 1 — terrain derivatives from the DEM, via WhiteboxTools.

Produces the raster layers the rule engine scores:
  geomorphons.tif  — 10-class landform (ridge/spur/saddle/slope/hollow/valley/…)
  slope.tif        — slope in degrees
  aspect.tif       — aspect in degrees (0=N, clockwise)
  tpi.tif          — topographic position (ridge/upper-slope vs. valley)
  streams.tif      — drainage/draw network from flow accumulation

Reads work/<name>/dem.tif (metric CRS from Stage 0).

Usage:
  python3 terrain_derivatives.py --name moore-hill
"""
from __future__ import annotations

import argparse
import os
import sys

import whitebox


# Geomorphon search radius (cells). With a 1 m DEM, ~50 captures hunter-scale
# landforms (a bench, a spur nose) without dissolving into micro-relief.
GEOMORPHON_SEARCH = 50
# Draw sensitivity: how many upslope cells must drain through a cell before it
# counts as a channel. Lower = more (smaller) draws. Tune per property.
STREAM_THRESHOLD = 4000


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--geomorphon-search", type=int, default=GEOMORPHON_SEARCH)
    ap.add_argument("--stream-threshold", type=int, default=STREAM_THRESHOLD)
    args = ap.parse_args()

    work = os.path.abspath(os.path.join("work", args.name))
    dem = os.path.join(work, "dem.tif")
    if not os.path.exists(dem):
        raise SystemExit(f"missing {dem} — run fetch_dem.py first")

    wbt = whitebox.WhiteboxTools()
    wbt.set_working_dir(work)
    wbt.verbose = False

    def out(name: str) -> str:
        return name  # WhiteboxTools writes relative to working dir

    print("[wbt] geomorphons")
    wbt.geomorphons(
        dem="dem.tif",
        output=out("geomorphons.tif"),
        search=args.geomorphon_search,
        threshold=0.0,
        forms=True,  # classify into the 10 landform forms
    )

    print("[wbt] slope / aspect")
    wbt.slope(dem="dem.tif", output=out("slope.tif"), units="degrees")
    wbt.aspect(dem="dem.tif", output=out("aspect.tif"))

    print("[wbt] topographic position (TPI)")
    # Deviation from mean elevation over a neighborhood ~ ridge (+) vs valley (−).
    wbt.dev_from_mean_elev(
        dem="dem.tif", output=out("tpi.tif"), filterx=51, filtery=51
    )

    print("[wbt] hydro-condition + flow accumulation + streams")
    wbt.breach_depressions_least_cost(dem="dem.tif", output="dem_filled.tif", dist=100)
    wbt.d8_pointer(dem="dem_filled.tif", output="d8pntr.tif")
    wbt.d8_flow_accumulation(i="dem_filled.tif", output="flowacc.tif", out_type="cells")
    wbt.extract_streams(
        flow_accum="flowacc.tif",
        output=out("streams.tif"),
        threshold=args.stream_threshold,
    )
    # Vectorize the draw network into clean centerlines for the travel corridors.
    wbt.stream_link_identifier(
        d8_pntr="d8pntr.tif", streams="streams.tif", output="streamlink.tif"
    )
    wbt.raster_streams_to_vector(
        streams="streamlink.tif", d8_pntr="d8pntr.tif", output="streams.shp"
    )

    print(f"[wbt] derivatives written to {work}")


if __name__ == "__main__":
    sys.exit(main())
