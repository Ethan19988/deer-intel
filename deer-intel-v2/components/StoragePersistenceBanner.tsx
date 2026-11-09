"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useStoragePersistenceFailed } from "@/lib/deerIntelStore";
import {
  dismissCorruptStoreNotice,
  downloadTextFile,
  readCorruptStateRaw,
  releaseUnsavedCorruptState,
  useCorruptStoreNotice,
} from "@/lib/storeQuarantine";
import { AlertIcon } from "@/components/ui/FieldIcons";

// A slim, global alert shown only when a save couldn't be written to
// localStorage (the device's storage is full). Without it, a failed save is
// silent and the hunter loses the change on the next reload. It clears itself
// automatically once a later save succeeds (e.g. after freeing space).
//
// It also reports a saved state that couldn't be read at all: the damaged
// save was copied aside (lib/storeQuarantine) and is offered as a download.
export default function StoragePersistenceBanner() {
  const failed = useStoragePersistenceFailed();
  const corrupt = useCorruptStoreNotice();

  if (corrupt) {
    const raw = readCorruptStateRaw(corrupt);

    const notice = corrupt;
    const handleDownload = () => {
      if (raw === null) return;
      downloadTextFile(raw, `deer-intel-damaged-save-${notice.at.slice(0, 10)}.json`);
      // Downloaded: the store may now save over the damaged original.
      if (notice.unsaved) releaseUnsavedCorruptState();
    };

    return (
      <div role="alert" style={bannerStyle}>
        <span style={iconStyle} aria-hidden="true">
          <AlertIcon size={20} />
        </span>
        <p style={textStyle}>
          <strong>Your saved data couldn&apos;t be read.</strong>{" "}
          {corrupt.unsaved
            ? "This device is too full to keep a copy, so nothing will be saved until you download it."
            : "The damaged save was set aside on this device so it isn't lost."}{" "}
          Download it to keep a copy.
        </p>
        {raw !== null ? (
          <button type="button" onClick={handleDownload} style={linkStyle}>
            Download
          </button>
        ) : null}
        {!corrupt.unsaved ? (
          <button
            type="button"
            onClick={() => dismissCorruptStoreNotice(corrupt.hash)}
            style={linkStyle}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    );
  }

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
      <Link href="/settings?tab=data" className="di-navbtn" style={linkStyle}>
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
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--danger-text)",
  background: "transparent",
  color: "var(--danger-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
