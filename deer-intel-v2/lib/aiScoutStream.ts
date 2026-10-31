import type {
  AiScoutPartialReport,
  AiScoutReport,
  AiScoutStreamEvent,
} from "@/types/aiScout";

// Pure helpers for streaming AI Scout answers. Shared by the server (turning
// the Anthropic SSE stream into our NDJSON events) and the browser (rebuilding
// a partial report from the JSON as it arrives). No env access, no DOM.
//
// Wire format, route -> browser: one JSON object per line (NDJSON):
//   {"type":"delta","text":"<next slice of the tool input JSON>"}
//   {"type":"done","report":{...validated AiScoutReport}}
//   {"type":"error","error":"<friendly message>"}

export const AI_SCOUT_STREAM_CONTENT_TYPE = "application/x-ndjson";

const REPORT_TOOL_NAME = "submit_scout_report";

// ---------------------------------------------------------------------------
// Report validation

/** Coerce the tool input into a full report, or null when it isn't an object. */
export function normalizeAiScoutReport(rawInput: unknown): AiScoutReport | null {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) return null;
  const input = rawInput as Partial<Record<keyof AiScoutReport, unknown>>;

  return {
    headline: typeof input.headline === "string" ? input.headline : "No headline provided.",
    recommendedStandName:
      typeof input.recommendedStandName === "string" ? input.recommendedStandName : "Not specified",
    recommendedStandReasoning:
      typeof input.recommendedStandReasoning === "string" ? input.recommendedStandReasoning : "",
    keyFactors: stringList(input.keyFactors) ?? [],
    risks: stringList(input.risks) ?? [],
    confidence: isConfidence(input.confidence) ? input.confidence : "low",
  };
}

/** Only the fields that have (at least partly) arrived, each with the right type. */
export function toPartialReport(value: unknown): AiScoutPartialReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Partial<Record<keyof AiScoutReport, unknown>>;
  const partial: AiScoutPartialReport = {};

  if (typeof input.headline === "string") partial.headline = input.headline;
  if (typeof input.recommendedStandName === "string") {
    partial.recommendedStandName = input.recommendedStandName;
  }
  if (typeof input.recommendedStandReasoning === "string") {
    partial.recommendedStandReasoning = input.recommendedStandReasoning;
  }
  const keyFactors = stringList(input.keyFactors);
  if (keyFactors) partial.keyFactors = keyFactors;
  const risks = stringList(input.risks);
  if (risks) partial.risks = risks;
  if (isConfidence(input.confidence)) partial.confidence = input.confidence;

  return partial;
}

export function hasPartialContent(partial: AiScoutPartialReport | null | undefined): boolean {
  if (!partial) return false;
  return Boolean(
    partial.headline ||
      partial.recommendedStandName ||
      partial.recommendedStandReasoning ||
      partial.keyFactors?.some(Boolean) ||
      partial.risks?.some(Boolean),
  );
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function isConfidence(value: unknown): value is AiScoutReport["confidence"] {
  return value === "low" || value === "medium" || value === "high";
}

// ---------------------------------------------------------------------------
// Tolerant partial-JSON parser

type ScanResult = {
  /** Open containers, innermost last. */
  stack: Array<"{" | "[">;
  /** Index of the opening quote of an unterminated string, or -1. */
  openStringStart: number;
  /** Whether that unterminated string is an object key. */
  openStringIsKey: boolean;
  /** Index where an unfinished escape sequence starts inside it, or -1. */
  openEscapeStart: number;
};

function scanJson(text: string): ScanResult {
  const stack: Array<"{" | "["> = [];
  // Parallel to stack: for objects, whether the next string is a key.
  const expectKey: boolean[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === '"') {
      const start = index;
      const top = stack.length - 1;
      const isKey = top >= 0 && stack[top] === "{" && expectKey[top];
      index += 1;
      let closed = false;
      while (index < text.length) {
        const inner = text[index];
        if (inner === "\\") {
          const span = text[index + 1] === "u" ? 6 : 2;
          if (index + span > text.length) {
            return { stack, openStringStart: start, openStringIsKey: isKey, openEscapeStart: index };
          }
          index += span;
          continue;
        }
        if (inner === '"') {
          closed = true;
          index += 1;
          break;
        }
        index += 1;
      }
      if (!closed) {
        return { stack, openStringStart: start, openStringIsKey: isKey, openEscapeStart: -1 };
      }
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      expectKey.push(char === "{");
    } else if (char === "}" || char === "]") {
      stack.pop();
      expectKey.pop();
    } else if (char === ":") {
      if (stack.length) expectKey[stack.length - 1] = false;
    } else if (char === ",") {
      const top = stack.length - 1;
      if (top >= 0 && stack[top] === "{") expectKey[top] = true;
    }
    index += 1;
  }

  return { stack, openStringStart: -1, openStringIsKey: false, openEscapeStart: -1 };
}

const TRAILING_KEY_NO_VALUE = /,?\s*"(?:[^"\\]|\\.)*"\s*:?\s*$/;
const TRAILING_PARTIAL_TOKEN = /[-+.eE0-9a-z]+$/;

/**
 * Best-effort parse of a JSON document that may be cut off anywhere: closes an
 * open string (dropping a half-written escape), drops a dangling key, comma or
 * half-typed literal, then closes open objects/arrays. Returns undefined when
 * nothing sensible can be recovered. Complete JSON parses exactly as JSON.parse.
 */
export function parsePartialJson(text: string): unknown {
  const source = text.trim();
  if (!source) return undefined;

  try {
    return JSON.parse(source);
  } catch {
    // fall through to repair
  }

  let working = source;
  const scan = scanJson(working);

  if (scan.openStringStart >= 0) {
    if (scan.openStringIsKey) {
      working = working.slice(0, scan.openStringStart);
    } else {
      const cut = scan.openEscapeStart >= 0 ? scan.openEscapeStart : working.length;
      working = `${working.slice(0, cut)}"`;
    }
  }

  // Trim dangling pieces until stable. Only text outside strings can be hit
  // here: any open string was closed or dropped above.
  for (let guard = 0; guard < 8; guard += 1) {
    const before = working;
    working = working.replace(/\s+$/, "");
    if (working.endsWith(",")) working = working.slice(0, -1);
    else if (working.endsWith(":")) working = working.replace(TRAILING_KEY_NO_VALUE, "");
    else if (/[{,]\s*"(?:[^"\\]|\\.)*"$/.test(working) && isTrailingKey(working)) {
      working = working.replace(TRAILING_KEY_NO_VALUE, "");
    } else {
      const token = TRAILING_PARTIAL_TOKEN.exec(working)?.[0];
      if (token && !isCompleteLiteral(token)) {
        working = working.slice(0, -token.length);
      }
    }
    if (working === before) break;
  }

  const { stack } = scanJson(working);
  const closers = stack
    .slice()
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");

  try {
    return JSON.parse(working + closers);
  } catch {
    return undefined;
  }
}

/** A complete string at the end of an object where a key is expected. */
function isTrailingKey(text: string): boolean {
  const match = /"(?:[^"\\]|\\.)*"$/.exec(text);
  if (!match) return false;
  const scan = scanJson(text.slice(0, match.index));
  // Re-scan up to the string: we're in key position if the last structural
  // char before it is "{" or "," inside an object.
  const head = text.slice(0, match.index).replace(/\s+$/, "");
  const last = head[head.length - 1];
  return scan.stack[scan.stack.length - 1] === "{" && (last === "{" || last === ",");
}

function isCompleteLiteral(token: string): boolean {
  if (token === "true" || token === "false" || token === "null") return true;
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(token);
}

// ---------------------------------------------------------------------------
// Server side: Anthropic SSE -> our stream events

export type SseMessage = { event: string; data: string };

/** Incremental Server-Sent Events parser. Feed decoded text; get whole messages. */
export function createSseParser() {
  let buffer = "";
  let pendingCr = "";

  function parseBlock(block: string): SseMessage | null {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    return data.length ? { event, data: data.join("\n") } : null;
  }

  return {
    feed(chunk: string): SseMessage[] {
      // A CRLF can be split across chunks: hold a trailing "\r" back until
      // the next chunk shows whether a "\n" follows it.
      let text = pendingCr + chunk;
      pendingCr = "";
      if (text.endsWith("\r")) {
        pendingCr = "\r";
        text = text.slice(0, -1);
      }
      buffer += text.replace(/\r\n?/g, "\n");
      const messages: SseMessage[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const message = parseBlock(buffer.slice(0, boundary));
        if (message) messages.push(message);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      return messages;
    },
    /** Whatever is left when the stream ends without a final blank line. */
    flush(): SseMessage[] {
      const rest = buffer.trim();
      buffer = "";
      pendingCr = "";
      const message = rest ? parseBlock(rest) : null;
      return message ? [message] : [];
    },
  };
}

type AnthropicStreamPayload = {
  type?: string;
  index?: number;
  content_block?: { type?: string; name?: string };
  delta?: { type?: string; partial_json?: string; stop_reason?: string };
  error?: { type?: string; message?: string };
};

/**
 * Turn decoded Anthropic Messages SSE text (stream: true, forced tool use)
 * into AI Scout stream events: a delta per input_json_delta of our tool's
 * block, then one final validated `done` — or an `error` with a friendly line.
 */
export async function* scoutEventsFromAnthropicSse(
  chunks: AsyncIterable<string>,
): AsyncGenerator<AiScoutStreamEvent> {
  const parser = createSseParser();
  let toolIndex: number | null = null;
  let json = "";
  let stopReason = "";
  let upstreamError = "";

  function* handle(messages: SseMessage[]): Generator<AiScoutStreamEvent> {
    for (const message of messages) {
      let payload: AnthropicStreamPayload;
      try {
        payload = JSON.parse(message.data) as AnthropicStreamPayload;
      } catch {
        continue;
      }
      const type = payload.type ?? message.event;

      if (type === "content_block_start") {
        if (
          payload.content_block?.type === "tool_use" &&
          payload.content_block.name === REPORT_TOOL_NAME
        ) {
          toolIndex = payload.index ?? 0;
        }
      } else if (type === "content_block_delta") {
        if (
          toolIndex !== null &&
          payload.index === toolIndex &&
          payload.delta?.type === "input_json_delta" &&
          typeof payload.delta.partial_json === "string" &&
          payload.delta.partial_json
        ) {
          json += payload.delta.partial_json;
          yield { type: "delta", text: payload.delta.partial_json };
        }
      } else if (type === "message_delta") {
        if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason;
      } else if (type === "error") {
        upstreamError = payload.error?.type ?? "error";
      }
    }
  }

  for await (const chunk of chunks) {
    yield* handle(parser.feed(chunk));
    if (upstreamError) break;
  }
  if (!upstreamError) yield* handle(parser.flush());

  if (upstreamError) {
    yield {
      type: "error",
      error:
        upstreamError === "overloaded_error" || upstreamError === "rate_limit_error"
          ? "The AI service got busy partway through. Try again in a moment."
          : "The AI service stopped partway through its answer. Try again.",
    };
    return;
  }

  let parsed: unknown;
  try {
    parsed = json ? JSON.parse(json) : undefined;
  } catch {
    parsed = undefined;
  }
  const report = normalizeAiScoutReport(parsed);

  if (!report) {
    yield {
      type: "error",
      error:
        stopReason === "max_tokens"
          ? "AI Scout's answer was cut off before it finished. Try again."
          : "AI Scout's answer ended before it finished. Try again.",
    };
    return;
  }

  yield { type: "done", report };
}

// ---------------------------------------------------------------------------
// Browser side: NDJSON lines -> report state

/** Incremental newline splitter for NDJSON. */
export function createLineSplitter() {
  let buffer = "";
  return {
    feed(chunk: string): string[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.map((line) => line.trim()).filter(Boolean);
    },
    flush(): string[] {
      const rest = buffer.trim();
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}

export function parseScoutStreamLine(line: string): AiScoutStreamEvent | null {
  try {
    const value = JSON.parse(line) as {
      type?: unknown;
      text?: unknown;
      error?: unknown;
      report?: unknown;
    } | null;
    if (!value || typeof value !== "object") return null;
    if (value.type === "delta" && typeof value.text === "string") {
      return { type: "delta", text: value.text };
    }
    if (value.type === "error" && typeof value.error === "string") {
      return { type: "error", error: value.error };
    }
    if (value.type === "done") {
      const report = normalizeAiScoutReport(value.report);
      return report ? { type: "done", report } : null;
    }
    return null;
  } catch {
    return null;
  }
}

export type ScoutStreamState = {
  /** Tool-input JSON received so far. */
  raw: string;
  partial: AiScoutPartialReport;
  report: AiScoutReport | null;
  error: string;
};

export const INITIAL_SCOUT_STREAM_STATE: ScoutStreamState = {
  raw: "",
  partial: {},
  report: null,
  error: "",
};

/** Fold one stream event into the running state. */
export function applyScoutStreamEvent(
  state: ScoutStreamState,
  event: AiScoutStreamEvent,
): ScoutStreamState {
  if (event.type === "delta") {
    const raw = state.raw + event.text;
    const parsed = parsePartialJson(raw);
    // An unrecoverable prefix keeps the last good partial rather than blanking it.
    return { ...state, raw, partial: parsed === undefined ? state.partial : toPartialReport(parsed) };
  }
  if (event.type === "done") {
    return { ...state, report: event.report, partial: event.report };
  }
  return { ...state, error: event.error };
}
