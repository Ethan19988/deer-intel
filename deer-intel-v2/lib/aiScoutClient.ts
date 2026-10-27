"use client";

import { authHeaders } from "@/lib/supabaseClient";
import type {
  AiScoutErrorResponse,
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

export async function requestAiScoutReport(
  context: AiScoutRequestContext,
): Promise<AiScoutReport> {
  const response = await fetch("/api/ai-scout", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(context),
  });

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
