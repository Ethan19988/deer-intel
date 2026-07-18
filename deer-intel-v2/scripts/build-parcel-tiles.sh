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
# The counties that publish complete owner-level parcels. Most PA counties
# don't, so this is not "all 67". Read straight from fetch-parcels-geojson.mjs
# rather than restated here: this list used to be hardcoded and silently fell
# out of sync, so counties added to the fetcher never reached the archive.
COUNTIES="${COUNTIES:-$(node "$HERE/fetch-parcels-geojson.mjs" --list)}"

mkdir -p "$WORK"

inputs=()
labelInputs=()
failed=()
for county in $COUNTIES; do
  ndjson="$WORK/$county.ndjson"
  echo ">> fetching $county"
  # A single county service can hiccup mid-stream (large counties occasionally
  # trip an undici assertion), so retry each a few times. One county that stays
  # down is skipped with a warning rather than aborting the whole build.
  ok=0
  labels="$WORK/$county.labels.ndjson"
  for attempt in 1 2 3; do
    if NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}" \
        node "$HERE/fetch-parcels-geojson.mjs" "$county" "$ndjson" "$labels"; then
      ok=1
      break
    fi
    echo "   attempt $attempt for $county failed; retrying in 10s"
    sleep 10
  done
  if [ "$ok" -eq 1 ]; then
    inputs+=("$ndjson")
    [ -s "$labels" ] && labelInputs+=("$labels")
  else
    echo "WARNING: giving up on $county after 3 attempts; excluding it"
    failed+=("$county")
  fi
done

if [ "${#inputs[@]}" -eq 0 ]; then
  echo "ERROR: no counties fetched successfully" >&2
  exit 1
fi
if [ "${#failed[@]}" -gt 0 ]; then
  echo ">> NOTE: excluded counties after retries: ${failed[*]}"
fi

echo ">> building tiles -> $OUT"
# Two layers: the parcel polygons, and one point per owner holding carrying the
# label anchor. The anchor has to be baked because tiles clip polygons at their
# seams — a centre derived from a clipped piece moves when the pieces do, which
# is what made big tracts wander and print their name more than once. A point
# belongs to exactly one tile, so the name lands in one place at every zoom.
layerArgs=()
for f in "${inputs[@]}"; do layerArgs+=(-L "parcels:$f"); done
for f in "${labelInputs[@]}"; do layerArgs+=(-L "parcel_labels:$f"); done
echo ">> layers: ${#inputs[@]} parcel files, ${#labelInputs[@]} label files"

tippecanoe -o "$OUT" -n "PA Parcels" \
  -Z12 -z15 \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --simplification=4 \
  --force "${layerArgs[@]}"

echo ">> done: $(du -h "$OUT" | cut -f1) $OUT"
