import { describe, expect, it } from "vitest";
import {
  backupReminderStatus,
  BACKUP_REMINDER_MIN_RECORDS,
} from "@/lib/backupReminder";

const NOW = Date.parse("2024-11-15T00:00:00Z");
const day = 86_400_000;

describe("backupReminderStatus", () => {
  it("stays quiet on a near-empty app", () => {
    const status = backupReminderStatus({
      lastBackup: null,
      currentRecordCount: BACKUP_REMINDER_MIN_RECORDS - 1,
      nowMs: NOW,
    });
    expect(status.shouldRemind).toBe(false);
  });

  it("nudges when there's data but no backup yet", () => {
    const status = backupReminderStatus({
      lastBackup: null,
      currentRecordCount: 20,
      nowMs: NOW,
    });
    expect(status.shouldRemind).toBe(true);
    expect(status.reason).toBe("never");
  });

  it("stays quiet after a recent backup with little new data", () => {
    const status = backupReminderStatus({
      lastBackup: { at: "2024-11-14T00:00:00Z", recordCount: 30 },
      currentRecordCount: 32,
      nowMs: NOW,
    });
    expect(status.shouldRemind).toBe(false);
  });

  it("nudges when the last backup is stale", () => {
    const status = backupReminderStatus({
      lastBackup: {
        at: new Date(NOW - 14 * day).toISOString(),
        recordCount: 30,
      },
      currentRecordCount: 31,
      nowMs: NOW,
    });
    expect(status.shouldRemind).toBe(true);
    expect(status.reason).toBe("stale");
    expect(status.daysSince).toBe(14);
  });

  it("nudges when many records were added since the last backup", () => {
    const status = backupReminderStatus({
      lastBackup: { at: "2024-11-14T00:00:00Z", recordCount: 10 },
      currentRecordCount: 30,
      nowMs: NOW,
    });
    expect(status.shouldRemind).toBe(true);
    expect(status.reason).toBe("many-new");
    expect(status.newRecords).toBe(20);
  });
});
