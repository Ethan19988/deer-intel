import { CORRUPT_STATE_KEY_PREFIX } from "@/lib/storeQuarantine";

// Which localStorage keys hold the hunter's personal records (cleared by
// Settings → Clear All Local Data) versus device preferences and public-data
// caches (kept). When adding a new "deer-intel:*" key, add it to one list.

/** Exact keys holding records, drafts, or location-derived personal data. */
export const PERSONAL_DATA_KEYS: readonly string[] = [
  // lib/deerIntelStore (state + legacy properties), lib/cloudSync.
  "deer-intel:state",
  "deer-intel:properties",
  "deer-intel:sync-meta",
  "deer-intel:device-owner",
  // Set-aside copies kept by lib/storeQuarantine and lib/restoreUndo.
  "deer-intel:quarantine",
  "deer-intel:corrupt-state-index",
  "deer-intel:restore-undo",
  // lib/landTags.
  "deer-intel:land-tags",
  // lib/imageStore — ids of photos queued for cloud upload.
  "deer-intel:pending-photo-uploads",
  // In-progress field work: lib/sitDraft, lib/activeFieldSession.
  "deer-intel:sit-draft",
  "deer-intel:active-walk",
  "deer-intel:active-blood-trail",
  // Property forecast (lib/forecastSnapshot) and shared-sighting region cache
  // (lib/sharedSightings) — both derived from property locations.
  "deer-intel:forecast-snapshot",
  "deer-intel:region-cache",
  // Backup bookkeeping about the records (lib/backupReminder,
  // components/BackupReminderBanner) and sent-alert dedupe (lib/notifications).
  "deer-intel:last-backup",
  "deer-intel:backup-reminder-snoozed",
  "deer-intel:notified",
];

/** Key prefixes for per-property / per-account personal entries. */
export const PERSONAL_DATA_KEY_PREFIXES: readonly string[] = [
  // Damaged-save copies (timestamped).
  CORRUPT_STATE_KEY_PREFIX,
  // Last AI Scout answer per property (lib/aiScoutHistory).
  "deer-intel:ai-scout-last:",
  // Sightings already shared, per account (lib/sharedSightings).
  "deer-intel:shared-keys:",
];

/**
 * IndexedDB databases holding personal files: trail-cam photos (lib/imageStore)
 * and attached documents (lib/fileStore). The restore-undo database is emptied
 * through lib/restoreUndo instead. Offline map tiles live in the Cache API
 * (lib/offlineMaps) and are deliberately kept — they're public map imagery,
 * not records.
 */
export const PERSONAL_DATA_DATABASES: readonly string[] = [
  "deer-intel-images",
  "deer-intel-files",
];

/** True when Clear All should remove this localStorage key. */
export function isPersonalDataKey(key: string): boolean {
  return (
    PERSONAL_DATA_KEYS.includes(key) ||
    PERSONAL_DATA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

/** The personal keys present in `keys` (e.g. every localStorage key). */
export function personalDataKeysIn(keys: Iterable<string>): string[] {
  return [...keys].filter(isPersonalDataKey);
}
