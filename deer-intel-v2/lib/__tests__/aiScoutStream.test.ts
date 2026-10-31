import { describe, expect, it } from "vitest";
import {
  INITIAL_SCOUT_STREAM_STATE,
  applyScoutStreamEvent,
  createLineSplitter,
  createSseParser,
  hasPartialContent,
  normalizeAiScoutReport,
  parsePartialJson,
  parseScoutStreamLine,
  scoutEventsFromAnthropicSse,
  toPartialReport,
} from "@/lib/aiScoutStream";
import type { AiScoutStreamEvent } from "@/types/aiScout";

const FULL = {
  headline: "Sit the Ridge Ladder at last light.",
  recommendedStandName: "Ridge Ladder",
  recommendedStandReasoning: "NW wind \"fits\" it.\nBucks on cam 2.",
  keyFactors: ["NW wind", "Fresh scrape"],
  risks: ["Thin data"],
  confidence: "medium",
};

describe("parsePartialJson", () => {
  it("parses complete JSON exactly", () => {
    expect(parsePartialJson(JSON.stringify(FULL))).toEqual(FULL);
  });

  it("returns something sensible for every prefix of a real answer", () => {
    const text = JSON.stringify(FULL);
    for (let cut = 1; cut <= text.length; cut += 1) {
      const value = parsePartialJson(text.slice(0, cut));
      if (value === undefined) continue;
      expect(typeof value).toBe("object");
      const partial = toPartialReport(value);
      // Whatever has arrived is a prefix of the final value.
      if (partial.headline !== undefined) expect(FULL.headline.startsWith(partial.headline)).toBe(true);
      if (partial.recommendedStandReasoning !== undefined) {
        expect(FULL.recommendedStandReasoning.startsWith(partial.recommendedStandReasoning)).toBe(true);
      }
      partial.keyFactors?.forEach((factor, index) => {
        expect(FULL.keyFactors[index].startsWith(factor)).toBe(true);
      });
    }
  });

  it("closes an open string and containers", () => {
    expect(parsePartialJson('{"headline":"Sit the ri')).toEqual({ headline: "Sit the ri" });
    expect(parsePartialJson('{"keyFactors":["NW wind","Fre')).toEqual({
      keyFactors: ["NW wind", "Fre"],
    });
  });

  it("drops a dangling key, colon, comma, or half escape", () => {
    expect(parsePartialJson('{"headline":"A","recommendedSt')).toEqual({ headline: "A" });
    expect(parsePartialJson('{"headline":"A","risks"')).toEqual({ headline: "A" });
    expect(parsePartialJson('{"headline":"A","risks":')).toEqual({ headline: "A" });
    expect(parsePartialJson('{"headline":"A",')).toEqual({ headline: "A" });
    expect(parsePartialJson('{"headline":"say \\')).toEqual({ headline: "say " });
    expect(parsePartialJson('{"headline":"x\\u00')).toEqual({ headline: "x" });
  });

  it("drops a half-typed literal", () => {
    expect(parsePartialJson('{"a":1,"b":tr')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":true')).toEqual({ a: true });
  });

  it("handles brackets inside strings", () => {
    expect(parsePartialJson('{"headline":"a {b} [c')).toEqual({ headline: "a {b} [c" });
  });

  it("returns undefined for empty input", () => {
    expect(parsePartialJson("")).toBeUndefined();
    expect(parsePartialJson("   ")).toBeUndefined();
  });
});

describe("report shaping", () => {
  it("normalizes with safe defaults", () => {
    expect(normalizeAiScoutReport({ keyFactors: ["a", 2] })).toEqual({
      headline: "No headline provided.",
      recommendedStandName: "Not specified",
      recommendedStandReasoning: "",
      keyFactors: ["a"],
      risks: [],
      confidence: "low",
    });
    expect(normalizeAiScoutReport(null)).toBeNull();
    expect(normalizeAiScoutReport([1])).toBeNull();
  });

  it("partial keeps only arrived, typed fields", () => {
    expect(toPartialReport({ headline: "x", confidence: "med" })).toEqual({ headline: "x" });
    expect(hasPartialContent({})).toBe(false);
    expect(hasPartialContent({ keyFactors: [""] })).toBe(false);
    expect(hasPartialContent({ headline: "x" })).toBe(true);
  });
});

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function* chunked(text: string, size: number) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect(gen: AsyncIterable<AiScoutStreamEvent>) {
  const out: AiScoutStreamEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

function anthropicStream(json: string, { stop = "tool_use", error = false } = {}) {
  const pieces = [json.slice(0, 10), json.slice(10, 40), json.slice(40)].filter(Boolean);
  return [
    sse("message_start", { type: "message_start", message: {} }),
    ": ping comment\n\n",
    sse("content_block_start", {
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", name: "submit_scout_report", input: {} },
    }),
    ...pieces.map((partial_json) =>
      sse("content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json },
      }),
    ),
    ...(error ? [sse("error", { type: "error", error: { type: "overloaded_error" } })] : []),
    sse("content_block_stop", { type: "content_block_stop", index: 0 }),
    sse("message_delta", { type: "message_delta", delta: { stop_reason: stop } }),
    sse("message_stop", { type: "message_stop" }),
  ].join("");
}

describe("SSE parsing", () => {
  it("splits messages across arbitrary chunk boundaries and CRLF", () => {
    const parser = createSseParser();
    const text = "event: a\r\ndata: 1\r\n\r\nevent: b\ndata: 2\n\n";
    const out = [...text].flatMap((char) => parser.feed(char));
    expect(out).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
    ]);
  });

  it("emits deltas then a validated done", async () => {
    const events = await collect(
      scoutEventsFromAnthropicSse(chunked(anthropicStream(JSON.stringify(FULL)), 7)),
    );
    const last = events[events.length - 1];
    expect(last).toEqual({ type: "done", report: FULL });
    const text = events
      .filter((e): e is Extract<AiScoutStreamEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(JSON.parse(text)).toEqual(FULL);
  });

  it("reports a cut-off answer", async () => {
    const events = await collect(
      scoutEventsFromAnthropicSse(
        chunked(anthropicStream(JSON.stringify(FULL).slice(0, 50), { stop: "max_tokens" }), 13),
      ),
    );
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    expect(last.type === "error" && last.error.includes("cut off")).toBe(true);
  });

  it("reports an upstream error event mid-stream", async () => {
    const events = await collect(
      scoutEventsFromAnthropicSse(chunked(anthropicStream(JSON.stringify(FULL), { error: true }), 50)),
    );
    expect(events.some((e) => e.type === "delta")).toBe(true);
    expect(events[events.length - 1]).toMatchObject({ type: "error" });
    expect(events.some((e) => e.type === "done")).toBe(false);
  });
});

describe("client stream state", () => {
  it("rebuilds the report line by line", () => {
    const json = JSON.stringify(FULL);
    const wire =
      [
        { type: "delta", text: json.slice(0, 30) },
        { type: "delta", text: json.slice(30) },
        { type: "done", report: FULL },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n";
    const splitter = createLineSplitter();
    let state = INITIAL_SCOUT_STREAM_STATE;
    const headlines: Array<string | undefined> = [];
    for (const char of wire) {
      for (const line of splitter.feed(char)) {
        const event = parseScoutStreamLine(line);
        if (event) state = applyScoutStreamEvent(state, event);
        headlines.push(state.partial.headline);
      }
    }
    expect(headlines[0]).toBe("Sit the Ridge Lad");
    expect(state.report).toEqual(FULL);
  });

  it("keeps partial content when an error line arrives", () => {
    let state = applyScoutStreamEvent(INITIAL_SCOUT_STREAM_STATE, {
      type: "delta",
      text: '{"headline":"Go',
    });
    state = applyScoutStreamEvent(state, { type: "error", error: "dropped" });
    expect(state.partial).toEqual({ headline: "Go" });
    expect(state.error).toBe("dropped");
  });

  it("ignores junk lines", () => {
    expect(parseScoutStreamLine("<html>")).toBeNull();
    expect(parseScoutStreamLine('{"type":"delta"}')).toBeNull();
  });
});
