// Length limits for text shared with a party. The database enforces the same
// limits (supabase/fixes-2026-11-second-pass.sql); the client trims first so a
// long name is shortened instead of the save failing.
export const PARTY_TEXT_LIMITS = {
  partyName: 60,
  displayName: 40,
  pinName: 80,
  notes: 500,
  buckNickname: 80,
  caption: 120,
  inviteCode: 16,
} as const;

/** Trim and cap a text field (by characters). */
export function clampPartyText(value: string | null | undefined, max: number): string {
  return Array.from((value ?? "").trim()).slice(0, max).join("").trim();
}
