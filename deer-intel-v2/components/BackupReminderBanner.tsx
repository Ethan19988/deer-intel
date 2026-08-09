"use client";

import { useState, type CSSProperties } from "react";
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

// A gentle, dismissible nudge to download a backup. Data lives only in this
// browser, so a manual backup is easy to forget; this surfaces when it's been a
// while or a fair amount of new data has piled up. It never blocks anything and
// links straight to the existing export in Settings.
export default function BackupReminderBanner({
  currentRecordCount,
  nowMs,
}: BackupReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const lastBackup = useLastBackup();

  if (dismissed || nowMs === null) return null;

  const status = backupReminderStatus({ lastBackup, currentRecordCount, nowMs });
  if (!status.shouldRemind) return null;

  return (
    <div role="status" style={bannerStyle}>
      <span style={iconStyle} aria-hidden="true">
        💾
      </span>
      <p style={textStyle}>
        <strong>{headline(status)}</strong> Your data lives only in this
        browser — download a backup so a cleared browser or lost phone
        can&rsquo;t take your seasons with it.
      </p>
      <Link href="/settings" className="di-navbtn" style={linkStyle}>
        Back up
      </Link>
      <button
        type="button"
        aria-label="Dismiss backup reminder"
        style={dismissStyle}
        onClick={() => setDismissed(true)}
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
  gap: "0.75rem",
  padding: "0.8rem 1rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
};

const iconStyle: CSSProperties = {
  flex: "none",
  fontSize: "1.25rem",
  lineHeight: 1,
};

const textStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  fontSize: "0.9rem",
  lineHeight: 1.4,
  color: "var(--warning-text)",
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "40px",
  padding: "0.4rem 0.8rem",
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
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "var(--warning-text)",
  fontSize: "1.2rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};
