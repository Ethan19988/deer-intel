# Deer Intel — Maintenance Sweep

A recurring, unattended, **read-only** check of the app. It looks at Vercel
builds, runtime errors and Supabase advisors, loads the live site's main
pages, and reviews the past week's commits. The report arrives as a push
notification. The sweep never changes app code, never opens issues or
PRs, and never pushes branches.

It runs as the scheduled task **"Deer Intel — maintenance sweep
(Mon/Wed/Fri)"** in claude.ai.

## Settings

| Field | Value |
|---|---|
| **Name** | Deer Intel — maintenance sweep (Mon/Wed/Fri) |
| **Schedule** | Mon / Wed / Fri, 8:47am America/New_York (`CRON_TZ=America/New_York 47 8 * * 1,3,5`) |
| **Session** | New session each run |
| **Repository** | `Ethan19988/deer-intel` |
| **Connectors** | **Vercel** and **Supabase**. Attach them in the task's settings in claude.ai; they can't be added from a session. Without them, the build, runtime and page checks report "Skipped". |
| **Notifications** | Push on |

## Why it works this way

Scheduled sessions run in a cloud workspace that blocks npm downloads and
most web requests from the shell. The earlier version ran `npm install`,
`tsc`, `eslint` and `next build`, so it failed at the first step. It also
tried to push a log branch that was never created. This version:

- reads build results from Vercel, which type-checks and builds every
  commit anyway;
- checks live pages through the Vercel connector (`web_fetch_vercel_url`)
  instead of the shell;
- reviews code with plain `git` (log, diff, grep), so nothing needs
  installing;
- puts the full report in its final message, which becomes the
  notification. It no longer saves a copy to `MAINTENANCE.md`: scheduled
  sessions aren't allowed to push, so every run reported "log not saved".
- skips findings that were checked and are intended (see "Known and
  intended" in the prompt), so every report doesn't repeat them.

## Task prompt

This is the prompt stored on the scheduled task. Keep the two in sync if
you change it.

```text
You are running an automated, unattended, READ-ONLY maintenance sweep for the Deer Intel app.

Facts:
- GitHub repo: Ethan19988/deer-intel. The app lives in deer-intel-v2/ (Next.js 16, TypeScript, React, Leaflet; data is local-first in lib/deerIntelStore with optional Supabase sync).
- Live site: https://deer-intel.vercel.app (the old deer-intel-fghk.vercel.app address should permanently redirect there).
- Vercel project: deer-intel-fghk (id prj_2PlMzfuQudpKYI2HYmzQ6i0krbfn), team slug deer-intel.
- This cloud session blocks npm downloads and most outbound web requests from the shell. Do NOT run npm install, tsc, eslint or next build, and do not retry shell network requests. Vercel already type-checks and builds every commit, so read build results from Vercel instead.

Never change application code, never write data through the site, never open issues or PRs, never push branches. If a step's tool is unavailable, write one line saying so and move on. A missing tool is not a failure of the sweep.

Known and intended (do NOT report these as problems; only mention them if they change):
- Supabase "Signed-In Users Can Execute SECURITY DEFINER Function" for create_party, join_party, is_party_member, is_party_owner and regional_movement. The app and its row-level security need signed-in users to call these; signed-out (anon) access is already revoked. Report it only if anon can execute any of them, or a NEW function appears on that list.
- Supabase "Unused Index" on the eight *_created_by_idx / *_user_id_idx / *_owner_id_idx foreign-key indexes from supabase/hardening.sql. They cover foreign keys and are expected to look unused while traffic is low.
- Supabase "Leaked Password Protection Disabled" is a dashboard setting the owner manages. List it once under "Worth doing next", not under "Should fix".

1) BUILDS (Vercel tools): List the latest production and preview deployments for the project. For any deployment in ERROR, or any with build warnings, read its build events and quote the actual error lines. Confirm the newest production deployment is READY and say which commit it is.

2) RUNTIME (Vercel and Supabase tools, if connected): Check Vercel runtime errors and logs for the last 3 days. If Supabase tools are present, run get_advisors (security and performance) and summarize anything WARN or ERROR that is not in the known-and-intended list above.

3) LIVE SITE, read-only (Vercel web_fetch_vercel_url tool): Fetch these pages on https://deer-intel.vercel.app and confirm each returns HTML containing "Deer Intel" without a server error: /, /login, /map, /cameras, /stands, /hunt-log, /properties, /settings, /ai. Also fetch https://deer-intel-fghk.vercel.app/ and report whether it redirects to deer-intel.vercel.app. Only GET pages. Never submit anything.

4) CODE REVIEW (git only, no installs): In a clone of the repo, review commits on origin/main from the last 7 days (git log -p). Flag likely bugs, leftover debug code, TODOs, duplicated code, and anything against deer-intel-v2/AGENTS.md. Use git grep for TODO/FIXME/console.log in deer-intel-v2/app, components and lib. List open pull requests that have sat unmerged for more than 2 days. Read ROADMAP.md and PROJECT.md if they exist and note 1–3 roadmap items worth doing next.

REPORT: Your final message IS the report, because it is sent as the notification. Write it in plain words for a non-programmer, under 250 words, in this shape:
- Status: one line, either "All clear" or "N things need attention".
- Broken now: the item(s), or "nothing".
- Should fix: up to 5 items, each with the file or page.
- Worth doing next: up to 3 items.
- Skipped: list any steps whose tools weren't available.
```

## Acting on a report

The sweep only reports. To fix something it found, start a Claude session
on the repo and point it at the item.
