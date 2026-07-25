// Shared "hunting party" data. Unlike the rest of Deer Intel (private, per-user
// local state), these rows live in Supabase and are read by every member of the
// party. See supabase/parties.sql for the tables + row-level security.

export type Party = {
  id: string;
  name: string;
  // Short, human-friendly code members type in to join (e.g. "K7P2QX").
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type PartyMemberRole = "owner" | "member";

export type PartyMember = {
  party_id: string;
  user_id: string;
  display_name: string;
  role: PartyMemberRole;
  joined_at: string;
};

// A map pin one member shares with the whole party. `source_id` mirrors the
// creator's local pin id so it can be kept in sync as the original changes.
export type PartyPin = {
  party_id: string;
  source_id: string;
  created_by: string;
  type: string;
  lat: number;
  lng: number;
  name: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

// A buck a member is tracking, shared with the party as a "hit list" card: the
// profile basics plus a snapshot of its computed movement pattern. `source_id`
// mirrors the creator's local deer-profile id. No raw photos (images are
// per-user in storage) — stats and description only.
export type PartyBuck = {
  party_id: string;
  source_id: string;
  created_by: string;
  nickname: string;
  estimated_age: string;
  status: string;
  property_name: string;
  sighting_count: number;
  cameras: string;
  most_recent: string;
  common_time: string;
  common_area: string;
  notable: string;
  updated_at: string;
};

// A shared thumbnail of a buck, so the crew can see each other's targets. Small
// JPEG data URL; `photo_id` mirrors the creator's local PhotoRecord id and
// `source_id` ties it to the shared buck (party_bucks.source_id).
export type PartyBuckPhoto = {
  party_id: string;
  photo_id: string;
  source_id: string;
  created_by: string;
  data_url: string;
  photo_date: string;
  caption: string;
  updated_at: string;
};

// A member's live "blue dot". A row only exists while that member is inside the
// party's shared hunt area — the client writes it on entry and deletes it on
// exit, so absence means "not currently in the area".
export type MemberLocation = {
  party_id: string;
  user_id: string;
  lat: number;
  lng: number;
  // Device heading in degrees (0 = N) when the compass is on, else null.
  heading: number | null;
  // GPS accuracy radius in meters, or null when unknown.
  accuracy: number | null;
  // Name of the saved hunt area the member entered, for display.
  area_name: string | null;
  updated_at: string;
};
