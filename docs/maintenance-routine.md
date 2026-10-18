# Deer Intel — Maintenance Sweep Routine

A recurring, unattended review of the whole app: code health, production
runtime signals, a read-only walkthrough of the live website, and a
roadmap-vs-reality check. Findings accumulate in a living `MAINTENANCE.md`
backlog on the `claude/maintenance-log` branch — the sweep never changes
application code, never opens issues or PRs.

This file is the reference for configuring the Routine in the claude.ai
Routines UI (claude.ai → Routines), which is where connectors can be
attached. A connector-less version created in-session already exists under
the name **"Deer Intel — maintenance sweep (Mon/Wed/Fri)"** — when the UI
version is live, disable or delete the in-session one so the sweep doesn't
run twice.

## Settings

| Field | Value |
|---|---|
| **Name** | Deer Intel — maintenance sweep (Mon/Wed/Fri) |
| **Schedule** | Mon / Wed / Fri, 13:00 UTC (9am ET / 6am PT) |
| **Session** | New session each run |
| **Repository** | `Ethan19988/deer-intel` |
| **Connectors** | GitHub · Vercel · Supabase |
| **Notifications** | Push on |

## Environment variables (for the live-site login)

Set these as environment secrets on the execution environment — never in
the prompt, never committed:

- `DEER_INTEL_TEST_EMAIL` — a **dedicated throwaway test account** for
  https://deer-intel-fghk-deer-intel.vercel.app/login (not a real
  hunter's account; confirm its email once if Supabase requires it)
- `DEER_INTEL_TEST_PASSWORD`

If either is missing, the sweep skips the logged-in pages and only checks
that the public login page renders — everything else still runs.

## Routine prompt

Paste this as the Routine's prompt, verbatim:

```text
You are running an automated, unattended MAINTENANCE SWEEP for the Deer Intel app (GitHub repo Ethan19988/deer-intel; the active app lives in deer-intel-v2/, a Next.js 16 + TypeScript + React app; data is local-first via lib/deerIntelStore with opt-in Supabase/Vercel). Your job is to INSPECT and REPORT — do NOT change application behavior and do NOT write real data through the live site.

Do a thorough pass across these areas:

1) CODE HEALTH — In deer-intel-v2/: run `npm install`, then `npx tsc --noEmit`, `npx eslint`, and `npm run build` if it completes in reasonable time. Capture real errors/warnings (show actual output, don't paraphrase away failures). Review the last several days of commits on origin/main for regressions, dead/duplicated code, leftover TODOs, and inconsistencies with the coding standards in AGENTS.md.

2) RUNTIME + DATA — If the Vercel and Supabase MCP tools are available, use Vercel to check recent runtime errors, runtime logs, and web analytics, and use Supabase get_advisors (security + performance) and recent logs. If those tools are NOT reachable in this session, note that briefly and move on — don't fail the sweep.

3) LIVE WEBSITE WALKTHROUGH (read-only) — The deployed app is at https://deer-intel-fghk-deer-intel.vercel.app with email+password auth at /login. Chromium + Playwright are preinstalled (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers; do not run `playwright install`). Write and run a headless Playwright script that:
   - Loads /login and confirms it renders; capture console errors, uncaught exceptions, and failed (4xx/5xx) network requests. If the URL is blocked by Vercel deployment protection (SSO interstitial), note that and stop the walkthrough.
   - Reads test credentials from process.env.DEER_INTEL_TEST_EMAIL and process.env.DEER_INTEL_TEST_PASSWORD. If either is missing/empty, record "no test credentials configured — authenticated pages skipped", review only the public login page, and continue the rest of the sweep.
   - If credentials are present, log in through the form, then visit each main route: /, /map, /cameras, /cameras/import, /properties, /stands, /hunt-log, /hit-list, /party, /ai, /settings (confirm against the app/ directory). For each page confirm it renders without crashing and collect console errors, uncaught exceptions, and failed network requests.
   - STRICTLY read-only: navigate and observe only. Do NOT submit forms, upload photos, or create/edit/delete any data. Do not interact with destructive controls.
   Report every page that errors, renders broken, or logs console/network errors, with the specific detail.

4) PRODUCT / ROADMAP — Read ROADMAP.md and PROJECT.md and compare against the current code. Note roadmap items that are missing, half-finished, or worth prioritizing next.

Then record findings in a LIVING BACKLOG:
- Work on the dedicated branch `claude/maintenance-log` (create it from origin/main if it doesn't exist; otherwise fetch and update the existing file — keep all prior dated entries).
- Update `MAINTENANCE.md` at the repo root: prepend a new section headed with today's date. Categorize findings as: **Broken now**, **Should fix**, **Nice to have**, **Roadmap gaps** — each item one line with a file reference (path:line) or the affected route where relevant. If nothing new is wrong in a category, say "nothing new."
- Commit and push ONLY `MAINTENANCE.md` to `claude/maintenance-log` (force-with-lease is fine — it's a living log). Do NOT modify application code, do NOT open GitHub issues, and do NOT open pull requests. Never commit credentials.

Finish with a concise summary of the top 3–5 findings so it lands in the completion notification. Be honest and specific: real errors with their output, or a brief "clean, nothing new" if that's the truth.
```

## How findings are consumed

Each run prepends a dated section to `MAINTENANCE.md` on the
`claude/maintenance-log` branch, categorized as **Broken now / Should fix /
Nice to have / Roadmap gaps**, and sends a push notification with the top
3–5 findings. To act on the backlog, start a Claude Code session and point
it at an item — the sweep itself deliberately never fixes anything.
