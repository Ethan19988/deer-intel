import { NextResponse } from "next/server";
import { AiScoutError, generateAiScoutReport, isAiScoutConfigured } from "@/lib/aiScout";
import { guardPaidRoute } from "@/lib/apiGuard";
import type { AiScoutRequestContext } from "@/types/aiScout";

// AI Scout is opt-in and pay-per-call, so this route intentionally does two
// separate things:
//   GET  -> cheap "is this even configured" check the UI uses to decide
//           whether to show the "Ask AI Scout" button at all.
//   POST -> the actual LLM call, made only when the hunter clicks the button.

export async function GET() {
  return NextResponse.json({ configured: isAiScoutConfigured() });
}

// The client trims the context (capped lists, short notes), so a real request
// is a few KB. These per-instance burst limits stop a runaway loop; the hard
// per-user daily quota lives in DAILY_AI_LIMITS (lib/apiGuard).
const AI_SCOUT_LIMITS = {
  limit: 20,
  windowMs: 60 * 60 * 1000,
  maxBodyBytes: 200_000,
};

export async function POST(request: Request) {
  const guard = await guardPaidRoute(request, "ai-scout", AI_SCOUT_LIMITS);
  if (!guard.ok) return guard.response;

  const context = guard.body as Partial<AiScoutRequestContext> | null;

  if (!context || typeof context !== "object" || !context.property) {
    return NextResponse.json(
      { error: "Request is missing the property context to analyze." },
      { status: 400 },
    );
  }

  try {
    const report = await generateAiScoutReport(context as AiScoutRequestContext);

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
