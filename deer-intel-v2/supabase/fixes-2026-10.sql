-- Deer Intel — October 2026 review fixes
--
-- Run once in the Supabase SQL editor, after the other scripts. Safe to re-run.
-- Each section is independent.

-- ── 1. Cloud sync: stamp updated_at with the database clock ─────────────────
-- Sync decides which copy is newer by updated_at. The browser used to set it
-- from the phone's own clock, so a device with a skewed clock could win (or
-- lose) a sync it shouldn't. The trigger overrides whatever the client sends.
create or replace function public.deer_intel_state_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.deer_intel_state_touch() from public, anon, authenticated;

drop trigger if exists deer_intel_state_touch on public.deer_intel_state;
create trigger deer_intel_state_touch
  before insert or update on public.deer_intel_state
  for each row execute function public.deer_intel_state_touch();

-- ── 2. Terrain: scope results and the active-job lock per user ──────────────
-- property_id alone was the primary key, so two users with the same property
-- id (the old sample properties use fixed ids) overwrote each other's 1 m
-- terrain set, and one user's queued job blocked the other's. The worker's
-- upsert follows the primary key, so it needs no change.
alter table public.terrain_sets drop constraint if exists terrain_sets_pkey;
alter table public.terrain_sets add primary key (owner_id, property_id);

drop index if exists public.terrain_jobs_active_uniq;
create unique index if not exists terrain_jobs_active_uniq
  on public.terrain_jobs (owner_id, property_id, outline_hash)
  where status in ('queued', 'running');

-- ── 3. Parties: removed members lose write access ───────────────────────────
-- The update policies only checked authorship, so someone removed from a party
-- could keep editing their existing pins, bucks, photos and location.
alter policy "Members can update their own location" on public.member_locations
  using (user_id = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own party pins" on public.party_pins
  using (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())))
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own party bucks" on public.party_bucks
  using (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())))
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own buck photos" on public.party_buck_photos
  using (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())))
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));

-- When a member leaves or is removed: drop their map dot, and when the owner
-- removed them, change the invite code so the old one can't be reused to
-- walk straight back in. (The owner shares the new code with everyone else.)
create or replace function public.party_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  delete from public.member_locations
   where party_id = old.party_id and user_id = old.user_id;

  if (select auth.uid()) is distinct from old.user_id then
    loop
      v_code := public.gen_invite_code();
      exit when not exists (select 1 from public.parties where invite_code = v_code);
    end loop;
    update public.parties set invite_code = v_code where id = old.party_id;
  end if;

  return old;
end;
$$;

revoke execute on function public.party_member_removed() from public, anon, authenticated;

drop trigger if exists party_member_removed on public.party_members;
create trigger party_member_removed
  after delete on public.party_members
  for each row execute function public.party_member_removed();

-- Shared buck photos must be inline images, not links to outside servers
-- (an outside link would reveal every viewer's IP to whoever posted it).
alter table public.party_buck_photos drop constraint if exists party_buck_photos_data_url_check;
alter table public.party_buck_photos add constraint party_buck_photos_data_url_check
  check (data_url like 'data:image/%' and length(data_url) <= 3000000);

-- ── 4. Photo storage: images only, size-capped ──────────────────────────────
-- Existing photos are JPEGs under 400 KB; 10 MB leaves plenty of headroom.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 where id = 'photo-images';

-- ── 5. Parties: members may only rename themselves ──────────────────────────
-- The update policy only checked user_id, so a member could change their own
-- row's party_id (walking into any party without its invite code) or role
-- (making themselves owner). Limit updates to the display name column.
revoke update on public.party_members from authenticated;
grant update (display_name) on public.party_members to authenticated;

-- ── 6. Paid AI routes: a lasting per-user daily counter ─────────────────────
-- The server's rate limit lived in each instance's memory, so it reset on
-- every cold start and multiplied across instances. The API routes call
-- bump_ai_usage() with the caller's own session and refuse once the day's
-- count passes their limit. Users can read their own counts, nothing else.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  route text not null,
  count integer not null default 0,
  primary key (user_id, day, route)
);

alter table public.ai_usage enable row level security;

drop policy if exists "Users read their own AI usage" on public.ai_usage;
create policy "Users read their own AI usage"
  on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.bump_ai_usage(p_route text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_route is null or length(p_route) > 40 then
    raise exception 'bad route';
  end if;

  insert into public.ai_usage as u (user_id, day, route, count)
  values (v_user, (now() at time zone 'utc')::date, p_route, 1)
  on conflict (user_id, day, route)
  do update set count = u.count + 1
  returning u.count into v_count;

  return v_count;
end;
$$;

revoke execute on function public.bump_ai_usage(text) from public, anon;
grant execute on function public.bump_ai_usage(text) to authenticated;

-- ── 7. Terrain jobs: users can only queue reasonable jobs ───────────────────
-- Users could insert jobs with any status, any area size and no limit; each
-- job downloads LiDAR on the worker. New jobs always start queued, cover at
-- most about 0.25° x 0.25° (roughly 13 x 17 miles in PA), and each user gets at
-- most 2 active jobs and 20 new jobs a day.
create or replace function public.terrain_job_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'queued';
  new.worker_id := null;
  new.started_at := null;
  new.finished_at := null;
  new.error := null;
  new.stage := null;

  if array_length(new.bbox, 1) is distinct from 4
     or new.bbox[3] - new.bbox[1] <= 0 or new.bbox[3] - new.bbox[1] > 0.25
     or new.bbox[4] - new.bbox[2] <= 0 or new.bbox[4] - new.bbox[2] > 0.25 then
    raise exception 'Hunt area is too large for a terrain read (limit about 13 x 17 miles).';
  end if;

  if (select count(*) from public.terrain_jobs
       where owner_id = new.owner_id and status in ('queued', 'running')) >= 2 then
    raise exception 'You already have 2 terrain reads in progress. Wait for one to finish.';
  end if;

  if (select count(*) from public.terrain_jobs
       where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily terrain read limit reached. Try again tomorrow.';
  end if;

  return new;
end;
$$;

revoke execute on function public.terrain_job_guard() from public, anon, authenticated;

drop trigger if exists terrain_job_guard on public.terrain_jobs;
create trigger terrain_job_guard
  before insert on public.terrain_jobs
  for each row execute function public.terrain_job_guard();

-- ── 8. Shared sightings: count only established accounts ────────────────────
-- A handful of throwaway accounts could meet the old 3-contributor floor and
-- then expose one real hunter's pattern by comparing totals. Contributors now
-- count only with a confirmed email and an account at least 14 days old, and
-- a region needs 5 of them.
create or replace function public.regional_movement(p_region text, p_since date)
returns table (hour smallint, sightings integer, bucks integer, contributors integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  min_contributors constant integer := 5;
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
    join auth.users u on u.id = s.user_id
   where s.region = p_region and s.sighting_date >= p_since
     and u.email_confirmed_at is not null
     and u.created_at < now() - interval '14 days';

  if n_contributors < min_contributors or n_sightings < min_sightings then
    return;
  end if;

  return query
    select s.hour,
           count(*)::integer,
           (count(*) filter (where s.is_buck))::integer,
           n_contributors
      from public.movement_sightings s
      join auth.users u on u.id = s.user_id
     where s.region = p_region and s.sighting_date >= p_since
       and u.email_confirmed_at is not null
       and u.created_at < now() - interval '14 days'
     group by s.hour
     order by s.hour;
end;
$$;

revoke execute on function public.regional_movement(text, date) from public, anon;
grant execute on function public.regional_movement(text, date) to authenticated;
