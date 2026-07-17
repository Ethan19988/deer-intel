-- Deer Intel — auto-1m terrain backend (Phase 1)
--
-- Run this once in your Supabase project's SQL editor, after schema.sql.
-- It adds the job queue + result store for the high-res (1 m LiDAR) terrain
-- reads, locked down so a signed-in user can only see their own rows. The
-- worker writes results with the SERVICE-ROLE key, which bypasses RLS — never
-- ship that key to the browser.

-- ── The queue ───────────────────────────────────────────────────────────────
-- One row per requested read. The browser inserts it (RLS-checked); the worker
-- claims and completes it.
create table if not exists public.terrain_jobs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  property_id   text not null,
  property_name text,
  outline       jsonb not null,               -- GeoJSON Polygon {type,coordinates}
  bbox          double precision[] not null,  -- [minLng, minLat, maxLng, maxLat]
  outline_hash  text not null,                -- stable hash of the drawn ring
  food          jsonb,                        -- optional [[lat,lng], ...]
  status        text not null default 'queued'
                  check (status in ('queued', 'running', 'done', 'error')),
  stage         text,                         -- worker progress label (UI hint)
  error         text,
  worker_id     text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists terrain_jobs_status_idx
  on public.terrain_jobs (status, created_at);

-- At most one ACTIVE (queued/running) job per property+outline — the browser's
-- dedup. A fresh draw (new hash) is allowed; a duplicate request is rejected
-- with a unique-violation the client treats as "already queued".
create unique index if not exists terrain_jobs_active_uniq
  on public.terrain_jobs (property_id, outline_hash)
  where status in ('queued', 'running');

-- ── The result store ────────────────────────────────────────────────────────
-- One finished 1 m set per property. Upserted by the worker; read by the app.
create table if not exists public.terrain_sets (
  property_id  text primary key,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  set          jsonb not null,               -- a TerrainMovementSet
  source       text,
  outline_hash text,
  cell_count   bigint,
  center       double precision[],           -- [lat, lng] for proximity match
  generated_at timestamptz not null default now()
);

-- ── Row-level security ───────────────────────────────────────────────────────
alter table public.terrain_jobs enable row level security;
alter table public.terrain_sets enable row level security;

drop policy if exists "own jobs read"   on public.terrain_jobs;
drop policy if exists "own jobs insert" on public.terrain_jobs;
drop policy if exists "own jobs delete" on public.terrain_jobs;
create policy "own jobs read"   on public.terrain_jobs for select using (auth.uid() = owner_id);
create policy "own jobs insert" on public.terrain_jobs for insert with check (auth.uid() = owner_id);
create policy "own jobs delete" on public.terrain_jobs for delete using (auth.uid() = owner_id);

drop policy if exists "own sets read" on public.terrain_sets;
create policy "own sets read" on public.terrain_sets for select using (auth.uid() = owner_id);
-- No insert/update policy: only the service-role worker writes sets (it bypasses
-- RLS), so the browser can read its own 1 m sets but never forge one.

-- ── Atomic claim (called by the worker with the service-role key) ────────────
-- Grabs the oldest queued job and flips it to running in one statement, using
-- FOR UPDATE SKIP LOCKED so multiple workers never claim the same job.
create or replace function public.claim_terrain_job(p_worker text)
returns setof public.terrain_jobs
language sql
security definer
set search_path = public
as $$
  update public.terrain_jobs j
     set status = 'running', worker_id = p_worker, started_at = now()
   where j.id = (
     select id from public.terrain_jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
$$;

-- Only the service role may claim jobs; the browser anon role cannot.
revoke all on function public.claim_terrain_job(text) from public, anon, authenticated;
grant execute on function public.claim_terrain_job(text) to service_role;
