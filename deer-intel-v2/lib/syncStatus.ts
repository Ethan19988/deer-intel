// Shared mapping from cloud-sync status to a short label + badge tone, so the
// nav control and the Settings page describe sync the same way.
export type SyncStatusValue =
  | "idle"
  | "reconciling"
  | "syncing"
  | "synced"
  | "error";

export type SyncBadgeTone = "default" | "success" | "warning" | "danger";

export function syncStatusLabel(status: SyncStatusValue): string {
  switch (status) {
    case "reconciling":
      return "Syncing…";
    case "syncing":
      return "Saving…";
    case "synced":
      return "Cloud synced";
    case "error":
      return "Sync error";
    default:
      return "Cloud ready";
  }
}

export function syncStatusTone(status: SyncStatusValue): SyncBadgeTone {
  switch (status) {
    case "synced":
      return "success";
    case "error":
      return "danger";
    case "reconciling":
    case "syncing":
      return "warning";
    default:
      return "default";
  }
}

export function formatLastSynced(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;

  const parsed = Date.parse(lastSyncedAt);
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toLocaleString();
}
