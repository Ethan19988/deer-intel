"use client";

import { authHeaders } from "@/lib/supabaseClient";
import {
  AI_SCOUT_STREAM_CONTENT_TYPE,
  INITIAL_SCOUT_STREAM_STATE,
  applyScoutStreamEvent,
  createLineSplitter,
  parseScoutStreamLine,
  type ScoutStreamState,
} from "@/lib/aiScoutStream";
import type {
  AiScoutErrorResponse,
  AiScoutPartialReport,
  AiScoutReport,
  AiScoutRequestContext,
  AiScoutStatusResponse,
} from "@/types/aiScout";

/** Cheap check the AI Scout page uses to decide whether to show the ask button. */
export async function checkAiScoutConfigured(): Promise<boolean> {
  try {
    const response = await fetch("/api/ai-scout", { method: "GET" });

    if (!response.ok) return false;

    const data = (await response.json()) as AiScoutStatusResponse;

    return Boolean(data.configured);
  } catch {
    return false;
  }
}

/** Thrown when an answer fails partway; carries whatever had arrived. */
export class AiScoutStreamError extends Error {
  partial: AiScoutPartialReport;

  constructor(message: string, partial: AiScoutPartialReport) {
    super(message);
    this.name = "AiScoutStreamError";
    this.partial = partial;
  }
}

type RequestOptions = {
  /** Called with the report-so-far each time more of the answer arrives. */
  onPartial?: (partial: AiScoutPartialReport) => void;
};

/** Whether this browser can read a fetch body as a stream. */
function canReadStreams(): boolean {
  return (
    typeof ReadableStream !== "undefined" &&
    typeof TextDecoder !== "undefined" &&
    typeof Response !== "undefined" &&
    "body" in Response.prototype
  );
}

/**
 * Ask the server for a report. Streams (NDJSON) when the browser can read
 * streams, calling onPartial as fields arrive; falls back to one JSON answer
 * otherwise, or when the server replies with plain JSON (errors before the
 * model started, or an older deployment).
 */
export async function requestAiScoutReport(
  context: AiScoutRequestContext,
  options: RequestOptions = {},
): Promise<AiScoutReport> {
  const stream = canReadStreams();
  const response = await fetch("/api/ai-scout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(stream ? { accept: `${AI_SCOUT_STREAM_CONTENT_TYPE}, application/json` } : {}),
      ...(await authHeaders()),
    },
    body: JSON.stringify(context),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (stream && response.ok && response.body && contentType.includes(AI_SCOUT_STREAM_CONTENT_TYPE)) {
    return readScoutStream(response.body, options.onPartial);
  }

  // A platform timeout or outage can return an HTML page, not JSON.
  let data: AiScoutReport | AiScoutErrorResponse;
  try {
    data = (await response.json()) as AiScoutReport | AiScoutErrorResponse;
  } catch {
    throw new Error(
      response.ok
        ? "AI Scout sent back a response it couldn't read. Try again."
        : `AI Scout is unavailable right now (status ${response.status}). Try again in a minute.`,
    );
  }

  if (!response.ok || "error" in data) {
    const message = "error" in data ? data.error : "AI Scout request failed.";

    throw new Error(message);
  }

  return data;
}

async function readScoutStream(
  body: ReadableStream<Uint8Array>,
  onPartial?: (partial: AiScoutPartialReport) => void,
): Promise<AiScoutReport> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const lines = createLineSplitter();
  let state: ScoutStreamState = INITIAL_SCOUT_STREAM_STATE;

  const apply = (rawLines: string[]) => {
    let changed = false;
    for (const rawLine of rawLines) {
      const event = parseScoutStreamLine(rawLine);
      if (!event) continue;
      state = applyScoutStreamEvent(state, event);
      changed = true;
    }
    if (changed && !state.report && !state.error) onPartial?.(state.partial);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      apply(lines.feed(decoder.decode(value, { stream: true })));
      if (state.report || state.error) break;
    }
    if (!state.report && !state.error) apply(lines.feed(decoder.decode()).concat(lines.flush()));
  } catch {
    throw new AiScoutStreamError(
      "Lost the connection partway through AI Scout's answer. Try again.",
      state.partial,
    );
  } finally {
    reader.cancel().catch(() => undefined);
  }

  if (state.report) return state.report;

  throw new AiScoutStreamError(
    state.error || "AI Scout's answer stopped before it finished. Try again.",
    state.partial,
  );
}
