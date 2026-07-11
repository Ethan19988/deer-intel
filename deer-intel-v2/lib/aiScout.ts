import type { AiScoutReport, AiScoutRequestContext } from "@/types/aiScout";

// Server-only module: reads process.env.ANTHROPIC_API_KEY directly, so this
// must only ever be imported from a Route Handler (app/api/**/route.ts) or
// other server-side code, never from a "use client" component or anything
// that ends up in the browser bundle.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Default model used when ANTHROPIC_MODEL is not set. Anthropic periodically
// ships newer models — check https://docs.claude.com/en/docs/about-claude/models
// if you want to point this at something newer than what shipped with this code.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

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
- Factor the moon phase into deer-movement timing, not just stand choice. As a rule of thumb: a
  bright moon (full or a waxing/waning gibbous) lets deer feed overnight, which tends to slow
  dawn/dusk movement and push more activity toward midday; a dark moon (new or thin crescent)
  concentrates movement into the first and last light windows. Use this to advise WHEN to be in
  the stand today, and reflect it in the key factors.
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

export async function generateAiScoutReport(
  context: AiScoutRequestContext,
): Promise<AiScoutReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new AiScoutError(
      "AI Scout is not configured yet. Add ANTHROPIC_API_KEY to this project's environment variables to enable it.",
      503,
    );
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const userMessage = `Here is the saved Deer Intel data for this property, as JSON:\n\n${JSON.stringify(
    context,
    null,
    2,
  )}\n\nUsing only this data, recommend which stand to hunt and why, then call ${REPORT_TOOL_NAME} with your answer.`;

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
      }),
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

    if (status === 429) {
      throw new AiScoutError(
        "The AI service is rate-limited right now. Wait a moment and try again.",
        429,
      );
    }

    throw new AiScoutError(
      detail || `AI Scout request failed (status ${status}).`,
      status,
    );
  }

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

  if (!toolUseBlock) {
    throw new AiScoutError("AI Scout returned an unexpected response format.", 502);
  }

  return normalizeReport(toolUseBlock.input);
}

function normalizeReport(rawInput: unknown): AiScoutReport {
  const input = rawInput as Partial<AiScoutReport> | null | undefined;

  if (!input || typeof input !== "object") {
    throw new AiScoutError("AI Scout returned an unexpected response format.", 502);
  }

  return {
    headline: typeof input.headline === "string" ? input.headline : "No headline provided.",
    recommendedStandName:
      typeof input.recommendedStandName === "string" ? input.recommendedStandName : "Not specified",
    recommendedStandReasoning:
      typeof input.recommendedStandReasoning === "string" ? input.recommendedStandReasoning : "",
    keyFactors: Array.isArray(input.keyFactors)
      ? input.keyFactors.filter((factor): factor is string => typeof factor === "string")
      : [],
    risks: Array.isArray(input.risks)
      ? input.risks.filter((risk): risk is string => typeof risk === "string")
      : [],
    confidence:
      input.confidence === "low" || input.confidence === "medium" || input.confidence === "high"
        ? input.confidence
        : "low",
  };
}
