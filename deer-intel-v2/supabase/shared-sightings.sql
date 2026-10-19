-- Deer Intel — shared movement learning (opt-in, anonymous sighting facts)
--
-- Run this once in your Supabase project's SQL editor, AFTER schema.sql. It is
-- safe to re-run.
--
-- Only accounts that turn on "Share anonymous sightings" (asked on first
-- sign-in, changeable in Settings) contribute. Each contributed row is one
-- timed deer photo reduced to: region (PA county, or a ~30-mile grid square
-- outside PA), date, hour, buck or not, and weather/rut context. No photos,
-- names, notes, or coordinates.
--
-- Privacy rules enforced here, not just in the app:
--   * Nobody can read raw rows, including their own. The only read path is
--     regional_movement(), which returns hourly totals for a region.
--   * regional_movement() returns nothing until a region has at least 3
--     distinct accounts and 30 rows, so one hunter's pattern can't be
--     picked out.
--   * Turning sharing off deletes that account's rows (delete policy below);
--     deleting the account removes them too (on delete cascade).

create table if not exists public.movement_sightings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- A one-way hash of the local photo id, only used to avoid double-counting.
  source_key text not null,
  region text not null,
  sighting_date date not null,
  hour smallint not null check (hour between 0 and 23),
  is_buck boolean not null default false,
  temp_f real,
  wind_mph real,
  pressure_trend text,
  rut_phase text,
  created_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

create index if not exists movement_sightings_region_date_idx
  on public.movement_sightings (region, sighting_date);

alter table public.movement_sightings enable row level security;

-- Write and delete your own rows; there is no select policy.
drop policy if exists "Users add their own sightings" on public.movement_sightings;
create policy "Users add their own sightings"
  on public.movement_sightings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove their own sightings" on public.movement_sightings;
create policy "Users remove their own sightings"
  on public.movement_sightings for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Hourly totals for a region since a date, or no rows while the region has
-- too few contributors to stay anonymous.
create or replace function public.regional_movement(p_region text, p_since date)
returns table (hour smallint, sightings integer, bucks integer, contributors integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  min_contributors constant integer := 3;
  min_sightings constant integer := 30;
  n_contributors integer;
  n_sightings integer;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  select count(distinct s.user_id), count(*)
    into n_contributors, n_sightings
    from public.movement_sightings s
   where s.region = p_region and s.sighting_date >= p_since;

  if n_contributors < min_contributors or n_sightings < min_sightings then
    return;
  end if;

  return query
    select s.hour,
           count(*)::integer,
           (count(*) filter (where s.is_buck))::integer,
           n_contributors
      from public.movement_sightings s
     where s.region = p_region and s.sighting_date >= p_since
     group by s.hour
     order by s.hour;
end;
$$;

revoke execute on function public.regional_movement(text, date) from public, anon;
grant execute on function public.regional_movement(text, date) to authenticated;
