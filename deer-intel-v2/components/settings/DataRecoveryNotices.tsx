"use client";

import { useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { countRecords } from "@/lib/backupReminder";
import { saveDeerIntelStore } from "@/lib/deerIntelStore";
import { replaceAllLandTags } from "@/lib/landTags";
import {
  clearRestoreUndo,
  restoreUndoMode,
  useRestoreUndo,
} from "@/lib/restoreUndo";
import { downloadTextFile, useQuarantine } from "@/lib/storeQuarantine";
import { localDateKey } from "@/lib/standPressure";

// Settings → Data notices for recovering data: records that couldn't be read
// and were set aside (quarantine), and "Undo restore" for 24 hours after a
// backup file replaced this device's records. Renders nothing when neither
// applies.
export default function DataRecoveryNotices() {
  const quarantine = useQuarantine();
  const undo = useRestoreUndo();
  const { configured, status, prepareBackupRestore } = useAuth();
  const cloudActive = configured && status === "signed-in";
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (quarantine.length === 0 && !undo && !message) return null;

  function handleDownloadQuarantine() {
    downloadTextFile(
      JSON.stringify(quarantine, null, 2),
      `deer-intel-set-aside-records-${localDateKey(new Date())}.json`,
    );
  }

  async function handleUndo() {
    setConfirmUndo(false);
    if (!undo) return;

    // Undo goes back the way the restore went. After a "replace" restore it is
    // another full replace (the restored records leave the cloud again and the
    // earlier ones return); after a "merge" restore it merges too, so cloud
    // records the restore never touched aren't deleted by the undo.
    await prepareBackupRestore(restoreUndoMode(undo));
    saveDeerIntelStore(undo.state);
    if (undo.landTags !== undefined) replaceAllLandTags(undo.landTags);
    await clearRestoreUndo();
    setMessage("Restore undone. Your earlier records are back.");
  }

  return (
    <div style={wrapStyle}>
      {quarantine.length > 0 ? (
        <div style={noticeStyle} role="status">
          <p style={textStyle}>
            {quarantine.length} record{quarantine.length === 1 ? "" : "s"}{" "}
            couldn&apos;t be read and {quarantine.length === 1 ? "was" : "were"}{" "}
            set aside — download {quarantine.length === 1 ? "it" : "them"} to
            keep a copy.
          </p>
          <Button type="button" variant="secondary" onClick={handleDownloadQuarantine}>
            Download
          </Button>
        </div>
      ) : null}

      {undo ? (
        <div style={noticeStyle} role="status">
          <p style={textStyle}>
            Restored &ldquo;{undo.fileName}&rdquo; {formatWhen(undo.at)}. You can
            undo it until {formatWhen(new Date(Date.parse(undo.at) + DAY_MS).toISOString())}.
          </p>
          <Button type="button" variant="secondary" onClick={() => setConfirmUndo(true)}>
            Undo restore
          </Button>
        </div>
      ) : null}

      {message ? (
        <p style={successStyle} role="status">
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmUndo && undo !== null}
        title="Undo restore?"
        description={`This puts back the ${undo ? countRecords(undo.state) : 0} records you had before the restore${
          !cloudActive
            ? ""
            : undo && restoreUndoMode(undo) === "merge"
              ? " on this device and merges them back into your cloud data"
              : ", on this device and in your cloud data"
        }. Changes made since the restore will be lost. Photos stay as they are.`}
        confirmLabel="Undo restore"
        confirmVariant="danger"
        onConfirm={() => void handleUndo()}
        onCancel={() => setConfirmUndo(false)}
      />
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  marginBottom: "1rem",
};

const noticeStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 0.9rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--warning-bg)",
};

const textStyle: CSSProperties = {
  margin: 0,
  flex: "1 1 16rem",
  color: "var(--warning-text)",
  lineHeight: 1.45,
};

const successStyle: CSSProperties = {
  margin: 0,
  color: "var(--success-text)",
  lineHeight: 1.5,
};
