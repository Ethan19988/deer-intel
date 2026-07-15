# lib/generated

Terrain-movement predictions produced by the offline pipeline
(`pipeline/terrain/`). **Drop `terrain_movement.<name>.json` files here** — they
are auto-registered into the map + AI Scout, no code edits needed.

How it works:

1. The pipeline's `scout_rules.py` writes `terrain_movement.<name>.json`
   (matching `TerrainMovementSet`) into this folder.
2. `scripts/build-terrain-index.mjs` scans them and regenerates
   `terrainSets.ts`, a typed barrel exporting `GENERATED_TERRAIN_SETS`.
3. `lib/terrainMovementData.ts` spreads that into `TERRAIN_SETS`, so the map
   layer, Scout Picks panel, and AI Scout page pick the set up by location.

The index regenerates on `npm run terrain:index`, on `npm run build` (prebuild),
and automatically at the end of the pipeline's `run.sh`.

- `terrainSets.ts` is generated — do not edit by hand.
- Commit the `terrain_movement.*.json` files so deployed builds include them.
- `scout_picks.*.json` and `*.geojson` outputs are for reference/GIS and are not
  imported by the app.
