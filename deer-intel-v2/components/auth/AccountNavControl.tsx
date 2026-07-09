"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncStatusLabel, syncStatusTone } from "@/lib/syncStatus";

const TONE_COLORS: Record<string, string> = {
  default: "#85a984",
  success: "#5fd07a",
  warning: "#e3c65a",
  danger: "#ff8f8f",
};

// Compact account entry point for the primary nav. Renders nothing when cloud
// sync is not configured, so the local-only app looks exactly as before.
export default function AccountNavControl() {
  const { configured, status, syncStatus } = useAuth();

  if (!configured) return null;

  if (status !== "signed-in") {
    return (
      <Link href="/login" style={signInStyle}>
        Sign In
      </Link>
    );
  }

  const tone = syncStatusTone(syncStatus);

  return (
    <Link href="/settings" style={accountStyle} aria-label="Account and sync">
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
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "#dce9da",
  fontSize: "0.92rem",
  fontWeight: 850,
  textDecoration: "none",
};

const signInStyle: CSSProperties = {
  ...baseLinkStyle,
  borderColor: "#3b6843",
  background: "#18351d",
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
