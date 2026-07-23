"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncStatusLabel, syncStatusTone } from "@/lib/syncStatus";

const TONE_COLORS: Record<string, string> = {
  default: "var(--accent-text)",
  success: "var(--success-text)",
  warning: "var(--warning-text)",
  danger: "var(--danger-text)",
};

// Compact account entry point for the primary nav. Renders nothing when cloud
// sync is not configured, so the local-only app looks exactly as before.
export default function AccountNavControl() {
  const { configured, status, syncStatus } = useAuth();

  if (!configured) return null;

  if (status !== "signed-in") {
    return (
      <Link href="/login" style={signInStyle} className="di-navbtn">
        Sign In
      </Link>
    );
  }

  const tone = syncStatusTone(syncStatus);

  return (
    <Link href="/settings" style={accountStyle} aria-label="Account and sync" className="di-navbtn">
      <span
        style={{ ...dotStyle, background: TONE_COLORS[tone] ?? TONE_COLORS.default }}
        aria-hidden
      />
      <span style={accountLabelStyle}>{syncStatusLabel(syncStatus)}</span>
    </Link>
  );
}

const baseLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "42px",
  flex: "0 0 auto",
  marginLeft: "auto",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.55rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
  fontSize: "0.92rem",
  fontWeight: 850,
  textDecoration: "none",
};

const signInStyle: CSSProperties = {
  ...baseLinkStyle,
  borderColor: "var(--accent)",
  background: "var(--accent)",
  color: "white",
};

const accountStyle: CSSProperties = {
  ...baseLinkStyle,
};

const dotStyle: CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  flex: "0 0 auto",
};

const accountLabelStyle: CSSProperties = {
  whiteSpace: "nowrap",
};
