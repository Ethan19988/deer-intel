"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";

// Cloud backup for photo image blobs. Photo *records* sync as JSONB (cloudSync),
// but the images themselves live in IndexedDB, which a browser (iOS Safari
// especially) can silently evict when the app sits unused — so a reopened app
// pulls the records back but the images are gone. This uploads each saved image
// to per-user Supabase Storage so it survives eviction and appears on every
// device. Entirely best-effort and inert when cloud sync is off or signed out:
// the app keeps working local-only exactly as before.

const BUCKET = "photo-images";

// Objects are stored at "{userId}/{imageId}" — the storage RLS policies (see
// supabase/photo-images-storage.sql) only let a user touch their own folder.
async function objectPath(imageId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // getSession reads the persisted session without a network round-trip.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;

  return userId ? `${userId}/${imageId}` : null;
}

/** Back up one image blob. Resolves false (never throws) when unavailable. */
export async function uploadCloudImage(
  imageId: string,
  blob: Blob,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const path = supabase ? await objectPath(imageId) : null;
    if (!supabase || !path) return false;

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

    return !error;
  } catch {
    return false;
  }
}

/** Pull one backed-up image blob, or null when there is no cloud copy. */
export async function downloadCloudImage(imageId: string): Promise<Blob | null> {
  try {
    const supabase = getSupabaseClient();
    const path = supabase ? await objectPath(imageId) : null;
    if (!supabase || !path) return null;

    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    return error ? null : (data ?? null);
  } catch {
    return null;
  }
}

/** Remove a backed-up image when its photo is deleted. Best-effort. */
export async function deleteCloudImage(imageId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const path = supabase ? await objectPath(imageId) : null;
    if (!supabase || !path) return;

    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Ignore — a leftover cloud object is harmless.
  }
}
