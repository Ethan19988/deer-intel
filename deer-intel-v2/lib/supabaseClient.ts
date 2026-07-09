"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

// Cloud sync + login are opt-in, exactly like the AI Scout feature. When the
// Supabase environment variables are not set, this whole layer stays inert and
// Deer Intel keeps working as a local-only app in the browser.
//
// Both values are safe to expose to the browser: the anon key only grants the
// access allowed by the row-level security policies documented in
// supabase/schema.sql. Never put the service-role key here.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

// Keep the browser session in its own storage key so it sits alongside the
// existing "deer-intel:*" keys and is easy to spot / clear.
const AUTH_STORAGE_KEY = "deer-intel:auth";

let cachedClient: SupabaseClient | null = null;

/**
 * True when both Supabase env vars are present, i.e. login + cloud sync should
 * be offered. The UI uses this to decide whether to show any account controls
 * at all.
 */
export function isCloudSyncConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/**
 * Lazily create (once) and return the browser Supabase client, or null when
 * cloud sync is not configured or we are running on the server. Callers should
 * treat a null result as "cloud sync is off" and fall back to local-only.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isCloudSyncConfigured()) return null;
  if (typeof window === "undefined") return null;

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  }

  return cachedClient;
}
