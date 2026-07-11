#!/usr/bin/env bash
# Builds the statewide parcel vector tiles (public/data/pa-parcels.pmtiles) that
# the "Land Owners — Statewide" map layer renders.
#
# Pipeline:
#   1. fetch-parcels-geojson.mjs pulls each county's parcels (geometry + the
#      shared { owner, acres, pin, addr, pub } schema) into newline-delimited
#      GeoJSON.
#   2. tippecanoe packs them into one PMTiles archive, keyed by the `parcels`
#      layer, zoom 12–15 (overzoomed past 15 at render time).
#
# Requirements: node, tippecanoe (https://github.com/felt/tippecanoe), and
# network access to the county services. Behind the agent proxy, run the fetch
# step with NODE_USE_ENV_PROXY=1.
#
# Usage:
#   scripts/build-parcel-tiles.sh                 # default POC counties
#   COUNTIES="franklin adams" scripts/build-parcel-tiles.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
WORK="${WORK:-$ROOT/.parcel-build}"
OUT="$ROOT/public/data/pa-parcels.pmtiles"
# The counties that publish complete owner-level parcels (see
# discover-parcel-fields.mjs). Most PA counties don't, so this is not "all 45".
COUNTIES="${COUNTIES:-franklin adams dauphin butler bedford juniata fulton berks bucks cameron chester forest montgomery wyoming york bradford}"

mkdir -p "$WORK"

inputs=()
for county in $COUNTIES; do
  ndjson="$WORK/$county.ndjson"
  echo ">> fetching $county"
  NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}" \
    node "$HERE/fetch-parcels-geojson.mjs" "$county" "$ndjson"
  inputs+=("$ndjson")
done

echo ">> building tiles -> $OUT"
tippecanoe -o "$OUT" -l parcels -n "PA Parcels" \
  -Z12 -z15 \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --force "${inputs[@]}"

echo ">> done: $(du -h "$OUT" | cut -f1) $OUT"
