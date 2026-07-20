// The request header that carries a hunter's own Anthropic API key from their
// browser to this deployment's AI routes. Shared by the client helpers and the
// route handlers, so keep it in this tiny isomorphic module (no "use client").
export const AI_KEY_HEADER = "x-deer-intel-ai-key";

// Keys are short strings; anything huge in this header is garbage, not a key.
const MAX_KEY_LENGTH = 300;

/** Trim and bound a key value from a header or input; "" when unusable. */
export function sanitizeAiKey(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, MAX_KEY_LENGTH);
}
