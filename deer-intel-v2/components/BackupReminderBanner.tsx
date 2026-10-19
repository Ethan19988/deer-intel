"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  backupReminderStatus,
  useLastBackup,
  type BackupReminderStatus,
} from "@/lib/backupReminder";

type BackupReminderBannerProps = {
  currentRecordCount: number;
  // Milliseconds since epoch, or null until the client clock is known (keeps
  // server and first client render matching — no hydration mismatch).
  nowMs: number | null;
};

// A one-line, dismissible nudge to download a backup. Data lives only in this
// browser, so a manual backup is easy to forget; this surfaces when it's been a
// while or a fair amount of new data has piled up. Dismissing it hides it for a
// week. It links straight to the existing export in Settings.
const SNOOZE_KEY = "deer-intel:backup-reminder-snoozed";
const SNOOZE_MS = 7 * 86_400_000;

function snoozedUntil(): number {
  try {
    return Number(window.localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}
export default function BackupReminderBanner({
  currentRecordCount,
  nowMs,
}: BackupReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const lastBackup = useLastBackup();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnoozeUntil(snoozedUntil());
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // Storage blocked: it just hides for this visit.
    }
  }

  if (dismissed || nowMs === null || snoozeUntil === null || nowMs < snoozeUntil) {
    return null;
  }

  const status = backupReminderStatus({ lastBackup, currentRecordCount, nowMs });
  if (!status.shouldRemind) return null;

  return (
    <div role="status" style={bannerStyle}>
      <span style={iconStyle} aria-hidden="true">
        💾
      </span>
      <p style={textStyle} title="Your data lives only in this browser. A backup protects it if the browser is cleared or the phone is lost.">
        {headline(status)}
      </p>
      <Link href="/settings" className="di-navbtn" style={linkStyle}>
        Back up
      </Link>
      <button
        type="button"
        aria-label="Dismiss backup reminder"
        style={dismissStyle}
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}

function headline(status: BackupReminderStatus): string {
  if (status.reason === "never") {
    return "You haven't backed up yet.";
  }
  if (status.reason === "stale") {
    const days = status.daysSince ?? 0;
    return `It's been ${days} day${days === 1 ? "" : "s"} since your last backup.`;
  }
  return `You've added ${status.newRecords} record${
    status.newRecords === 1 ? "" : "s"
  } since your last backup.`;
}

const bannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  marginBottom: "0.75rem",
  padding: "0.4rem 0.5rem 0.4rem 0.8rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
};

const iconStyle: CSSProperties = {
  flex: "none",
  fontSize: "1rem",
  lineHeight: 1,
};

const textStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  fontSize: "0.85rem",
  fontWeight: 700,
  lineHeight: 1.3,
  color: "var(--warning-text)",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  padding: "0.3rem 0.7rem",
  borderRadius: "8px",
  border: "1px solid var(--warning-text)",
  background: "transparent",
  color: "var(--warning-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const dismissStyle: CSSProperties = {
  flex: "none",
  width: "36px",
  height: "36px",
  minHeight: "36px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "var(--warning-text)",
  fontSize: "1.2rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};
