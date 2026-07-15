#!/usr/bin/env bash
# Orchestrate the full terrain-movement pipeline for one property.
#
# Usage:
#   ./run.sh <name> <minLng> <minLat> <maxLng> <maxLat> [roads.geojson]
#
# Example (Moore Hill, Lyme Emporium Highlands tract):
#   ./run.sh moore-hill -78.3322 41.4495 -78.3062 41.4695
set -euo pipefail

NAME="${1:?name required}"
MINLNG="${2:?minLng required}"
MINLAT="${3:?minLat required}"
MAXLNG="${4:?maxLng required}"
MAXLAT="${5:?maxLat required}"
ROADS="${6:-}"

OUT="../../lib/generated"

echo "=== [1/3] fetch DEM ==="
python3 fetch_dem.py --name "$NAME" --bbox "$MINLNG" "$MINLAT" "$MAXLNG" "$MAXLAT"

echo "=== [2/3] terrain derivatives ==="
python3 terrain_derivatives.py --name "$NAME"

echo "=== [3/3] rules + scout picks ==="
if [[ -n "$ROADS" ]]; then
  python3 scout_rules.py --name "$NAME" --out "$OUT" --roads "$ROADS"
else
  python3 scout_rules.py --name "$NAME" --out "$OUT"
fi

echo "=== [4/4] register with app ==="
# Auto-import: rebuild the typed index so the new JSON is picked up with no code
# edit. Needs Node (the app's toolchain); best-effort if it isn't on this box.
if command -v node >/dev/null 2>&1; then
  ( cd ../.. && node scripts/build-terrain-index.mjs )
else
  echo "node not found — run 'npm run terrain:index' in the app to register it"
fi

echo "=== done ==="
echo "terrain_movement.$NAME.json + scout_picks.$NAME.json written to $OUT"
