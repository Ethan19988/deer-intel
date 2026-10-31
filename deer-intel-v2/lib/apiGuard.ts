// Server-only guard for the pay-per-call API routes (AI Scout, photo reading).
//
// The sign-in wall (AuthGate) only protects the pages. Without this guard the
// route handlers themselves can be called by anyone with curl, spending the
// Anthropic key. When Supabase is configured we require a valid signed-in
// session token, count the call against a per-user DAILY quota in the database
// (bump_ai_usage, supabase/fixes-2026-10.sql), and apply an in-memory burst
// limit. When Supabase isn't configured: local dev passes through as before,
// but a deployment with NEXT_PUBLIC_REQUIRE_AUTH=true fails closed (503).
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

const REQUIRE_AUTH =
  (process.env.NEXT_PUBLIC_REQUIRE_AUTH?.trim() ?? "") === "true";

/** Per-user calls allowed per UTC day, per paid route. The one place to tune. */
export const DAILY_AI_LIMITS = {
  "ai-scout": 40,
  "photo-stamp": 300,
} as const;

export type PaidRouteKey = keyof typeof DAILY_AI_LIMITS;

/** Friendly refusal once the day's quota is used, or null while under it. */
export function dailyLimitMessage(route: PaidRouteKey, count: number): string | null {
  const limit = DAILY_AI_LIMITS[route];
  if (count <= limit) return null;
  return route === "ai-scout"
    ? `You've used all ${limit} AI Scout reports for today. They reset at midnight UTC.`
    : `You've read ${limit} photos with AI today, the daily limit. It resets at midnight UTC.`;
}

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

/**
 * Count this call against the caller's daily quota, as the caller (their own
 * token, so the RPC's auth.uid() is them). Returns the new count, or null when
 * the RPC failed — callers refuse in that case rather than allowing.
 */
async function bumpDailyUsage(token: string, route: PaidRouteKey): Promise<number | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_ai_usage`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_route: route }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      // 404 / PGRST202 = the function doesn't exist: run supabase/fixes-2026-10.sql.
      console.error(
        `[apiGuard] bump_ai_usage RPC failed (HTTP ${response.status}) for route "${route}". ` +
          (response.status === 404 || detail.includes("PGRST202")
            ? "The database function public.bump_ai_usage(p_route text) is missing — run supabase/fixes-2026-10.sql. "
            : "") +
          `Refusing the paid call. ${detail}`,
      );
      return null;
    }

    const value: unknown = await response.json();
    const count = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(count)) {
      console.error(
        `[apiGuard] bump_ai_usage returned a non-number for route "${route}"; refusing the paid call.`,
      );
      return null;
    }
    return count;
  } catch (error) {
    console.error(
      `[apiGuard] bump_ai_usage RPC could not be reached for route "${route}"; refusing the paid call.`,
      error,
    );
    return null;
  }
}

/**
 * Read the body as text, stopping as soon as it passes `maxBytes` — so a
 * request without (or lying about) Content-Length can't make us buffer an
 * unbounded body. Returns null when over the limit.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
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
  routeKey: PaidRouteKey,
  limits: PaidRouteLimits,
): Promise<GuardResult> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limits.maxBodyBytes) {
    return fail("Request is too large.", 413);
  }

  let identity = "local";
  let token: string | null = null;

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    token = bearerToken(request);
    const userId = token ? await verifySupabaseUser(token) : null;

    if (!userId) return fail("Sign in to use this feature.", 401);

    identity = userId;
  } else if (REQUIRE_AUTH) {
    // Sign-in is required but the server can't check it: fail closed rather
    // than letting anyone spend the API key.
    console.error(
      "[apiGuard] NEXT_PUBLIC_REQUIRE_AUTH is true but Supabase URL / anon key are not set; refusing paid calls.",
    );
    return fail("This feature is unavailable right now (sign-in isn't set up).", 503);
  }

  // In-memory burst guard (per instance) before touching the database.
  if (!takeToken(`${routeKey}:${identity}`, limits.limit, limits.windowMs)) {
    return fail("Too many requests. Wait a few minutes and try again.", 429);
  }

  let raw: string | null;
  try {
    raw = await readBodyWithLimit(request, limits.maxBodyBytes);
  } catch {
    return fail("Could not read the request.", 400);
  }

  if (raw === null) {
    return fail("Request is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  // Charge the daily quota only for a request we'd actually run.
  if (token) {
    const count = await bumpDailyUsage(token, routeKey);
    if (count === null) {
      return fail("This feature is unavailable right now. Try again later.", 503);
    }
    const overLimit = dailyLimitMessage(routeKey, count);
    if (overLimit) return fail(overLimit, 429);
  }

  return { ok: true, body };
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
