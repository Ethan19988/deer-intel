# Deer Intel Development Guide

## Purpose

Deer Intel is a personal hunting intelligence platform designed to help manage hunting properties, cameras, stands, hunt logs, weather, wind, deer movement, and AI-based hunting recommendations.

The long-term goal is to build an app that learns each property over multiple seasons and helps answer:

* Where should I hunt today?
* What stand is best for this wind?
* What camera has the most activity?
* What deer movement patterns are showing up?
* What access route gives me the best chance without bumping deer?

---

# Current Stack

* Next.js 16
* React
* TypeScript
* GitHub
* VS Code
* Codex support through AGENTS.md

---

# Current Working Features

* Dashboard
* Interactive map
* GPS location
* Multiple pin types
* Properties page
* Add Property form
* Routes for:

  * Properties
  * AI Scout
  * Cameras
  * Stands
  * Hunt Log

---

# Core Product Areas

## Properties

Each property should track:

* Name
* County or region
* Acres
* Notes
* Access notes
* Terrain notes
* Food sources
* Bedding areas
* Water sources
* Pressure level
* Seasonal observations

## Cameras

Each camera should track:

* Property
* Camera name
* GPS location
* Status
* Last checked date
* Battery
* SD card
* Notes
* Deer sightings
* Buck sightings
* Travel direction
* Weather conditions during activity

## Stands

Each stand should track:

* Property
* Stand name
* Stand type
* GPS location
* Height
* Best wind
* Bad wind
* Entry route
* Exit route
* Notes
* Hunt history

## Hunt Log

Each hunt should track:

* Date
* Property
* Stand
* Start time
* End time
* Temperature
* Wind direction
* Wind speed
* Weather
* Moon phase
* Deer seen
* Bucks seen
* Does seen
* Shots taken
* Harvest result
* Notes

## AI Scout

AI Scout should eventually recommend:

* Best property
* Best stand
* Best access route
* Best time to hunt
* Confidence score
* Reasoning

AI Scout should consider:

* Wind
* Temperature
* Weather
* Time of year
* Rut phase
* Camera activity
* Hunt pressure
* Historical movement
* Stand access
* Bedding areas
* Food sources

---

# Development Rules

When working on Deer Intel:

1. Read AGENTS.md first.
2. Read ROADMAP.md.
3. Read PROJECT.md.
4. Use this DEVELOPMENT_GUIDE.md as the master product guide.
5. Make small, safe changes.
6. Keep TypeScript clean.
7. Avoid unnecessary libraries.
8. Keep components reusable.
9. Do not commit unless specifically told.
10. Explain all file changes.

---

# Recommended Folder Structure

app/

* Main Next.js routes

components/

* Reusable UI components

components/cards/

* Property cards
* Camera cards
* Stand cards
* Hunt cards

components/forms/

* Property forms
* Camera forms
* Stand forms
* Hunt log forms

components/map/

* Map controls
* Pin tools
* GPS tools

hooks/

* Reusable React hooks

lib/

* Storage helpers
* Date helpers
* Weather helpers
* AI logic helpers

types/

* Shared TypeScript types

data/

* Default demo data

---

# Storage Plan

Early versions should use localStorage.

Later versions may use:

* IndexedDB
* Supabase
* Firebase
* PostgreSQL
* Cloud sync

For now, localStorage is enough for v0.4.

---

# Version Roadmap

## v0.4 — Data Foundation

* Save properties to localStorage
* Edit properties
* Delete properties
* Add cameras
* Add stands
* Add hunt logs

## v0.5 — Map Integration

* Link properties to map
* Link cameras to map
* Link stands to map
* Save pins
* Add bedding, food, rubs, scrapes, access routes

## v0.6 — Trail Camera Intelligence

* Camera history
* Deer movement logs
* Buck tracking
* Travel direction
* Time-based activity

## v0.7 — Weather and Wind

* Wind tracking
* Temperature tracking
* Weather history
* Cold front alerts
* Stand wind recommendations

## v0.8 — AI Scout

* Best stand recommendations
* Best property recommendations
* Confidence scoring
* Reasoning explanations

## v1.0 — Full Deer Intel Platform

* Complete property management
* Complete map system
* Complete hunt log
* AI Scout
* Mobile-friendly interface
* Backup/export/import
* Long-term hunting analytics

---

# Main Rule

Build Deer Intel like a real long-term hunting platform, not a quick demo.

