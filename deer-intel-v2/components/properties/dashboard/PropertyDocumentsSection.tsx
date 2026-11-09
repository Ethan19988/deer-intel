"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { updateDeerIntelStore } from "@/lib/deerIntelStore";
import { deleteFile, getFile } from "@/lib/fileStore";
import { formatDayWithAgo } from "@/lib/relativeDate";
import type { DocumentRecord } from "@/types/document";

type PropertyDocumentsSectionProps = {
  documents: DocumentRecord[];
};

// Leases, maps and permits attached to this property (added on
// /documents/import). Bytes live in IndexedDB (lib/fileStore); Open hands the
// stored file to the browser in a new tab, Delete drops the record and file.
export default function PropertyDocumentsSection({
  documents,
}: PropertyDocumentsSectionProps) {
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(
    null,
  );
  const [error, setError] = useState("");

  async function openDocument(document: DocumentRecord) {
    setError("");
    // Open the tab inside the tap so iOS Safari doesn't block it as a popup,
    // then point it at the file once the bytes come back from IndexedDB.
    const tab = window.open("", "_blank");
    const blob = document.fileId ? await getFile(document.fileId) : null;

    if (!blob) {
      tab?.close();
      setError(`"${document.label}" isn't stored on this device.`);
      return;
    }

    const typed =
      blob.type || !document.fileType
        ? blob
        : new Blob([blob], { type: document.fileType });
    const url = URL.createObjectURL(typed);

    if (tab) {
      tab.location.href = url;
    } else {
      window.open(url, "_blank");
    }

    // Long enough for the new tab to load the file before the URL goes away.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function confirmDelete() {
    const document = pendingDelete;
    setPendingDelete(null);
    if (!document) return;

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      documents: currentState.documents.filter(
        (item) => item.id !== document.id,
      ),
    }));

    if (document.fileId) void deleteFile(document.fileId);
  }

  const ordered = [...documents].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

  return (
    <div style={listStyle}>
      {ordered.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Attach leases, maps, permits or notes so they're with you in the field."
          action={
            <Link href="/documents/import" className="di-link-btn">
              Add documents
            </Link>
          }
        />
      ) : (
        <>
          {ordered.map((document) => (
            <Card key={document.id} style={rowStyle}>
              <div style={infoStyle}>
                <p style={nameStyle}>{document.label || document.fileName}</p>
                <p style={metaStyle}>
                  {[
                    fileKindLabel(document),
                    formatFileSize(document.fileSize),
                    formatDayWithAgo(document.createdAt, undefined, ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div style={actionsStyle}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void openDocument(document)}
                  disabled={!document.fileId}
                >
                  Open
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setPendingDelete(document)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          <Link href="/documents/import" className="di-link-btn" style={addLinkStyle}>
            Add documents
          </Link>
        </>
      )}

      {error ? (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document?"
        description={`"${pendingDelete?.label || pendingDelete?.fileName || "This document"}" will be removed from this device. This can't be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function fileKindLabel(document: DocumentRecord) {
  const extension = document.fileName.split(".").pop();
  if (extension && extension !== document.fileName) return extension.toUpperCase();
  if (document.fileType === "application/pdf") return "PDF";
  if (document.fileType.startsWith("image/")) return "Image";
  return "";
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem 1rem",
  background: "var(--surface)",
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  flex: "1 1 180px",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontWeight: 700,
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexShrink: 0,
};

const addLinkStyle: CSSProperties = {
  justifySelf: "start",
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  fontWeight: 600,
};
