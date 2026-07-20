import { NextResponse } from "next/server";
import { AI_KEY_HEADER, sanitizeAiKey } from "@/lib/aiKeyHeader";
import { AiScoutError, generateAiScoutReport, isAiScoutConfigured } from "@/lib/aiScout";
import type { AiScoutRequestContext } from "@/types/aiScout";

// AI Scout is opt-in and pay-per-call, so this route intentionally does two
// separate things:
//   GET  -> cheap "is this even configured" check the UI uses to decide
//           whether to show the "Ask AI Scout" button at all.
//   POST -> the actual LLM call, made only when the hunter clicks the button.

export async function GET(request: Request) {
  // A hunter's own key (sent as a header from their browser) makes AI Scout
  // available even when the deployment has no env key of its own.
  const userKey = sanitizeAiKey(request.headers.get(AI_KEY_HEADER));

  return NextResponse.json({
    configured: isAiScoutConfigured() || Boolean(userKey),
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const context = body as Partial<AiScoutRequestContext> | null;

  if (!context || typeof context !== "object" || !context.property) {
    return NextResponse.json(
      { error: "Request is missing the property context to analyze." },
      { status: 400 },
    );
  }

  const userKey = sanitizeAiKey(request.headers.get(AI_KEY_HEADER));

  try {
    const report = await generateAiScoutReport(
      context as AiScoutRequestContext,
      userKey,
    );

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AiScoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "AI Scout hit an unexpected error. Try again." },
      { status: 500 },
    );
  }
}
