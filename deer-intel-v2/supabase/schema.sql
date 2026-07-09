-- Deer Intel cloud sync schema
--
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL Editor
-- -> New query -> paste -> Run). It creates the single table that holds each
-- user's Deer Intel state and locks it down so users can only touch their own
-- row.

-- One JSONB blob per user mirrors the local "deer-intel:state" object the app
-- keeps in the browser. Keeping it as a single row makes cloud sync a direct
-- extension of the existing local-only model.
create table if not exists public.deer_intel_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row-level security: every policy below is scoped to the signed-in user, so
-- the public anon key shipped to the browser can never read or write another
-- user's data.
alter table public.deer_intel_state enable row level security;

drop policy if exists "Users can read their own state" on public.deer_intel_state;
create policy "Users can read their own state"
  on public.deer_intel_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own state" on public.deer_intel_state;
create policy "Users can insert their own state"
  on public.deer_intel_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own state" on public.deer_intel_state;
create policy "Users can update their own state"
  on public.deer_intel_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own state" on public.deer_intel_state;
create policy "Users can delete their own state"
  on public.deer_intel_state
  for delete
  using (auth.uid() = user_id);
