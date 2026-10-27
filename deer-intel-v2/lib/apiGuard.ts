// Server-only guard for the pay-per-call API routes (AI Scout, photo reading).
//
// The sign-in wall (AuthGate) only protects the pages. Without this guard the
// route handlers themselves can be called by anyone with curl, spending the
// Anthropic key. When Supabase is configured we require a valid signed-in
// session token and apply a per-user rate limit; when it isn't (local dev),
// requests pass through as before.
//
// Never import this into a "use client" file.

import { NextResponse } from "next/server";

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  ""
).trim();
const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ""
).trim();

type RateWindow = { count: number; resetAt: number };

// Per-instance memory. Serverless instances don't share it, so this is a
// best-effort brake on runaway loops, not a hard quota.
const windows = new Map<string, RateWindow>();
const MAX_TRACKED_KEYS = 5_000;

function takeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [k, w] of windows) {
        if (w.resetAt <= now) windows.delete(k);
      }
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;

  current.count += 1;
  return true;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());

  return match ? match[1] : null;
}

async function verifySupabaseUser(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { id?: unknown };

    return typeof data.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

export type PaidRouteLimits = {
  /** Requests allowed per user per window. */
  limit: number;
  windowMs: number;
  /** Largest accepted request body, in bytes. */
  maxBodyBytes: number;
};

export type GuardResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

function fail(error: string, status: number): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Check sign-in, rate limit and body size for a paid route, then parse the
 * JSON body. Callers return `result.response` when `ok` is false.
 */
export async function guardPaidRoute(
  request: Request,
  routeKey: string,
  limits: PaidRouteLimits,
): Promise<GuardResult> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limits.maxBodyBytes) {
    return fail("Request is too large.", 413);
  }

  let identity = "local";

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const token = bearerToken(request);
    const userId = token ? await verifySupabaseUser(token) : null;

    if (!userId) return fail("Sign in to use this feature.", 401);

    identity = userId;
  }

  if (!takeToken(`${routeKey}:${identity}`, limits.limit, limits.windowMs)) {
    return fail("Too many requests. Wait a few minutes and try again.", 429);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail("Could not read the request.", 400);
  }

  if (raw.length > limits.maxBodyBytes) {
    return fail("Request is too large.", 413);
  }

  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return fail("Request body must be JSON.", 400);
  }
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();

  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Best-effort per-IP throttle for the free, unauthenticated helper routes
 * (address search, terrain). Their upstreams (Nominatim, USGS, Open-Meteo)
 * ban servers that send too much, which would break the feature for everyone.
 * Returns a 429 response when over the limit, otherwise null.
 */
export function throttleByIp(
  request: Request,
  routeKey: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  if (takeToken(`${routeKey}:ip:${clientIp(request)}`, limit, windowMs)) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Wait a minute and try again." },
    { status: 429 },
  );
}
