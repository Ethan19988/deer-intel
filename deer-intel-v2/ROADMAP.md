# Deer Intel Roadmap

> Long-term vision: Build the most intelligent personal hunting platform for managing properties, trail cameras, stands, hunt history, and AI-powered hunting recommendations.

---

# Current Version

## ✅ v0.6 — real data, real weather, redesigned

The app is a working local-first application: properties, cameras, stands,
hunts, deer, and photos are all saved (localStorage) and browsable, the map
ties assets together, and live weather is wired throughout.

### Platform
- [x] Modern light UI theme (Realtree EDGE aesthetic) on a CSS design-token system
- [x] Action-grouped sidebar navigation
- [x] Consistent per-page layout: compact header + tabs
- [x] Optional accounts + cloud sync (Supabase, env-gated)
- [x] GitHub repository + Vercel deploys

### Properties
- [x] Property list, add, edit, delete
- [x] Save to localStorage
- [x] Optional saved coordinate (lat/lng)
- [x] Property statistics (summary, knowledge score)

### Cameras
- [x] Add camera, details, status (Active/Inactive)
- [x] Last checked date, battery level, SD card status
- [x] Camera checks + real photo uploads (client-resized, stored locally)

### Stands
- [x] Add stand, stand type
- [x] Access / exit notes, wind restrictions
- [x] Per-stand intelligence summary

### Hunt Log
- [x] Add hunt by property and stand
- [x] Weather, wind, temperature, moon phase (live auto-fill)
- [x] Deer seen, results / harvest notes

---

# v0.5 — Mapping (mostly done)

- [x] Camera + stand + asset locations on the map
- [x] Bedding, food, water, rub lines, scrapes, access routes, waypoints (pin types)
- [x] Property hunt-area boundary drawing
- [x] PA parcel + land-owner overlays
- [x] Offline maps — download a view or hunt area's tiles for use with no signal

---

# v0.6 — Trail Camera Intelligence (in progress)

- [x] Camera history (checks)
- [x] Photo uploads
- [ ] Buck identification (deer profiles are manual today)
- [ ] Doe tracking
- [ ] Travel direction
- [ ] Time analysis
- [ ] Seasonal comparisons

---

# v0.7 — Hunting Intelligence (in progress)

- [x] Sunrise / sunset
- [x] Moon phase
- [x] Barometric pressure + cold-front cue
- [x] 3-day forecast
- [ ] Weather history (currently current-conditions only)
- [ ] Wind history

---

# v0.8 — AI Scout (started)

- [x] Rule-based property insights
- [x] Opt-in LLM recommendations via `ANTHROPIC_API_KEY`
- [ ] Best property / best stand / best access route with confidence + reasoning
- [ ] Recommendations that weigh weather, wind, cameras, hunt history, and time of year

---

# v0.9 — Analytics

- [ ] Deer movement heat maps
- [ ] Camera statistics
- [ ] Stand success rates
- [ ] Hunt success reports
- [ ] Buck movement history

---

# v1.0

Complete Deer Intel platform.

- [x] Multiple hunting properties
- [x] Local-first / offline capable
- [x] Mobile-friendly interface
- [x] Data export / import (backup & restore in Settings)
- [ ] Full AI hunting assistant
- [ ] Season reports
