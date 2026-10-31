import { readStorageValue, writeStorageValue } from "@/lib/storage";
import type { AiScoutConditions, AiScoutReport } from "@/types/aiScout";

// The last AI Scout report per property, kept on this device so the AI page
// can show it the moment it opens — with no signal in the stand, and without
// paying for another call. Only the latest report per property is kept (one
// small key each), so storage stays bounded.

const KEY_PREFIX = "deer-intel:ai-scout-last:";

export type SavedAiScoutReport = {
  propertyId: string;
  /** Epoch ms the report came back. */
  savedAt: number;
  conditions: AiScoutConditions;
  report: AiScoutReport;
  /**
   * Fingerprint of the exact payload the report answered (lib/aiScoutReuse),
   * so an unchanged ask can reuse it. Missing on reports saved before this.
   */
  contextHash?: string;
};

export function savedAiScoutKey(propertyId: string): string {
  return `${KEY_PREFIX}${propertyId}`;
}

/** Validate a stored value; anything malformed or for another property is dropped. */
export function parseSavedAiScoutReport(
  raw: string | null,
  propertyId: string,
): SavedAiScoutReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedAiScoutReport> | null;
    if (
      !parsed ||
      parsed.propertyId !== propertyId ||
      typeof parsed.savedAt !== "number" ||
      !parsed.report ||
      typeof parsed.report.recommendedStandName !== "string" ||
      !Array.isArray(parsed.report.keyFactors) ||
      !Array.isArray(parsed.report.risks)
    ) {
      return null;
    }
    if (parsed.contextHash !== undefined && typeof parsed.contextHash !== "string") {
      const { contextHash: _dropped, ...rest } = parsed;
      void _dropped;
      return rest as SavedAiScoutReport;
    }
    return parsed as SavedAiScoutReport;
  } catch {
    return null;
  }
}

export function readSavedAiScoutReport(propertyId: string): SavedAiScoutReport | null {
  if (!propertyId) return null;
  return parseSavedAiScoutReport(readStorageValue(savedAiScoutKey(propertyId)), propertyId);
}

/** Save (replacing) this property's latest report. False if storage is full or blocked. */
export function writeSavedAiScoutReport(saved: SavedAiScoutReport): boolean {
  if (!saved.propertyId) return false;
  try {
    return writeStorageValue(savedAiScoutKey(saved.propertyId), JSON.stringify(saved));
  } catch {
    return false;
  }
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago". */
export function formatSavedAgo(savedAt: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - savedAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
