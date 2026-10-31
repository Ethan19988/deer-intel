import { normalizeAiScoutReport, scoutEventsFromAnthropicSse } from "@/lib/aiScoutStream";
import type {
  AiScoutReport,
  AiScoutRequestContext,
  AiScoutStreamEvent,
} from "@/types/aiScout";

// Server-only module: reads process.env.ANTHROPIC_API_KEY directly, so this
// must only ever be imported from a Route Handler (app/api/**/route.ts) or
// other server-side code, never from a "use client" component or anything
// that ends up in the browser bundle.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Default model used when ANTHROPIC_MODEL is not set. Haiku keeps the shared
// deployment's per-call cost low; set ANTHROPIC_MODEL to a bigger model if
// recommendations ever need more horsepower.
const DEFAULT_MODEL = "claude-haiku-5-5";

const REPORT_TOOL_NAME = "submit_scout_report";

const SYSTEM_PROMPT = `You are an expert whitetail deer hunting scout. You analyze one hunter's
saved data for a single property (stands, hunt log entries, camera checks, deer profiles, buck
photos) plus today's conditions, and recommend where and how they should hunt next.

Rules:
- Only use facts present in the provided data. Never invent sightings, dates, stand names, or
  deer that are not in the data.
- Be specific: cite the actual stand names, wind directions, and dates the hunter logged instead
  of generic hunting advice.
- If the data is thin (few hunts, few stands, little camera activity), say so plainly and set
  confidence to "low" rather than overstating certainty.
- Weigh today's conditions (wind, temperature, moon phase) against each stand's noted best/avoid
  winds and recent activity when picking a recommendation.
- Recent buck photos carry the conditions they were taken in (temperature, wind, moon) and
  behavior notes (traveling, feeding, chasing). Pattern them: if a buck shows up on a camera in
  conditions like today's, weight stands near that camera and say so.
- Factor the moon phase into deer-movement timing, not just stand choice. As a rule of thumb: a
  bright moon (full or a waxing/waning gibbous) lets deer feed overnight, which tends to slow
  dawn/dusk movement and push more activity toward midday; a dark moon (new or thin crescent)
  concentrates movement into the first and last light windows. Use this to advise WHEN to be in
  the stand today, and reflect it in the key factors.
- terrainPicks are spots predicted from a LiDAR terrain read (likely bedding, travel corridors,
  saddle/pinch crossings) using Penn State Deer-Forest movement rules. They are terrain-based
  PREDICTIONS, not confirmed sign — treat them as scouting leads to verify, never as observed
  deer. Weigh them most when stands and camera data are thin, and when a saved stand sits near a
  predicted saddle or bedding area (or the day's wind matches a pick's bestWind), point that out.
  If there are no stands but there are terrainPicks, you may recommend hunting near the strongest
  pick and say plainly it's a predicted spot to scout.
- Keep the tone practical and direct, like an experienced hunting buddy, not a generic assistant.`;

const REPORT_TOOL = {
  name: REPORT_TOOL_NAME,
  description: "Submit the structured hunting recommendation for this property.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: {
        type: "string",
        description: "One sentence summary of the recommendation.",
      },
      recommendedStandName: {
        type: "string",
        description:
          "The name of the recommended stand, exactly as given in the stand list. If no stands are usable, explain that instead.",
      },
      recommendedStandReasoning: {
        type: "string",
        description: "2-4 sentences explaining why this stand, tied to the specific data provided.",
      },
      keyFactors: {
        type: "array",
        items: { type: "string" },
        description: "3-5 short bullet points of the concrete factors driving this recommendation.",
      },
      risks: {
        type: "array",
        items: { type: "string" },
        description: "0-3 short caveats or risks, e.g. thin data, hunting pressure, wind mismatch.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How confident this recommendation is given the amount and recency of data available.",
      },
    },
    required: [
      "headline",
      "recommendedStandName",
      "recommendedStandReasoning",
      "keyFactors",
      "confidence",
    ],
  },
};

export function isAiScoutConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class AiScoutError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiScoutError";
    this.status = status;
  }
}

/**
 * Start the Messages API call. Resolves with an OK response (JSON, or an SSE
 * body when `stream` is true); every pre-answer failure throws AiScoutError
 * with a friendly message and status, so the route can still answer with a
 * plain JSON error before any streaming starts.
 */
async function startAnthropicCall(
  context: AiScoutRequestContext,
  options: { stream: boolean; signal?: AbortSignal },
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new AiScoutError(
      "AI Scout is not configured yet. Add ANTHROPIC_API_KEY to this project's environment variables to enable it.",
      503,
    );
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  // Compact JSON — pretty-printing the property context inflated every call's
  // input tokens by a quarter or more for zero gain the model cares about.
  const userMessage = `Here is the saved Deer Intel data for this property, as JSON:\n\n${JSON.stringify(
    context,
  )}\n\nUsing only this data, recommend which stand to hunt and why, then call ${REPORT_TOOL_NAME} with your answer.`;

  // Fail with a clear message before the platform's own function timeout.
  // The timeout also covers reading a streamed body.
  const timeout = AbortSignal.timeout(50_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;

  let response: Response;

  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [REPORT_TOOL],
        tool_choice: { type: "tool", name: REPORT_TOOL_NAME },
        ...(options.stream ? { stream: true } : {}),
      }),
      signal,
    });
  } catch {
    throw new AiScoutError(
      "Could not reach the AI service. Check network access and try again.",
      502,
    );
  }

  if (!response.ok) {
    const status = response.status;
    let detail = "";

    try {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      detail = errorBody?.error?.message ?? "";
    } catch {
      // ignore parse failures, we'll fall back to a generic message below
    }

    if (status === 401) {
      throw new AiScoutError(
        "The configured ANTHROPIC_API_KEY was rejected. Double-check the key in your environment variables.",
        401,
      );
    }

    if (status === 429 || status === 529) {
      throw new AiScoutError(
        "The AI service is busy right now. Wait a moment and try again.",
        429,
      );
    }

    if (status === 404) {
      throw new AiScoutError(
        "The AI model this app is set to use isn't available. Update ANTHROPIC_MODEL (or the default in lib/aiScout.ts).",
        502,
      );
    }

    if (detail) console.error("AI Scout request failed:", status, detail);

    throw new AiScoutError(
      `AI Scout request failed (status ${status}). Try again in a minute.`,
      status >= 500 ? 502 : status,
    );
  }

  return response;
}

export async function generateAiScoutReport(
  context: AiScoutRequestContext,
): Promise<AiScoutReport> {
  const response = await startAnthropicCall(context, { stream: false });

  const payload = (await response.json()) as {
    content?: Array<
      | { type: "tool_use"; name: string; input: unknown }
      | { type: "text"; text: string }
    >;
  };

  const toolUseBlock = payload.content?.find(
    (block): block is { type: "tool_use"; name: string; input: unknown } =>
      block.type === "tool_use" && block.name === REPORT_TOOL_NAME,
  );

  const report = toolUseBlock ? normalizeAiScoutReport(toolUseBlock.input) : null;

  if (!report) {
    throw new AiScoutError("AI Scout returned an unexpected response format.", 502);
  }

  return report;
}

/**
 * Streaming variant. Awaits the upstream response first (so auth / model /
 * busy errors still throw AiScoutError before anything is sent), then returns
 * an NDJSON byte stream of AiScoutStreamEvent lines: deltas of the tool-input
 * JSON as the model writes it, then one validated `done` or an `error`.
 */
export async function streamAiScoutReport(
  context: AiScoutRequestContext,
): Promise<ReadableStream<Uint8Array>> {
  const upstreamAbort = new AbortController();
  const response = await startAnthropicCall(context, {
    stream: true,
    signal: upstreamAbort.signal,
  });

  if (!response.body) {
    throw new AiScoutError("AI Scout returned an unexpected response format.", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  async function* decoded(): AsyncGenerator<string> {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  }

  const events = scoutEventsFromAnthropicSse(decoded());
  const line = (event: AiScoutStreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await events.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(line(next.value));
      } catch (error) {
        console.error("AI Scout stream failed mid-answer:", error);
        controller.enqueue(
          line({
            type: "error",
            error:
              error instanceof Error && error.name === "TimeoutError"
                ? "AI Scout took too long to finish. Try again."
                : "The connection to the AI service dropped partway through. Try again.",
          }),
        );
        controller.close();
      }
    },
    cancel() {
      // The hunter left the page: stop paying for tokens nobody will read.
      upstreamAbort.abort();
      reader.cancel().catch(() => undefined);
    },
  });
}
