"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useStoragePersistenceFailed } from "@/lib/deerIntelStore";
import { AlertIcon } from "@/components/ui/FieldIcons";

// A slim, global alert shown only when a save couldn't be written to
// localStorage (the device's storage is full). Without it, a failed save is
// silent and the hunter loses the change on the next reload. It clears itself
// automatically once a later save succeeds (e.g. after freeing space).
export default function StoragePersistenceBanner() {
  const failed = useStoragePersistenceFailed();

  if (!failed) return null;

  return (
    <div role="alert" style={bannerStyle}>
      <span style={iconStyle} aria-hidden="true">
        <AlertIcon size={20} />
      </span>
      <p style={textStyle}>
        <strong>This device&apos;s storage is full.</strong> Recent changes may
        not be saved. Free up space by removing old offline maps or photos.
      </p>
      <Link href="/settings" className="di-navbtn" style={linkStyle}>
        Manage storage
      </Link>
    </div>
  );
}

const bannerStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "1rem",
  transform: "translateX(-50%)",
  zIndex: 2000,
  width: "min(680px, calc(100% - 1.5rem))",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.85rem 1rem",
  border: "1px solid var(--danger-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  boxShadow: "0 18px 40px -20px rgba(0, 0, 0, 0.5)",
};

const iconStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  color: "var(--danger-text)",
};

const textStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  fontSize: "0.88rem",
  lineHeight: 1.4,
  color: "var(--danger-text)",
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0.45rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid var(--danger-text)",
  background: "transparent",
  color: "var(--danger-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
