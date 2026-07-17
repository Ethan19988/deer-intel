# Scout Rules Table (scored)

The behavioral knowledge behind [`scout_rules.py`](scout_rules.py), turned into a
scored, cross-referenced rule table. Each row is one prediction rule: what deer
behavior it encodes, the terrain/data **signal** that detects it, the feature
**kind** it emits, a **base weight**, its score **modifiers**, and a **confidence
tier**. The tier is the load-bearing column — it keeps GPS-collar-backed terrain
rules from being ranked next to contested weather folklore.

## Confidence tiers

| Tier | Meaning | Score factor |
|---|---|---|
| **A** | GPS-collar-backed and/or terrain-deterministic (readable straight from the DEM). Trust for *locating* features. | ×1.0 |
| **B** | Strong field/biological consensus, but needs data the DEM alone doesn't carry (landcover, mast, calendar). Trust for *ranking/timing*. | ×0.7 |
| **C** | Weak or contested in the research (multiple GPS studies find little/no effect). Expose to the user, but must not move a pick's rank. | ×0.3 (locating: ×0) |

Sources: Penn State Deer-Forest Study (GPS collars, PA big-woods); National Deer
Association GPS-collar summaries; Appalachian/mountain field tactics. Weather and
moon are rated C because 4+ GPS studies found little-to-no correlation with mature
buck movement.

## Scoring model

Replace the current ad-hoc per-kind scores with one formula so every pick is
ranked on the same 0–100 scale:

```
raw   = base_weight + Σ(modifier_i)      # terrain evidence for this candidate
score = clamp(raw, 0, 100) × tier_factor # discount by how much we trust the rule
```

`tier_factor` is the emitting rule's confidence factor above. Temporal/
environmental rules (T*, E*) are **multipliers on the final list**, applied per
hunt-date/context at request time — they re-rank, they never create a feature.

---

## A. Spatial rules (emit a feature — Tier A, from the DEM)

| ID | Deer behavior (basis) | Signal / detector | Kind | Base | Modifiers | Tier | Status |
|---|---|---|---|---|---|---|---|
| **B1** | Beds on steep S/SE–SW sidehills for thermal gain + downhill escape | `slope ∈ [18,45]°`, `aspect ∈ [112.5,247.5]`, `TPI>0`, landform ∈ {shoulder,spur,slope} | `bedding` | 40 | `+slope°`, `+area/1000`, `+10 if aspect within 20° of due S` | A | ✅ `bedding_mask` |
| **B2** | Beds on spur/point noses — ~270° view, wind at back, rising thermals bring scent from below | `geomorphon == SPUR` | `bedding` | 45 | `+slope°`, `+area/1000` | A | ✅ `is_spur` |
| **B3** | "Military crest" beds just under the ridgeline | landform ∈ {shoulder,spur} `AND` `TPI>0` `AND` within ~1 contour of local max | `bedding` | 38 | `+slope°` | A | ⚠️ partial (upper-TPI proxy only; no explicit sub-crest band) |
| **V1** | Travels benches/shelves at constant elevation instead of climbing ridges ("bed high, travel low") | `slope ≤ 12°` in a `≥16°` neighborhood, lower/mid elevation band, elongated blob | `travel` | 40 | `+length_m/50`, `+8 if elev ≤ 60th pctl` | A | ✅ `bench_mask` |
| **V2** | Uses drainages/draws as low-scent bed-to-feed corridors | stream/draw centerline vector | `travel` | 30 | `+length_m/50` | A | ✅ `streams.shp` |
| **P1** | Crosses ridges at their low gaps (saddles funnel travel between bedding areas) | opposite-sign curvature on a crest (saddle), `TPI>0`, ≥ 92nd-pctl strength | `pinch` | 50 | `+curvature_strength (normalized)` | A | ✅ `saddle_mask` |
| **R1** | Oldest bucks ride out pressure in steep ground far from roads | `slope ≥ 30°` `AND` `dist_road ≥ 900 m` | `refuge` | 45 | `+slope°`, `+area/8000` | A | ✅ `refuge_mask` |

## B. Spatial rules — gaps (Tier B, need extra data layers)

| ID | Deer behavior (basis) | Signal / detector (needed) | Kind | Base | Tier | Status |
|---|---|---|---|---|---|---|
| **F1** | Acorns are the #1 fall driver; white oak hit first, red oak holds later | oak presence/canopy — NLCD deciduous + user-tagged mast, or species raster | `feed` (new) | 45 | B | ❌ gap (no landcover layer) |
| **F2** | Clear-cut/regen lets deer bed **and** feed in one spot | recent cut / early-succession from NLCD change or imagery | `feed`/`bedding` | 40 | B | ❌ gap |
| **F3** | Travels blended hardwood↔softwood edges | landcover transition line | `travel` | 25 | B | ❌ gap |
| **S1** | "Goldilocks" security: hunters score at 500–1000 yd from road, deer vanish beyond | `dist_road` band `[450,900] m` as a **modifier on scored picks** | (modifier) | — | A→B | ✅ `security_bonus()` on bedding + pinch picks (travel corridors aren't scored picks); adds `roadDistM` + a security tag to the reason |

## C. Thermal / wind resolution (Tier A — deterministic, refines each pick)

| ID | Rule | Detector | Output | Tier | Status |
|---|---|---|---|---|---|
| **W1** | Best wind to hunt ground facing `aspect` = wind from opposite side | `reciprocal_wind(aspect)` | `bestWind` per pick | A | ✅ |
| **W2** | Morning thermals **sink** down draws/valleys; midday **rise** up slopes | slope aspect + hunt time-of-day | dawn vs midday scent-safe approach side | A | ✅ `thermal_note()` — aspect-directional on beds, generic on draws/benches/saddles |

---

## D. Temporal & environmental multipliers (re-rank the list at request time)

These do **not** emit features. Applied against the hunt date/conditions to push
the right kinds up the Scout Picks list. Wire to [`seasonCalendar.ts`](../../lib/seasonCalendar.ts).

| ID | Rule (basis) | Trigger | Effect on ranking | Tier |
|---|---|---|---|---|
| **T1** | Crepuscular peaks are hard-wired (dawn/dusk) | time-of-day | boost travel/pinch near legal light | A |
| **T2** | Pre-rut/seeking (≈Oct 20–31): bucks cover ground, scrapes peak | date | +20% `pinch`, +15% `travel` | B |
| **T3** | Chasing (≈Nov 1–10): most daylight movement of the year | date | +30% `pinch` + `travel` (benches/saddles) | B |
| **T4** | Lockdown/peak breed (≈Nov 7–16): bucks hole up with does in thick remote cover | date | +25% `refuge`/`bedding`, −20% open `travel` | B |
| **T5** | Post-rut/late season: return hard to best remaining mast + sheltered slopes | date | +feed (F1/F2) and S-facing `bedding` | B |
| **T6** | Hunting pressure: at ~1 hunter/75 ac, bucks shift to thick cover within ~3 days but stay in core area | pressure/opener+3d | +20% `refuge`, favor B3 sub-crest beds | A |
| **E1** | Temperature/cold front — weakest measurable weather link; near-null in collar data | temp drop | ≤ ±5% only; surface as a note | C |
| **E2** | Barometric pressure — inconsistent across datasets, partly confounded with rut | rapid drop | display cue, no rank change | C |
| **E3** | Moon phase — no correlation in 4 GPS studies | any | **0** — display only | C |

---

## What to build next (highest leverage)

1. **S1** — apply the `dist_road` security band as a modifier to *all* spatial
   picks, not just refuge. Cheap (road layer already optional) and Tier-A.
2. **W2** — one `thermal_vector(aspect, hour)` helper feeding every pick's wind
   note; turns the current draw-only dawn hint into a general rule. Tier-A.
3. **T2–T6** — date-driven re-rank against `seasonCalendar.ts`. No new terrain
   data; big relevance gain during the season.
4. **F1** — a `feed` kind from NLCD deciduous + user-tagged oaks. Biggest content
   gap (mast is the #1 fall driver) but needs a landcover layer.

Everything stays framed as **predicted — go confirm**; picks are scouting leads.
