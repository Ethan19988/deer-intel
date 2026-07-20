import { FRAME_DIRECTION_VALUES } from "@/lib/travelDirection";
import type { KnownBuckSummary, PhotoStamp } from "@/types/photoStamp";

// Server-only module: reads process.env.ANTHROPIC_API_KEY directly, so this must
// only ever be imported from a Route Handler (app/api/**/route.ts), never from a
// "use client" component or anything that ends up in the browser bundle.
//
// It sends a downscaled trail-camera photo to Claude vision and extracts the
// stamped date, time, temperature, and moon from the printed info bar, plus an
// identification of the animal in the frame (buck, doe, bear, ...).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Default model when ANTHROPIC_MODEL is not set. Must be a vision-capable
// model. Haiku reads the printed bar and identifies the animal at roughly a
// third of Sonnet's price — set ANTHROPIC_MODEL to a bigger model if buck
// matching ever needs more horsepower.
const DEFAULT_MODEL = "claude-haiku-4-5";

const STAMP_TOOL_NAME = "submit_photo_stamp";

// Must match the SPECIES_OPTIONS the photo forms offer.
const SPECIES_VALUES = [
  "Buck",
  "Doe",
  "Fawn",
  "Turkey",
  "Bear",
  "Coyote",
  "Other",
] as const;

// What the animal is doing — the movement intel a hunter patterns deer with.
const BEHAVIOR_VALUES = [
  "Traveling",
  "Feeding",
  "Chasing",
  "At scrape or rub",
  "Bedded",
  "Alert",
  "Other",
] as const;

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

function buildTool(unit: PhotoStampUnit, knownBucks: KnownBuckSummary[]) {
  const unitLabel = unit === "C" ? "Celsius" : "Fahrenheit";
  const matchProperties =
    knownBucks.length > 0
      ? {
          matchedBuckId: {
            type: "string",
            enum: [...knownBucks.map((buck) => buck.id), ""],
            description:
              "The id of the known buck this animal matches, based on antler configuration and body characteristics genuinely aligning with that buck's description. Empty string when the animal is not a buck, no description fits, or the descriptions are too thin to compare.",
          },
          matchConfidence: {
            type: "string",
            enum: ["likely", "possible", ""],
            description:
              '"likely" when multiple distinguishing characteristics align, "possible" when it plausibly fits but key details are unclear. Empty when no match is reported.',
          },
        }
      : {};

  return {
    name: STAMP_TOOL_NAME,
    description:
      "Report the data printed on the trail camera photo's info bar and the animal seen in the frame. Only report values that are clearly visible; never guess.",
    input_schema: {
      type: "object" as const,
      properties: {
        found: {
          type: "boolean",
          description:
            "True only if a printed data/info bar with any of these values is actually visible on the image.",
        },
        species: {
          type: "string",
          enum: [...SPECIES_VALUES, ""],
          description:
            'The main animal visible in the photo. "Buck" is a deer with visible antlers, "Doe" an adult deer without antlers, "Fawn" a young deer. Use "Other" for any other animal or a person/vehicle. Empty string if no animal is clearly visible.',
        },
        behavior: {
          type: "string",
          enum: [...BEHAVIOR_VALUES, ""],
          description:
            "What the main animal is doing in the frame. Empty string if no animal is visible or the behavior is unclear.",
        },
        travelDirectionInFrame: {
          type: "string",
          enum: [...FRAME_DIRECTION_VALUES, ""],
          description:
            "Which way the main animal is moving through the frame, judged from body orientation, head direction, and gait. Empty string when no animal is visible, it is bedded, or it stands square with no clear direction of movement.",
        },
        animalNotes: {
          type: "string",
          description:
            'One or two short sentences leading with the behavior and its hunting meaning, e.g. "Chasing — mature buck pushing a doe hard, rut movement" or "Traveling — buck on a steady walk along the trail; at this early-morning hour likely headed back to bedding". Empty string if no animal is visible.',
        },
        date: {
          type: "string",
          description:
            "The date printed on the photo, formatted strictly as YYYY-MM-DD. Empty string if no date is printed.",
        },
        time: {
          type: "string",
          description:
            'The time exactly as printed on the photo, including AM/PM when shown (e.g. "8:08 PM" or "20:08"). Do not convert it. Empty string if no time is printed.',
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
        windDirection: {
          type: "string",
          description:
            'The wind direction printed on the photo as a compass point (e.g. "NW", "SSE"). Empty string if none is printed.',
        },
        windSpeed: {
          type: "string",
          description:
            'The wind speed printed on the photo, exactly as shown with its unit (e.g. "5 mph"). Empty string if none is printed.',
        },
        humidity: {
          type: "string",
          description:
            'The humidity percentage printed on the photo as a plain number (e.g. "65"). Empty string if none is printed.',
        },
        ...matchProperties,
      },
      required: ["found"],
    },
  };
}

const SYSTEM_PROMPT = `You analyze trail camera photos for a hunting app. Your jobs:

1. Read the data overlay the camera printed onto the photo — usually a bar along the bottom edge showing the date, time, temperature, moon phase, and sometimes wind, humidity, camera name, or barometric pressure. Extract ONLY values that are clearly legible, and report the time exactly as printed (keep AM/PM; never convert it). Do not infer or guess a value that is not printed. If there is no printed overlay, report found = false.

2. Identify the main animal in the frame, if any. A whitetail deer with visible antlers is a "Buck"; an adult deer without visible antlers is a "Doe"; a young deer (small body, possibly spotted) is a "Fawn". Report "Other" for any animal outside the list (or a person/vehicle), and an empty species if nothing is clearly visible.

3. Read the animal's BEHAVIOR — this is the intel a hunter patterns deer with. Classify it (Traveling / Feeding / Chasing / At scrape or rub / Bedded / Alert) from body language: head down grazing = Feeding; steady purposeful walk, head level = Traveling; neck extended low behind another deer, running posture = Chasing (rut); working an overhanging branch or pawing dirt = At scrape or rub; lying down = Bedded; head up, ears forward, staring = Alert.

Also report travelDirectionInFrame — which way the animal is moving through the frame (Left to right / Right to left / Toward camera / Away from camera), judged from its body orientation, which way its head points, and its gait. The app combines this with the camera's compass facing to learn each buck's travel routes, so only report a direction when the animal is genuinely in motion or clearly oriented mid-walk; report none for a bedded, feeding-in-place, or square-standing animal.

Write animalNotes as one or two short sentences that LEAD with the behavior and say what it means for hunting. Use the time printed on the info bar for movement context: deer photographed traveling in early morning are usually returning to bedding; in late afternoon or evening, heading out to feed; midday movement during the rut means cruising for does. Examples: "Chasing — mature buck pushing a doe hard, rut is on." / "Traveling — 8-point on a steady walk at 6:40 AM, likely returning to bedding." / "Feeding — two does relaxed in the plot at last light." Count animals and antler points when countable. Never invent details you cannot see.

4. When the user message lists known bucks for this property, compare a photographed buck against each one's described characteristics — antler point count, rack shape (spread, tine length, drop tines, kickers, broken sides), and body marks (scars, ear notches, coloration). Report matchedBuckId ONLY when the visible characteristics genuinely align with one buck's description; use matchConfidence "likely" for a strong multi-feature match and "possible" for a plausible but partial one. When descriptions are too vague to distinguish, or the animal is not a buck, report no match. A wrong match pollutes a season of data — being unsure is the correct answer.

Always respond by calling the ${STAMP_TOOL_NAME} tool.`;

export async function readPhotoStamp(
  imageBase64: string,
  mediaType: string,
  unit: PhotoStampUnit,
  knownBucks: KnownBuckSummary[] = [],
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
                text: buildUserText(knownBucks),
              },
            ],
          },
        ],
        tools: [buildTool(unit, knownBucks)],
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

  return normalizeStamp(toolUseBlock.input, knownBucks);
}

function buildUserText(knownBucks: KnownBuckSummary[]): string {
  const base =
    "Read the printed info bar on this trail camera photo and identify the animal in the frame, then report both.";

  if (knownBucks.length === 0) return base;

  const buckLines = knownBucks
    .map(
      (buck) =>
        `- id "${buck.id}" — ${buck.name}: ${buck.description || "no description saved"}`,
    )
    .join("\n");

  return `${base}\n\nKnown bucks on this property (match only when characteristics genuinely align):\n${buckLines}`;
}

function normalizeStamp(
  rawInput: unknown,
  knownBucks: KnownBuckSummary[],
): PhotoStamp | null {
  if (!rawInput || typeof rawInput !== "object") return null;

  const input = rawInput as {
    found?: unknown;
    date?: unknown;
    time?: unknown;
    temperature?: unknown;
    moonPhase?: unknown;
    windDirection?: unknown;
    windSpeed?: unknown;
    humidity?: unknown;
    species?: unknown;
    behavior?: unknown;
    travelDirectionInFrame?: unknown;
    animalNotes?: unknown;
    matchedBuckId?: unknown;
    matchConfidence?: unknown;
  };

  // The stamp trio only counts when the model confirmed a printed overlay;
  // the animal identification stands on its own either way.
  const hasOverlay = input.found === true;
  const date = hasOverlay ? cleanDate(asString(input.date)) : "";
  const time = hasOverlay ? cleanTime(asString(input.time)) : "";
  const temperature = hasOverlay ? cleanNumber(asString(input.temperature)) : "";
  const moonPhase = hasOverlay ? asString(input.moonPhase).trim() : "";
  const windDirection = hasOverlay
    ? asString(input.windDirection).trim().toUpperCase().slice(0, 3)
    : "";
  const windSpeed = hasOverlay ? asString(input.windSpeed).trim().slice(0, 12) : "";
  const humidity = hasOverlay ? cleanNumber(asString(input.humidity)) : "";
  const species = cleanListedValue(asString(input.species), SPECIES_VALUES);
  const behavior = cleanListedValue(asString(input.behavior), BEHAVIOR_VALUES);
  const travelDirectionInFrame = cleanListedValue(
    asString(input.travelDirectionInFrame),
    FRAME_DIRECTION_VALUES,
  );
  const animalNotes = asString(input.animalNotes).trim().slice(0, 300);

  // A profile match only stands when the animal is a buck, the id is one we
  // actually offered, and a confidence came with it.
  const rawMatchId = asString(input.matchedBuckId).trim();
  const rawConfidence = asString(input.matchConfidence).trim();
  const matchIsValid =
    species === "Buck" &&
    rawMatchId !== "" &&
    knownBucks.some((buck) => buck.id === rawMatchId) &&
    (rawConfidence === "likely" || rawConfidence === "possible");
  const matchedProfileId = matchIsValid ? rawMatchId : "";
  const matchConfidence = matchIsValid
    ? (rawConfidence as "likely" | "possible")
    : "";

  const dateTime = date ? (time ? `${date}T${time}` : date) : "";

  if (!dateTime && !temperature && !moonPhase && !species && !animalNotes) {
    return null;
  }

  return {
    dateTime,
    temperature,
    moonPhase,
    windDirection,
    windSpeed,
    humidity,
    species,
    behavior,
    travelDirectionInFrame,
    animalNotes,
    matchedProfileId,
    matchConfidence,
  };
}

function cleanListedValue(
  value: string,
  allowed: readonly string[],
): string {
  const trimmed = value.trim();

  return allowed.includes(trimmed) ? trimmed : "";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanDate(value: string): string {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

// Accepts the time as printed — "8:08 PM", "08:08pm", or 24-hour "20:08" —
// and converts to 24-hour HH:mm. Trail cams print 12-hour time far more often
// than not, so the AM/PM conversion happens here rather than trusting the
// model to do arithmetic.
function cleanTime(value: string): string {
  const match = /(\d{1,2}):([0-5]\d)(?:\s*([AaPp])\.?\s*[Mm]\.?)?/.exec(
    value.trim(),
  );

  if (!match) return "";

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "P" && hour < 12) hour += 12;
  if (meridiem === "A" && hour === 12) hour = 0;
  if (hour > 23) return "";

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function cleanNumber(value: string): string {
  const match = /-?\d+(?:\.\d+)?/.exec(value.trim());

  return match ? match[0] : "";
}
