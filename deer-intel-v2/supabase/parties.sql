-- Deer Intel — Parties (shared hunting groups) + geofenced live location
--
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL Editor
-- -> New query -> paste -> Run), the same way you ran supabase/schema.sql.
--
-- This is the first *shared* data in Deer Intel. Unlike deer_intel_state (one
-- private JSONB row per user), a party is read by every member, so the row-level
-- security here is scoped to "you are a member of this party" rather than "this
-- row is yours". Membership is checked through a SECURITY DEFINER helper so the
-- policies never recurse on party_members reading party_members.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A hunting group. Members join with the short invite_code.
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Who belongs to a party. Composite PK keeps one membership row per user/party.
create table if not exists public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default 'Hunter',
  role text not null default 'member', -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

-- The live "blue dot" for each member, one row per user/party. The client only
-- writes here while it is inside the party's shared hunt area (geofence), and
-- deletes the row on exit, so a missing row means "not currently in the area".
create table if not exists public.member_locations (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,          -- degrees, 0 = N, or null when unknown
  accuracy double precision,         -- GPS accuracy radius in meters
  area_name text,                    -- which saved hunt area they entered
  updated_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists member_locations_party_idx
  on public.member_locations (party_id);

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER: they bypass RLS, which is exactly how
-- we avoid party_members policies recursing on themselves).
-- ---------------------------------------------------------------------------

create or replace function public.is_party_member(p_party_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and user_id = p_user_id
  );
$$;

create or replace function public.is_party_owner(p_party_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.parties
    where id = p_party_id and created_by = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.member_locations enable row level security;

-- parties: members can see their party; only the owner can rename/delete it.
-- Creation goes through create_party() below, so there is no direct INSERT
-- policy (the anon key cannot invent parties outside that flow).
drop policy if exists "Members can read their party" on public.parties;
create policy "Members can read their party"
  on public.parties for select
  using (public.is_party_member(id, auth.uid()));

drop policy if exists "Owner can update their party" on public.parties;
create policy "Owner can update their party"
  on public.parties for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Owner can delete their party" on public.parties;
create policy "Owner can delete their party"
  on public.parties for delete
  using (created_by = auth.uid());

-- party_members: members can see the roster; you can rename yourself; you can
-- leave (delete your own row) and the owner can remove anyone. Joining is done
-- through join_party() below, so there is no open INSERT policy.
drop policy if exists "Members can read the roster" on public.party_members;
create policy "Members can read the roster"
  on public.party_members for select
  using (public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can update their own membership" on public.party_members;
create policy "Members can update their own membership"
  on public.party_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Members can leave, owner can remove" on public.party_members;
create policy "Members can leave, owner can remove"
  on public.party_members for delete
  using (user_id = auth.uid() or public.is_party_owner(party_id, auth.uid()));

-- member_locations: any member can read every dot in the party; you may only
-- write/clear your own dot, and only while you are a member.
drop policy if exists "Members can read party locations" on public.member_locations;
create policy "Members can read party locations"
  on public.member_locations for select
  using (public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can insert their own location" on public.member_locations;
create policy "Members can insert their own location"
  on public.member_locations for insert
  with check (user_id = auth.uid() and public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can update their own location" on public.member_locations;
create policy "Members can update their own location"
  on public.member_locations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Members can delete their own location" on public.member_locations;
create policy "Members can delete their own location"
  on public.member_locations for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Invite codes + create/join RPCs
-- ---------------------------------------------------------------------------

-- Short, human-friendly invite code from an unambiguous alphabet (no O/0/I/1).
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- Create a party and make the caller its owner, in one atomic step. Returns the
-- new party row (id + invite_code) so the client can show the code to share.
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
  values (coalesce(nullif(trim(p_name), ''), 'Hunting Party'), v_code, v_uid)
  returning * into v_party;

  insert into public.party_members (party_id, user_id, display_name, role)
  values (v_party.id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Hunter'), 'owner');

  return v_party;
end;
$$;

-- Join an existing party by its invite code. Idempotent: re-joining just
-- refreshes your display name. Returns the party so the client can load it.
create or replace function public.join_party(p_invite_code text, p_display_name text)
returns public.parties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_party public.parties;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_party
  from public.parties
  where invite_code = upper(trim(p_invite_code));

  if v_party.id is null then
    raise exception 'No party found for that invite code';
  end if;

  insert into public.party_members (party_id, user_id, display_name, role)
  values (v_party.id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Hunter'), 'member')
  on conflict (party_id, user_id)
  do update set display_name = excluded.display_name;

  return v_party;
end;
$$;

grant execute on function public.create_party(text, text) to authenticated;
grant execute on function public.join_party(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime — the blue dots update live via a Realtime subscription on
-- member_locations. Add it to the supabase_realtime publication (guarded so
-- re-running this file is safe).
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_locations'
  ) then
    alter publication supabase_realtime add table public.member_locations;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared pins — map pins a member shares with the party (their crew sees them
-- on the map in real time). One row per (party, source pin); `source_id` mirrors
-- the creator's local pin id so a shared pin can be upserted/removed as its
-- local original changes.
-- ---------------------------------------------------------------------------

create table if not exists public.party_pins (
  party_id uuid not null references public.parties (id) on delete cascade,
  source_id text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  type text not null,
  lat double precision not null,
  lng double precision not null,
  name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (party_id, source_id)
);

create index if not exists party_pins_party_idx
  on public.party_pins (party_id);

alter table public.party_pins enable row level security;

-- Any member can see every shared pin in the party.
drop policy if exists "Members can read party pins" on public.party_pins;
create policy "Members can read party pins"
  on public.party_pins for select
  using (public.is_party_member(party_id, auth.uid()));

-- You can only add/edit pins as yourself, and only in a party you belong to.
drop policy if exists "Members can add their own party pins" on public.party_pins;
create policy "Members can add their own party pins"
  on public.party_pins for insert
  with check (created_by = auth.uid() and public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can update their own party pins" on public.party_pins;
create policy "Members can update their own party pins"
  on public.party_pins for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- You can remove your own pins; the party owner can clean up anyone's.
drop policy if exists "Members remove own pins, owner any" on public.party_pins;
create policy "Members remove own pins, owner any"
  on public.party_pins for delete
  using (created_by = auth.uid() or public.is_party_owner(party_id, auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'party_pins'
  ) then
    alter publication supabase_realtime add table public.party_pins;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared hit list — the bucks a member is tracking, shared with the party. Each
-- row is a snapshot of one local deer profile plus its computed movement pattern
-- (sighting count, cameras, common time/area), so the whole crew sees the same
-- hit list. Raw photos are NOT shared here (images are per-user in storage);
-- this is the card + stats only.
-- ---------------------------------------------------------------------------

create table if not exists public.party_bucks (
  party_id uuid not null references public.parties (id) on delete cascade,
  source_id text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  nickname text not null default '',
  estimated_age text not null default '',
  status text not null default '',
  property_name text not null default '',
  sighting_count integer not null default 0,
  cameras text not null default '',
  most_recent text not null default '',
  common_time text not null default '',
  common_area text not null default '',
  notable text not null default '',
  updated_at timestamptz not null default now(),
  primary key (party_id, source_id)
);

create index if not exists party_bucks_party_idx
  on public.party_bucks (party_id);

alter table public.party_bucks enable row level security;

drop policy if exists "Members can read party bucks" on public.party_bucks;
create policy "Members can read party bucks"
  on public.party_bucks for select
  using (public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can add their own party bucks" on public.party_bucks;
create policy "Members can add their own party bucks"
  on public.party_bucks for insert
  with check (created_by = auth.uid() and public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can update their own party bucks" on public.party_bucks;
create policy "Members can update their own party bucks"
  on public.party_bucks for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Members remove own bucks, owner any" on public.party_bucks;
create policy "Members remove own bucks, owner any"
  on public.party_bucks for delete
  using (created_by = auth.uid() or public.is_party_owner(party_id, auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'party_bucks'
  ) then
    alter publication supabase_realtime add table public.party_bucks;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared buck photos — a few small thumbnails per shared buck so the crew can
-- actually see each other's target bucks, not just the stats. Stored as a small
-- JPEG data URL (the full-resolution images stay per-user in storage). `photo_id`
-- mirrors the creator's local PhotoRecord id; `source_id` ties it to the buck.
-- ---------------------------------------------------------------------------

create table if not exists public.party_buck_photos (
  party_id uuid not null references public.parties (id) on delete cascade,
  photo_id text not null,
  source_id text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  data_url text not null,
  photo_date text not null default '',
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (party_id, photo_id)
);

create index if not exists party_buck_photos_buck_idx
  on public.party_buck_photos (party_id, source_id);

alter table public.party_buck_photos enable row level security;

drop policy if exists "Members can read buck photos" on public.party_buck_photos;
create policy "Members can read buck photos"
  on public.party_buck_photos for select
  using (public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can add their own buck photos" on public.party_buck_photos;
create policy "Members can add their own buck photos"
  on public.party_buck_photos for insert
  with check (created_by = auth.uid() and public.is_party_member(party_id, auth.uid()));

drop policy if exists "Members can update their own buck photos" on public.party_buck_photos;
create policy "Members can update their own buck photos"
  on public.party_buck_photos for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Members remove own buck photos, owner any" on public.party_buck_photos;
create policy "Members remove own buck photos, owner any"
  on public.party_buck_photos for delete
  using (created_by = auth.uid() or public.is_party_owner(party_id, auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'party_buck_photos'
  ) then
    alter publication supabase_realtime add table public.party_buck_photos;
  end if;
end
$$;
