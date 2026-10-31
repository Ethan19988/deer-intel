import { NextResponse } from "next/server";
import {
  AiScoutError,
  generateAiScoutReport,
  isAiScoutConfigured,
  streamAiScoutReport,
} from "@/lib/aiScout";
import { AI_SCOUT_STREAM_CONTENT_TYPE } from "@/lib/aiScoutStream";
import { guardPaidRoute } from "@/lib/apiGuard";
import type { AiScoutRequestContext } from "@/types/aiScout";

// AI Scout is opt-in and pay-per-call, so this route intentionally does two
// separate things:
//   GET  -> cheap "is this even configured" check the UI uses to decide
//           whether to show the "Ask AI Scout" button at all.
//   POST -> the actual LLM call, made only when the hunter clicks the button.
//           Streams NDJSON (lib/aiScoutStream) when the request's Accept
//           header asks for application/x-ndjson; plain JSON otherwise.
//
// The guard (sign-in, burst limit, daily quota) always runs before anything
// is sent upstream, and errors that happen before the model starts answering
// are still plain JSON with a real status code — only mid-answer failures
// arrive as an in-stream `error` line.

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

  const wantsStream = (request.headers.get("accept") ?? "").includes(
    AI_SCOUT_STREAM_CONTENT_TYPE,
  );

  try {
    if (wantsStream) {
      const stream = await streamAiScoutReport(context as AiScoutRequestContext);

      return new Response(stream, {
        headers: {
          "content-type": `${AI_SCOUT_STREAM_CONTENT_TYPE}; charset=utf-8`,
          "cache-control": "no-store, no-transform",
          // Ask proxies (nginx-style) not to buffer the stream.
          "x-accel-buffering": "no",
        },
      });
    }

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
