"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";
import type {
  MemberLocation,
  Party,
  PartyBuck,
  PartyBuckPhoto,
  PartyMember,
  PartyPin,
} from "@/types/party";

// Data layer for hunting parties + the geofenced live-location tracker. Like
// lib/cloudSync, every call goes through getSupabaseClient() and stays inert
// when Supabase isn't configured. See supabase/parties.sql for the schema, RLS,
// and the create_party / join_party RPCs these functions call.

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Create a new party and become its owner. Returns the party (with invite code). */
export async function createParty(
  name: string,
  displayName: string,
): Promise<Party> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  const { data, error } = await supabase.rpc("create_party", {
    p_name: name,
    p_display_name: displayName,
  });

  if (error) throw new Error(error.message);
  return data as Party;
}

/** Join an existing party by invite code. Idempotent (re-join refreshes name). */
export async function joinParty(
  inviteCode: string,
  displayName: string,
): Promise<Party> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud sync is not configured.");

  const { data, error } = await supabase.rpc("join_party", {
    p_invite_code: inviteCode,
    p_display_name: displayName,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No party found for that invite code.");
  return data as Party;
}

/**
 * The parties this user belongs to. RLS on `parties` already limits the result
 * to the caller's own parties, so a plain select is all we need.
 */
export async function listMyParties(): Promise<Party[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Party[];
}

/** The roster for a party. */
export async function listMembers(partyId: string): Promise<PartyMember[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("party_members")
    .select("*")
    .eq("party_id", partyId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PartyMember[];
}

/** Leave a party: drop your membership and any live dot you left behind. */
export async function leaveParty(partyId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  await supabase
    .from("member_locations")
    .delete()
    .eq("party_id", partyId)
    .eq("user_id", userId);

  const { error } = await supabase
    .from("party_members")
    .delete()
    .eq("party_id", partyId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export type LocationUpdate = {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number | null;
  areaName: string | null;
};

/** Write (or refresh) this user's live dot in a party — called on/while inside the geofence. */
export async function upsertMyLocation(
  partyId: string,
  update: LocationUpdate,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("member_locations").upsert(
    {
      party_id: partyId,
      user_id: userId,
      lat: update.lat,
      lng: update.lng,
      heading: update.heading,
      accuracy: update.accuracy,
      area_name: update.areaName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,user_id" },
  );

  if (error) throw new Error(error.message);
}

/** Remove this user's live dot — called when they leave the geofence or stop sharing. */
export async function clearMyLocation(partyId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  await supabase
    .from("member_locations")
    .delete()
    .eq("party_id", partyId)
    .eq("user_id", userId);
}

/** One-shot fetch of every live dot currently in a party. */
export async function fetchLocations(
  partyId: string,
): Promise<MemberLocation[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("member_locations")
    .select("*")
    .eq("party_id", partyId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MemberLocation[];
}

/**
 * Subscribe to live location changes for a party via Supabase Realtime. Calls
 * `onChange` on every insert/update/delete to member_locations for this party.
 * Returns an unsubscribe function. Requires Realtime to be enabled on the table
 * (supabase/parties.sql adds it to the supabase_realtime publication).
 */
export function subscribeToLocations(
  partyId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`party-locations-${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "member_locations",
        filter: `party_id=eq.${partyId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Shared pins -----------------------------------------------------------

export type PartyPinInput = {
  sourceId: string;
  type: string;
  lat: number;
  lng: number;
  name: string;
  notes: string;
};

/** Share (or update) one of the caller's pins with a party. */
export async function upsertPartyPin(
  partyId: string,
  pin: PartyPinInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("party_pins").upsert(
    {
      party_id: partyId,
      source_id: pin.sourceId,
      created_by: userId,
      type: pin.type,
      lat: pin.lat,
      lng: pin.lng,
      name: pin.name,
      notes: pin.notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,source_id" },
  );

  if (error) throw new Error(error.message);
}

/** Remove one of the caller's shared pins from a party. */
export async function deletePartyPin(
  partyId: string,
  sourceId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  await supabase
    .from("party_pins")
    .delete()
    .eq("party_id", partyId)
    .eq("source_id", sourceId)
    .eq("created_by", userId);
}

/** Every shared pin in a party (all members). */
export async function listPartyPins(partyId: string): Promise<PartyPin[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("party_pins")
    .select("*")
    .eq("party_id", partyId);

  if (error) throw new Error(error.message);
  return (data ?? []) as PartyPin[];
}

/** Subscribe to shared-pin changes for a party (insert/update/delete). */
export function subscribeToPartyPins(
  partyId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`party-pins-${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "party_pins",
        filter: `party_id=eq.${partyId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Shared hit list (bucks) -----------------------------------------------

export type PartyBuckInput = {
  sourceId: string;
  nickname: string;
  estimatedAge: string;
  status: string;
  propertyName: string;
  sightingCount: number;
  cameras: string;
  mostRecent: string;
  commonTime: string;
  commonArea: string;
  notable: string;
};

/** Share (or update) one of the caller's tracked bucks with a party. */
export async function upsertPartyBuck(
  partyId: string,
  buck: PartyBuckInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("party_bucks").upsert(
    {
      party_id: partyId,
      source_id: buck.sourceId,
      created_by: userId,
      nickname: buck.nickname,
      estimated_age: buck.estimatedAge,
      status: buck.status,
      property_name: buck.propertyName,
      sighting_count: buck.sightingCount,
      cameras: buck.cameras,
      most_recent: buck.mostRecent,
      common_time: buck.commonTime,
      common_area: buck.commonArea,
      notable: buck.notable,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,source_id" },
  );

  if (error) throw new Error(error.message);
}

/** Remove one of the caller's shared bucks from a party. */
export async function deletePartyBuck(
  partyId: string,
  sourceId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  await supabase
    .from("party_bucks")
    .delete()
    .eq("party_id", partyId)
    .eq("source_id", sourceId)
    .eq("created_by", userId);
}

/** Every shared buck in a party (all members). */
export async function listPartyBucks(partyId: string): Promise<PartyBuck[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("party_bucks")
    .select("*")
    .eq("party_id", partyId);

  if (error) throw new Error(error.message);
  return (data ?? []) as PartyBuck[];
}

/** Subscribe to shared-buck changes for a party (insert/update/delete). */
export function subscribeToPartyBucks(
  partyId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`party-bucks-${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "party_bucks",
        filter: `party_id=eq.${partyId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Shared buck photos ----------------------------------------------------

export type PartyBuckPhotoInput = {
  photoId: string;
  sourceId: string;
  dataUrl: string;
  photoDate: string;
  caption: string;
};

/** Share (or refresh) one thumbnail of a buck with a party. */
export async function upsertPartyBuckPhoto(
  partyId: string,
  photo: PartyBuckPhotoInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("party_buck_photos").upsert(
    {
      party_id: partyId,
      photo_id: photo.photoId,
      source_id: photo.sourceId,
      created_by: userId,
      data_url: photo.dataUrl,
      photo_date: photo.photoDate,
      caption: photo.caption,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,photo_id" },
  );

  if (error) throw new Error(error.message);
}

/** Remove one of the caller's shared buck photos. */
export async function deletePartyBuckPhoto(
  partyId: string,
  photoId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const userId = await currentUserId();
  if (!userId) return;

  await supabase
    .from("party_buck_photos")
    .delete()
    .eq("party_id", partyId)
    .eq("photo_id", photoId)
    .eq("created_by", userId);
}

/**
 * Shared buck photos for a party. `data_url` is heavy, so callers that only need
 * to know WHICH photos exist (the sync's dedup check) pass withData=false to
 * fetch just the keys.
 */
export async function listPartyBuckPhotos(
  partyId: string,
  withData = true,
): Promise<PartyBuckPhoto[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const columns = withData
    ? "*"
    : "party_id, photo_id, source_id, created_by, photo_date, caption, updated_at";

  const { data, error } = await supabase
    .from("party_buck_photos")
    .select(columns)
    .eq("party_id", partyId);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PartyBuckPhoto[];
}

/** Subscribe to shared buck-photo changes for a party. */
export function subscribeToPartyBuckPhotos(
  partyId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`party-buck-photos-${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "party_buck_photos",
        filter: `party_id=eq.${partyId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
