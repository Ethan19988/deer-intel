# Auto-1m terrain worker (Phase 1)

Turns the manual "run the pipeline for a property" step into a button. The app
enqueues a job; this worker runs the 1 m LiDAR pipeline and stores the result;
the map swaps its live 10 m read for the 1 m set.

```
Browser ──insert terrain_jobs──▶ Supabase ──claim──▶ Worker (this)
   ▲                                  │                   │
   └──────read terrain_sets───────────┴──upsert set───────┘
```

## 1. Create the tables

In the Supabase SQL editor, run [`supabase/terrain-backend.sql`](../../../supabase/terrain-backend.sql)
(after `schema.sql`). It creates `terrain_jobs`, `terrain_sets`, the RLS
policies, and the `claim_terrain_job` function.

## 2. Build the image

From the **repo root** (the pipeline scripts must be in the build context):

```bash
docker build -f pipeline/terrain/worker/Dockerfile -t deer-intel-terrain-worker .
```

## 3. Run the worker

It needs the Supabase URL and the **service-role** key (server-only — it
bypasses RLS so the worker can write any user's result; never put it in the
browser or in `NEXT_PUBLIC_*`).

```bash
docker run --rm \
  -e SUPABASE_URL="https://YOURPROJECT.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="eyJ...service-role..." \
  -e WORKER_ID="worker-1" \
  deer-intel-terrain-worker
```

**Size it at 8–16 GB RAM.** A whole-tract read (e.g. Moore Hill, 130M cells at
1 m) peaks near 5 GB in `scout_rules` and more in the WhiteboxTools step; give it
headroom so it never has to swap. Disk: a few GB per property for LiDAR tiles +
derivatives (cached under `work/prop-<id>/` and reused on regenerate).

### Fly.io (recommended: scale-to-zero)

```bash
fly launch --no-deploy            # generates fly.toml
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
fly scale vm shared-cpu-4x --memory 16384
fly scale count 1
```

Run it as a **Machine that wakes on a job and stops when idle** so you only pay
for the ~10–20 minutes each read takes. A long idle `POLL_SECONDS` (e.g. 60)
keeps costs down; the app's button polls independently for the result.

Other hosts work the same way — any box that can run the container with ≥8 GB
RAM and outbound internet (Cloud Run Jobs, AWS Batch/Fargate, a small VM).

## 4. Wire the button into the app

Drop the trigger into the property page's "High-Res Terrain (LiDAR)" card:

```tsx
import GenerateHighResButton from "@/components/terrain/GenerateHighResButton";

<GenerateHighResButton
  property={{ id: property.id, name: property.name, huntArea: property.huntArea }}
/>
```

It renders nothing unless cloud sync is configured **and** the user is signed in,
so local-only deployments are unaffected. `useTerrainSet` already checks
`terrain_sets` (Tier 2) before the live 10 m read, so the moment a job finishes
the map shows the 1 m set — the button clears the read cache so no reload is
needed.

## How it behaves

- **Dedup**: a unique partial index allows one active job per property+outline;
  re-clicking while a read is in flight is a no-op, and re-drawing the area
  (new `outline_hash`) queues a fresh read.
- **Failure**: the job row goes `error` with the message; the button shows
  "Failed — try again". Roads are best-effort (Overpass 504s are tolerated —
  the read just omits the road-distance security band).
- **Isolation**: RLS scopes every job/set to its owner; the worker is the only
  writer of results, via the service-role key.

## Not in Phase 1

Auto-enqueue on area-draw, LiDAR/derivative caching across neighboring
properties, auto-tiling huge tracts, and the learning layer (re-ranking
predictions against trail-cam hits) — see the architecture sketch.
