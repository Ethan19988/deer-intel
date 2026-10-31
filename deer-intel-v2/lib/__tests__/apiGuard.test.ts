import { describe, expect, it } from "vitest";
import { DAILY_AI_LIMITS, dailyLimitMessage, readBodyWithLimit } from "@/lib/apiGuard";

describe("dailyLimitMessage", () => {
  it("allows up to the daily limit and refuses above it", () => {
    expect(DAILY_AI_LIMITS["ai-scout"]).toBe(40);
    expect(DAILY_AI_LIMITS["photo-stamp"]).toBe(300);
    expect(dailyLimitMessage("ai-scout", 40)).toBeNull();
    expect(dailyLimitMessage("ai-scout", 41)).toMatch(/40 AI Scout/);
    expect(dailyLimitMessage("photo-stamp", 300)).toBeNull();
    expect(dailyLimitMessage("photo-stamp", 301)).toMatch(/300 photos/);
  });
});

function streamRequest(chunks: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("http://localhost/api", {
    method: "POST",
    body,
    // Required by Node's fetch for a streamed body.
    duplex: "half",
  } as RequestInit);
}

describe("readBodyWithLimit", () => {
  it("returns the body when under the limit", async () => {
    expect(await readBodyWithLimit(streamRequest(['{"a":', "1}"]), 100)).toBe('{"a":1}');
  });

  it("stops reading once the limit is passed (no Content-Length)", async () => {
    expect(await readBodyWithLimit(streamRequest(["x".repeat(60), "y".repeat(60)]), 100)).toBeNull();
  });

  it("handles an empty body", async () => {
    expect(await readBodyWithLimit(new Request("http://localhost/api", { method: "POST" }), 10)).toBe("");
  });
});
