# Deer Intel - Project Instructions

## Project

Deer Intel is a long-term hunting intelligence platform built with:

- Next.js 16 (App Router, Turbopack)
- TypeScript
- React
- Leaflet for the interactive map

Data lives in the browser (localStorage) via a small store in `lib/deerIntelStore`, so the app works fully offline and local-only by default. Cloud features are opt-in and env-gated.

The goal is to build an AI-assisted hunting application that learns each property over multiple seasons.

---

## Current Features

- **Today dashboard** — daily brief plus a live weather panel for the active property
- **Action-grouped sidebar navigation** — Today / Scout the land / Plan the hunt (replaces the old operating-mode bar)
- **Interactive Map** (Leaflet) — GPS, multiple pin types, hunt-area drawing, PA parcel / land-owner overlays, and **offline maps** (download a view or hunt area's tiles so the map still works in the field with no signal)
- **Properties** — a command center per property: the Overview leads with tonight's sit call, live conditions, stand wind fit, the hit list and rut phase (shared with Today via `lib/usePropertyToday`), with a Plan tab and an optional saved coordinate
- **Cameras** — sites, checks, and real photo uploads (client-resized, stored locally)
- **Stands** — type, wind notes, access/exit, and per-stand intelligence
- **Hunt Log** — log a sit (with live-weather auto-fill) and browse history
- **Deer profiles** — per-property tracked deer
- **Live Weather** (Open-Meteo, no API key) — current conditions, wind, moon phase, sunrise/sunset, barometric pressure with a cold-front cue, and a 3-day forecast; shown on the dashboard and property Overview, and auto-fills the hunt-log and camera-check forms
- **AI Scout** — rule-based insights plus opt-in LLM recommendations via `ANTHROPIC_API_KEY`
- **Optional accounts + cloud sync** — Supabase-backed, fully inert unless `NEXT_PUBLIC_SUPABASE_*` env vars are set

---

## Design System

- A **tactical** field look, dark by default: near-black surfaces, olive green for "good" (`--accent`), and blaze orange (`--accent-2`) saved for the one thing on a screen that matters (primary actions, alerts, the active tab). Light and red Night themes share the same tokens; users pick in Settings.
- Shape and type: square-ish corners (`--radius` 4px, `--radius-sm` 3px), thin `--border` lines instead of shadows, **Bebas Neue** for headings, tabs and buttons (`--font-display`, one weight — never rely on bold), Geist for body copy, and Geist Mono for small uppercase labels and numbers.
- All colors flow from **CSS design tokens** in `app/globals.css` (`--surface`, `--text`, `--accent`, `--accent-2`, semantic status colors, `--camo`, etc.). Style with tokens, not raw hex; use `var(--radius)` / `var(--radius-sm)` rather than pixel radii (round only for true dots).
- Woodland camo appears as an accent (sidebar brand, home hero, empty states) via the generated `--camo` SVG.
- Pages follow one pattern: a **compact header** (title, context, real actions) plus **tabs** (`components/ui/Tabs`) that lead with the primary view and tuck summaries/intelligence behind a click.
- Reusable primitives live in `components/ui` (Card, Button, Badge, Section, Tabs, StatCard, EmptyState, PageShell, Sidebar, …). Reuse them; keep new UI on the tokens.
- Map controls that sit on the satellite imagery stay dark and square for legibility in every theme.

---

## Coding Standards

- Use TypeScript everywhere.
- Keep components small and reusable.
- Do not duplicate code.
- Prefer functional React components.
- Keep styling consistent.
- Do not introduce unnecessary libraries.

---

## Development Workflow

Before making changes:

1. Read the existing code.
2. Make the smallest safe change.
3. Explain every modified file.
4. Verify the app builds successfully.
5. Do NOT commit unless explicitly asked.

---

## Long-Term Vision

This application will eventually include:

- Multiple hunting properties
- Trail camera management
- Stand management
- Hunt logging
- Weather history
- Wind history
- Moon phase
- Deer sightings
- Buck identification
- AI movement predictions
- Stand recommendations
- Property analytics

Always build features that support this long-term vision.
