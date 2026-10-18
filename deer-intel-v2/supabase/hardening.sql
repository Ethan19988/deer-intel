-- Deer Intel — security + performance hardening for the Supabase schema
--
-- Run this once in your Supabase project's SQL editor, AFTER schema.sql,
-- terrain-backend.sql and parties.sql. It is safe to re-run.
--
-- Clears the Supabase advisor warnings:
--   * Signed-out (anon) callers could execute the party SECURITY DEFINER
--     functions over /rest/v1/rpc. create_party / join_party already refuse
--     a null auth.uid(), but nothing signed-out should reach them at all.
--   * gen_invite_code had a mutable search_path.
--   * RLS policies called auth.uid() once per row instead of once per query.
--   * Eight foreign keys had no covering index.
--
-- The party functions stay executable by `authenticated` on purpose: the RLS
-- policies call is_party_member / is_party_owner as the signed-in user, and the
-- app calls create_party / join_party directly.

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC by default, so revoking from anon alone
-- would leave the PUBLIC grant in place.
revoke execute on function public.create_party(text, text) from public, anon;
revoke execute on function public.join_party(text, text) from public, anon;
revoke execute on function public.is_party_member(uuid, uuid) from public, anon;
revoke execute on function public.is_party_owner(uuid, uuid) from public, anon;
grant execute on function public.create_party(text, text) to authenticated;
grant execute on function public.join_party(text, text) to authenticated;
grant execute on function public.is_party_member(uuid, uuid) to authenticated;
grant execute on function public.is_party_owner(uuid, uuid) to authenticated;

-- Only create_party (SECURITY DEFINER, runs as the owner) calls this.
alter function public.gen_invite_code() set search_path = public;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: evaluate auth.uid() once per query, not once per row
-- ---------------------------------------------------------------------------

-- deer_intel_state
alter policy "Users can read their own state" on public.deer_intel_state
  using ((select auth.uid()) = user_id);
alter policy "Users can insert their own state" on public.deer_intel_state
  with check ((select auth.uid()) = user_id);
alter policy "Users can update their own state" on public.deer_intel_state
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users can delete their own state" on public.deer_intel_state
  using ((select auth.uid()) = user_id);

-- terrain_jobs / terrain_sets
alter policy "own jobs read" on public.terrain_jobs
  using ((select auth.uid()) = owner_id);
alter policy "own jobs insert" on public.terrain_jobs
  with check ((select auth.uid()) = owner_id);
alter policy "own jobs delete" on public.terrain_jobs
  using ((select auth.uid()) = owner_id);
alter policy "own sets read" on public.terrain_sets
  using ((select auth.uid()) = owner_id);

-- parties
alter policy "Members can read their party" on public.parties
  using (public.is_party_member(id, (select auth.uid())));
alter policy "Owner can update their party" on public.parties
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
alter policy "Owner can delete their party" on public.parties
  using (created_by = (select auth.uid()));

-- party_members
alter policy "Members can read the roster" on public.party_members
  using (public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own membership" on public.party_members
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "Members can leave, owner can remove" on public.party_members
  using (user_id = (select auth.uid()) or public.is_party_owner(party_id, (select auth.uid())));

-- member_locations
alter policy "Members can read party locations" on public.member_locations
  using (public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can insert their own location" on public.member_locations
  with check (user_id = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own location" on public.member_locations
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "Members can delete their own location" on public.member_locations
  using (user_id = (select auth.uid()));

-- party_pins
alter policy "Members can read party pins" on public.party_pins
  using (public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can add their own party pins" on public.party_pins
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own party pins" on public.party_pins
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
alter policy "Members remove own pins, owner any" on public.party_pins
  using (created_by = (select auth.uid()) or public.is_party_owner(party_id, (select auth.uid())));

-- party_bucks
alter policy "Members can read party bucks" on public.party_bucks
  using (public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can add their own party bucks" on public.party_bucks
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own party bucks" on public.party_bucks
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
alter policy "Members remove own bucks, owner any" on public.party_bucks
  using (created_by = (select auth.uid()) or public.is_party_owner(party_id, (select auth.uid())));

-- party_buck_photos
alter policy "Members can read buck photos" on public.party_buck_photos
  using (public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can add their own buck photos" on public.party_buck_photos
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));
alter policy "Members can update their own buck photos" on public.party_buck_photos
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
alter policy "Members remove own buck photos, owner any" on public.party_buck_photos
  using (created_by = (select auth.uid()) or public.is_party_owner(party_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Covering indexes for foreign keys
-- ---------------------------------------------------------------------------

create index if not exists member_locations_user_id_idx on public.member_locations (user_id);
create index if not exists parties_created_by_idx on public.parties (created_by);
create index if not exists party_buck_photos_created_by_idx on public.party_buck_photos (created_by);
create index if not exists party_bucks_created_by_idx on public.party_bucks (created_by);
create index if not exists party_members_user_id_idx on public.party_members (user_id);
create index if not exists party_pins_created_by_idx on public.party_pins (created_by);
create index if not exists terrain_jobs_owner_id_idx on public.terrain_jobs (owner_id);
create index if not exists terrain_sets_owner_id_idx on public.terrain_sets (owner_id);
