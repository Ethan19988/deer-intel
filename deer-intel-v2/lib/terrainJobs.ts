"use client";

// Client-side glue for the auto-1m terrain backend (Phase 1).
//
// The app's Supabase session lives in localStorage (not cookies), so a Next.js
// server route can't see who's signed in — enqueueing therefore happens right
// here in the browser, with the anon key + RLS enforcing "you can only queue a
// job for yourself". The worker (service-role key, off-box) does the heavy
// lifting and writes the result back to `terrain_sets`, which the app reads.
//
// Everything stays inert when Supabase isn't configured or nobody is signed in,
// exactly like the rest of the cloud-sync layer.

import { getSupabaseClient } from "@/lib/supabaseClient";
import type { TerrainMovementSet } from "@/lib/terrainMovement";
import type { HuntAreaPoint } from "@/types/property";

export type TerrainJobState =
  | "off" // cloud sync not configured, or not signed in
  | "none" // nothing requested yet
  | "queued"
  | "running"
  | "error"
  | "ready"; // a finished 1 m set exists

export type RequestResult = { state: TerrainJobState; message?: string };

type StoredSet = { center: [number, number]; set: TerrainMovementSet };

const MATCH_RADIUS_KM = 6; // same "this ground" radius as the built-in sets

/** [minLng, minLat, maxLng, maxLat] of a drawn ring. */
function bboxOf(ring: HuntAreaPoint[]): [number, number, number, number] {
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of ring) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Stable short hash of the drawn outline, so re-requesting the same shape is a
 *  no-op and editing it forces a fresh read. */
async function outlineHash(ring: HuntAreaPoint[]): Promise<string> {
  const text = ring.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export type HighResRequest = {
  id: string;
  name?: string;
  huntArea: HuntAreaPoint[];
  food?: HuntAreaPoint[];
};

/** Enqueue a 1 m read for a property's drawn hunt area. Safe to call anytime;
 *  returns `off` when cloud sync is unavailable or the user isn't signed in. */
export async function requestHighResRead(input: HighResRequest): Promise<RequestResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { state: "off", message: "Cloud sync isn't configured." };
  if (!input.huntArea || input.huntArea.length < 3) {
    return { state: "error", message: "Draw a hunt area first." };
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { state: "off", message: "Sign in to generate a high-res read." };

  const hash = await outlineHash(input.huntArea);

  // Already have a set for this exact outline? Nothing to do.
  const { data: existing } = await supabase
    .from("terrain_sets")
    .select("outline_hash")
    .eq("property_id", input.id)
    .maybeSingle();
  if (existing?.outline_hash === hash) return { state: "ready" };

  const ring = input.huntArea.map((p) => [p.lng, p.lat]); // GeoJSON is [lng,lat]
  const { error } = await supabase.from("terrain_jobs").insert({
    owner_id: user.id,
    property_id: input.id,
    property_name: input.name ?? null,
    outline: { type: "Polygon", coordinates: [ring] },
    bbox: bboxOf(input.huntArea),
    outline_hash: hash,
    food: input.food?.length ? input.food.map((f) => [f.lat, f.lng]) : null,
  });

  if (error) {
    // 23505 = the active-job unique index: a read for this outline is in flight.
    if (error.code === "23505") return { state: "queued", message: "Already generating." };
    return { state: "error", message: error.message };
  }
  return { state: "queued" };
}

export type HighResStatus = { state: TerrainJobState; stage?: string | null };

/** Current backend state (+ progress stage) for a property, for the button. */
export async function getHighResStatus(propertyId: string): Promise<HighResStatus> {
  const supabase = getSupabaseClient();
  if (!supabase) return { state: "off" };

  const { data: set } = await supabase
    .from("terrain_sets")
    .select("property_id")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (set) return { state: "ready" };

  const { data: job } = await supabase
    .from("terrain_jobs")
    .select("status, stage")
    .eq("property_id", propertyId)
    .in("status", ["queued", "running", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return { state: "none" };
  return { state: job.status as TerrainJobState, stage: job.stage as string | null };
}

// The signed-in user's stored 1 m sets, cached briefly so panning the map
// doesn't hammer the DB. useTerrainSet consults this before the live 10 m read.
let setsCache: { at: number; sets: StoredSet[] } | null = null;

async function fetchStoredSets(): Promise<StoredSet[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  if (setsCache && Date.now() - setsCache.at < 60_000) return setsCache.sets;
  const { data } = await supabase.from("terrain_sets").select("set, center");
  const sets: StoredSet[] = (data ?? [])
    .map((row) => {
      const set = row.set as TerrainMovementSet;
      const center = (row.center as [number, number]) ?? set?.center;
      return { center, set };
    })
    .filter((s): s is StoredSet => Array.isArray(s.center) && !!s.set);
  setsCache = { at: Date.now(), sets };
  return sets;
}

/** Drop the cached sets so a freshly generated read shows without a reload. */
export function clearStoredSetsCache(): void {
  setsCache = null;
}

/** A stored 1 m set covering `point`, or null. Async sibling of the built-in
 *  resolveTerrainSet, for the signed-in user's own generated sets. */
export async function resolveStoredTerrainSet(
  point: { lat: number; lng: number },
): Promise<TerrainMovementSet | null> {
  const sets = await fetchStoredSets();
  let best: { set: TerrainMovementSet; km: number } | null = null;
  for (const s of sets) {
    const km = haversineKm(point, { lat: s.center[0], lng: s.center[1] });
    if (km <= MATCH_RADIUS_KM && (!best || km < best.km)) best = { set: s.set, km };
  }
  return best?.set ?? null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
