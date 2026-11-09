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
# Owner history: set PARCEL_HISTORY_IN to a folder of last build's per-county
# owner snapshots (<county>.json.gz) and parcels that changed hands since are
# marked in the tiles (`prev`, `chg`). This build's snapshots are written to
# PARCEL_HISTORY_OUT (default $WORK/history-next) for the next build to read.
# With no snapshots (the first build) nothing is marked.
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

HISTORY_IN="${PARCEL_HISTORY_IN:-}"
HISTORY_OUT="${PARCEL_HISTORY_OUT:-$WORK/history-next}"
mkdir -p "$WORK" "$HISTORY_OUT"

# Counties are fetched a few at a time (FETCH_JOBS, default 4): the fetch is
# almost all waiting on county servers, and with 50+ counties one-at-a-time
# no longer fits the workflow's time limit. Each county's outcome is recorded
# in a marker file so results are collected in county order afterwards.
FETCH_JOBS="${FETCH_JOBS:-4}"

fetch_county() {
  local county="$1"
  local ndjson="$WORK/$county.ndjson"
  local labels="$WORK/$county.labels.ndjson"
  local errlog="$WORK/$county.err"
  rm -f "$WORK/$county.ok" "$WORK/$county.failed"
  echo ">> fetching $county"
  # A single county service can hiccup mid-stream (large counties occasionally
  # trip an undici assertion), so retry each a few times. One county that stays
  # down is skipped with a warning rather than aborting the whole build.
  local attempt status
  for attempt in 1 2 3; do
    # Each attempt is capped (COUNTY_TIMEOUT seconds, default 2 h — Maryland's
    # statewide layer is the slowest) so one stuck county can't run the job
    # into the workflow time limit and lose every other county's work.
    if NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}" \
        PARCEL_HISTORY_IN="$HISTORY_IN" PARCEL_HISTORY_OUT="$HISTORY_OUT" \
        timeout --kill-after=60 "${COUNTY_TIMEOUT:-7200}" \
        node "$HERE/fetch-parcels-geojson.mjs" "$county" "$ndjson" "$labels" \
        2> >(tee "$errlog" >&2); then
      touch "$WORK/$county.ok"
      return 0
    else
      status=$?
    fi
    # Timed out (124, or 137 after the kill): a second try would just eat the
    # rest of the job's time, so give up on this county now.
    if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
      echo "   $county timed out after ${COUNTY_TIMEOUT:-7200}s; not retrying"
      echo "FAILED: timed out" >> "$errlog"
      break
    fi
    echo "   attempt $attempt for $county failed; retrying in 10s"
    sleep 10
  done
  echo "WARNING: giving up on $county; excluding it"
  # A GitHub annotation (not just a log line) so a dropped county shows on
  # the run summary instead of silently vanishing from the map.
  local reason
  reason="$(grep -m1 'FAILED:' "$errlog" 2>/dev/null || tail -n1 "$errlog" 2>/dev/null)"
  echo "::warning title=Parcel county skipped::$county excluded from tiles after 3 attempts: ${reason:-unknown error}"
  # Keep the skipped county's last snapshot so its history isn't lost (its
  # parcels aren't in this archive, so there's nothing to compare against).
  if [ -n "$HISTORY_IN" ] && [ -s "$HISTORY_IN/$county.json.gz" ]; then
    cp "$HISTORY_IN/$county.json.gz" "$HISTORY_OUT/$county.json.gz"
  fi
  touch "$WORK/$county.failed"
}

for county in $COUNTIES; do
  while [ "$(jobs -rp | wc -l)" -ge "$FETCH_JOBS" ]; do
    wait -n || true
  done
  fetch_county "$county" &
done
wait

inputs=()
labelInputs=()
failed=()
for county in $COUNTIES; do
  if [ -e "$WORK/$county.ok" ]; then
    inputs+=("$WORK/$county.ndjson")
    [ -s "$WORK/$county.labels.ndjson" ] && labelInputs+=("$WORK/$county.labels.ndjson")
  else
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
