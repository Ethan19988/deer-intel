import type { PhotoStamp } from "@/types/photoStamp";

// Server-only module: reads process.env.ANTHROPIC_API_KEY directly, so this must
// only ever be imported from a Route Handler (app/api/**/route.ts), never from a
// "use client" component or anything that ends up in the browser bundle.
//
// It sends a small cropped strip of a trail-camera photo (the printed info bar)
// to Claude vision and extracts the stamped date, time, temperature, and moon.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Default model when ANTHROPIC_MODEL is not set. Must be a vision-capable model.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

const STAMP_TOOL_NAME = "submit_photo_stamp";

export type PhotoStampUnit = "F" | "C";

export function isPhotoVisionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class PhotoVisionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PhotoVisionError";
    this.status = status;
  }
}

function buildTool(unit: PhotoStampUnit) {
  const unitLabel = unit === "C" ? "Celsius" : "Fahrenheit";

  return {
    name: STAMP_TOOL_NAME,
    description:
      "Report the data printed on the trail camera photo's info bar. Only report values that are clearly printed on the image; never guess.",
    input_schema: {
      type: "object" as const,
      properties: {
        found: {
          type: "boolean",
          description:
            "True only if a printed data/info bar with any of these values is actually visible on the image.",
        },
        date: {
          type: "string",
          description:
            "The date printed on the photo, formatted strictly as YYYY-MM-DD. Empty string if no date is printed.",
        },
        time: {
          type: "string",
          description:
            "The time printed on the photo, formatted strictly as 24-hour HH:mm. Empty string if no time is printed.",
        },
        temperature: {
          type: "string",
          description: `The temperature printed on the photo, converted to ${unitLabel}, as a plain number with no unit or degree symbol (e.g. "41"). Empty string if no temperature is printed.`,
        },
        moonPhase: {
          type: "string",
          description:
            'The moon phase printed or shown as an icon on the photo, in words (e.g. "Full", "Waning gibbous", "New"). Empty string if none is shown.',
        },
      },
      required: ["found"],
    },
  };
}

const SYSTEM_PROMPT = `You read the data overlay that trail cameras print onto their photos — usually a bar along the bottom edge showing the date, time, temperature, moon phase, and sometimes a camera name or barometric pressure. Extract ONLY the values that are clearly legible on the image. Do not infer or guess any value that is not printed. If the image has no such printed overlay, report found = false. Always respond by calling the ${STAMP_TOOL_NAME} tool.`;

export async function readPhotoStamp(
  imageBase64: string,
  mediaType: string,
  unit: PhotoStampUnit,
): Promise<PhotoStamp | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new PhotoVisionError(
      "Photo reading is not configured. Add ANTHROPIC_API_KEY to this project's environment variables to enable it.",
      503,
    );
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Read the printed info bar on this trail camera photo and report its values.",
              },
            ],
          },
        ],
        tools: [buildTool(unit)],
        tool_choice: { type: "tool", name: STAMP_TOOL_NAME },
      }),
    });
  } catch {
    throw new PhotoVisionError(
      "Could not reach the AI service. Check network access and try again.",
      502,
    );
  }

  if (!response.ok) {
    const status = response.status;

    if (status === 401) {
      throw new PhotoVisionError(
        "The configured ANTHROPIC_API_KEY was rejected. Double-check the key in your environment variables.",
        401,
      );
    }

    if (status === 429) {
      throw new PhotoVisionError(
        "The AI service is rate-limited right now. Wait a moment and try again.",
        429,
      );
    }

    throw new PhotoVisionError(
      `Photo reading request failed (status ${status}).`,
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
      block.type === "tool_use" && block.name === STAMP_TOOL_NAME,
  );

  if (!toolUseBlock) return null;

  return normalizeStamp(toolUseBlock.input);
}

function normalizeStamp(rawInput: unknown): PhotoStamp | null {
  if (!rawInput || typeof rawInput !== "object") return null;

  const input = rawInput as {
    found?: unknown;
    date?: unknown;
    time?: unknown;
    temperature?: unknown;
    moonPhase?: unknown;
  };

  if (input.found !== true) return null;

  const date = cleanDate(asString(input.date));
  const time = cleanTime(asString(input.time));
  const temperature = cleanNumber(asString(input.temperature));
  const moonPhase = asString(input.moonPhase).trim();

  const dateTime = date ? (time ? `${date}T${time}` : date) : "";

  if (!dateTime && !temperature && !moonPhase) return null;

  return { dateTime, temperature, moonPhase };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanDate(value: string): string {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function cleanTime(value: string): string {
  const match = /([01]?\d|2[0-3]):([0-5]\d)/.exec(value.trim());

  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function cleanNumber(value: string): string {
  const match = /-?\d+(?:\.\d+)?/.exec(value.trim());

  return match ? match[0] : "";
}
