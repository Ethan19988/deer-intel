# Terrain Movement Pipeline

Turns a bare-earth **LiDAR DEM** into Deer Intel's terrain-movement predictions —
likely bedding, travel corridors, saddle/pinch crossings, and security refuge —
plus a ranked **Scout Picks** list, all grounded in the Penn State Deer-Forest
Study findings.

It runs **offline** (not in the app / not in the browser) on a Linux box with
GDAL + [WhiteboxTools](https://www.whiteboxgeo.com/). Its output JSON matches the
shape the app already renders (`lib/terrainMovement.ts` → `TerrainMovementSet`),
so a finished run drops straight into the map with no UI change.

```
DEM (1 m LiDAR)  ──►  terrain derivatives  ──►  Penn State rule engine  ──►  GeoJSON + Scout Picks
   fetch_dem.py        terrain_derivatives.py        scout_rules.py            → app + list
```

## Why these rules (sources)

Encoded from the Penn State Deer-Forest Study (GPS-collar data, PA big-woods):

- Deer bed on **steep sidehills / spur points / benches** with cover above an
  open slope — early warning + downhill escape. (hillside-does-hiding-spot)
- In cold they favor **south-facing slopes** for thermal gain (up to 6× solar,
  ~40 °F warmer than north). (changes-in-attitude-not-altitude)
- They use **steep ground far from roads** as security; hunters succeed on
  **10–20° slopes, 500–1,000 yd from a road** and vanish beyond that.
  (goldilocks, shift-or-shrink)
- **Drainages/draws** carry bed-to-feed travel; **saddles** funnel ridge crossings.

## Install (Linux)

```bash
# GDAL CLI (gdalwarp, gdalbuildvrt) must be on PATH:
sudo apt-get install -y gdal-bin
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # rasterio, numpy, scipy, shapely, whitebox, requests, pyproj
```

`whitebox` downloads the WhiteboxTools binary on first run.

## Run

```bash
# One property, by name + bounding box (minLng,minLat,maxLng,maxLat, WGS84):
./run.sh moore-hill -78.3322 41.4495 -78.3062 41.4695
```

Or step by step:

```bash
python3 fetch_dem.py         --name moore-hill --bbox -78.3322 41.4495 -78.3062 41.4695
python3 terrain_derivatives.py --name moore-hill
python3 scout_rules.py       --name moore-hill \
        --roads roads.geojson \            # optional OSM/PennDOT roads for distance-to-road
        --out ../../lib/generated
```

## Outputs (`work/<name>/` and `--out`)

| File | Purpose |
|---|---|
| `terrain_movement.<name>.json` | `TerrainMovementSet` — import into the app map layer |
| `scout_picks.<name>.json` | Ranked list: type, lat/lng, reason, best wind, confidence |
| `terrain_movement.<name>.geojson` | Full FeatureCollection for GIS / QA |
| `work/<name>/*.tif` | Intermediate rasters (DEM, slope, aspect, geomorphons, streams…) |

## Wire the result into the app (automatic)

`run.sh` writes `terrain_movement.<name>.json` straight into `../../lib/generated`
and then rebuilds the app's terrain index, so the new property is picked up with
**no code edit** — the map's Terrain layer, the Scout Picks panel, and the AI
Scout page all resolve it by location. (If Node isn't on this box, run
`npm run terrain:index` in the app once to register it.) Commit the JSON so
deployed builds include it.

## Data notes

- **1 m DEM source**: USGS 3DEP (The National Map API) or PASDA (PAMAP). Falls back
  to 10 m NED where 1 m is absent.
- **Resolution matters**: at 1 m the benches/saddles/spurs are sharp. The sample
  currently in the app was built from 10 m data (coarse but real) — this pipeline
  replaces it with the fine read.
- Everything is framed as **predicted — go confirm**. Treat picks as scouting
  leads, not guarantees.
