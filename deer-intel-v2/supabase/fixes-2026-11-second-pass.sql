-- Deer Intel — November 2026 second-pass fixes (parties + live location)
--
-- Run once in the Supabase SQL editor, AFTER every other script (schema.sql,
-- terrain-backend.sql, parties.sql, hardening.sql, shared-sightings.sql,
-- photo-images-storage.sql, fixes-2026-10.sql). Safe to re-run; each section
-- is independent.
--
-- !! If you ever re-run parties.sql, re-run hardening.sql, fixes-2026-10.sql and
-- !! then THIS file afterwards — parties.sql re-creates the original policies
-- !! and functions this file replaces.
--
-- The CHECK constraints below are added NOT VALID: existing rows are not
-- checked (so this can't fail on old data), but every new or updated row is.
-- The app trims text to the same limits before saving (lib/partyLimits.ts).

-- ── 1. Shared pins: only pin types the app can draw ─────────────────────────
-- A row with an unknown type crashed other members' maps. Keep this list in
-- step with PIN_TYPES in types/mapPin.ts.
alter table public.party_pins drop constraint if exists party_pins_type_check;
alter table public.party_pins add constraint party_pins_type_check
  check (type in (
    'Camera Site', 'Stand', 'Bedding', 'Food', 'Water', 'Scrape', 'Rub',
    'Trail', 'Parking', 'Gate', 'Trail Camera', 'Treestand', 'Bedding Area',
    'Food Source', 'Water Source', 'Rub Line', 'Access Route',
    'Buck Sighting', 'Doe Sighting', 'Vegetation'
  )) not valid;

-- ── 2. Live location: stale dots are hidden ─────────────────────────────────
-- A dot left behind (phone died, signed out before it was cleared) stayed
-- readable forever. Members now only see dots refreshed in the last 2 minutes
-- (the app refreshes every ~12 s while inside a hunt area). Your own row stays
-- visible to you, which upsert (INSERT … ON CONFLICT DO UPDATE) needs.
alter policy "Members can read party locations" on public.member_locations
  using (
    public.is_party_member(party_id, (select auth.uid()))
    and (user_id = (select auth.uid()) or updated_at > now() - interval '2 minutes')
  );

create index if not exists member_locations_party_updated_idx
  on public.member_locations (party_id, updated_at);

-- Freshness is judged by the database clock, not the phone's: a phone with a
-- clock set ahead could otherwise keep its dot "fresh" forever.
create or replace function public.member_locations_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.member_locations_touch() from public, anon, authenticated;

drop trigger if exists member_locations_touch on public.member_locations;
create trigger member_locations_touch
  before insert or update on public.member_locations
  for each row execute function public.member_locations_touch();

-- ── 3. Invite codes: longer, and guessing is rate limited ───────────────────
-- 6 characters from a 31-letter alphabet could be guessed by brute force. New
-- codes (new parties, and the new code after the owner removes someone) are
-- 10 characters; existing 6-character codes keep working.
create or replace function public.gen_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..10 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

revoke execute on function public.gen_invite_code() from public, anon, authenticated;

-- Failed join attempts per user. Only join_party (SECURITY DEFINER) reads or
-- writes it: RLS on with no policies, and no table grants.
create table if not exists public.party_join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists party_join_attempts_user_time_idx
  on public.party_join_attempts (user_id, attempted_at);

alter table public.party_join_attempts enable row level security;
revoke all on public.party_join_attempts from public, anon, authenticated;

-- Join by invite code. At most 10 wrong codes per user per hour. A wrong code
-- returns no party (instead of raising) so the attempt is recorded — raising
-- would roll the record back. The app shows "No party found" for that.
create or replace function public.join_party(p_invite_code text, p_display_name text)
returns public.parties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_party public.parties;
  v_failed int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_failed
    from public.party_join_attempts
   where user_id = v_uid and attempted_at > now() - interval '1 hour';

  if v_failed >= 10 then
    raise exception 'Too many invite codes tried. Wait an hour and try again.';
  end if;

  select * into v_party
    from public.parties
   where invite_code = upper(left(trim(coalesce(p_invite_code, '')), 16));

  if v_party.id is null then
    insert into public.party_join_attempts (user_id) values (v_uid);
    -- Housekeeping: this user's attempts older than the window.
    delete from public.party_join_attempts
     where user_id = v_uid and attempted_at < now() - interval '1 hour';
    return null;
  end if;

  insert into public.party_members (party_id, user_id, display_name, role)
  values (
    v_party.id,
    v_uid,
    left(coalesce(nullif(trim(p_display_name), ''), 'Hunter'), 40),
    'member'
  )
  on conflict (party_id, user_id)
  do update set display_name = excluded.display_name;

  return v_party;
end;
$$;

revoke execute on function public.join_party(text, text) from public, anon;
grant execute on function public.join_party(text, text) to authenticated;

-- create_party: same as before, with names trimmed to the new limits so the
-- constraints in §4 never reject a party being created.
create or replace function public.create_party(p_name text, p_display_name text)
returns public.parties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_party public.parties;
  v_code text;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.parties where invite_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 10 then
      raise exception 'Could not allocate a unique invite code, please retry';
    end if;
  end loop;

  insert into public.parties (name, invite_code, created_by)
  values (left(coalesce(nullif(trim(p_name), ''), 'Hunting Party'), 60), v_code, v_uid)
  returning * into v_party;

  insert into public.party_members (party_id, user_id, display_name, role)
  values (
    v_party.id,
    v_uid,
    left(coalesce(nullif(trim(p_display_name), ''), 'Hunter'), 40),
    'owner'
  );

  return v_party;
end;
$$;

revoke execute on function public.create_party(text, text) from public, anon;
grant execute on function public.create_party(text, text) to authenticated;

-- ── 4. Length limits on shared text ─────────────────────────────────────────
alter table public.parties drop constraint if exists parties_name_length;
alter table public.parties add constraint parties_name_length
  check (char_length(name) <= 60) not valid;

alter table public.party_members drop constraint if exists party_members_display_name_length;
alter table public.party_members add constraint party_members_display_name_length
  check (char_length(display_name) <= 40) not valid;

alter table public.party_pins drop constraint if exists party_pins_name_length;
alter table public.party_pins add constraint party_pins_name_length
  check (char_length(name) <= 80) not valid;

alter table public.party_pins drop constraint if exists party_pins_notes_length;
alter table public.party_pins add constraint party_pins_notes_length
  check (char_length(notes) <= 500) not valid;

alter table public.party_bucks drop constraint if exists party_bucks_nickname_length;
alter table public.party_bucks add constraint party_bucks_nickname_length
  check (char_length(nickname) <= 80) not valid;

alter table public.party_bucks drop constraint if exists party_bucks_notable_length;
alter table public.party_bucks add constraint party_bucks_notable_length
  check (char_length(notable) <= 500) not valid;

alter table public.party_buck_photos drop constraint if exists party_buck_photos_caption_length;
alter table public.party_buck_photos add constraint party_buck_photos_caption_length
  check (char_length(caption) <= 120) not valid;
