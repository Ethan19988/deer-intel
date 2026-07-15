#!/usr/bin/env bash
# Run the terrain pipeline for every property in a manifest exported from the app
# (Properties page -> "Export for terrain pipeline" -> properties.json).
#
# Usage:
#   ./run_all.sh properties.json
set -euo pipefail

MANIFEST="${1:?path to properties.json required}"
command -v node >/dev/null 2>&1 || {
  echo "node is required to read the manifest"; exit 1;
}

# Emit one tab-separated line per property, then run the pipeline for each.
node -e '
const fs = require("fs");
const items = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const p of items) {
  process.stdout.write([p.slug, p.minLng, p.minLat, p.maxLng, p.maxLat].join("\t") + "\n");
}
' "$MANIFEST" | while IFS=$'\t' read -r slug minLng minLat maxLng maxLat; do
  echo "=================== $slug ==================="
  ./run.sh "$slug" "$minLng" "$minLat" "$maxLng" "$maxLat"
done

echo "=== all properties done ==="
