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
