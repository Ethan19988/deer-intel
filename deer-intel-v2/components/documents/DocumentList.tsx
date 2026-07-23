"use client";

import { useState, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { FileIcon } from "@/components/ui/FieldIcons";
import { updateDeerIntelStore } from "@/lib/deerIntelStore";
import { deleteFile, getFile } from "@/lib/fileStore";
import type { DocumentRecord } from "@/types/document";

type DocumentListProps = {
  documents: DocumentRecord[];
};

// Shows every file the hunter has inserted, newest first, so uploads aren't a
// black hole: each row opens the real file in a new tab and can be removed.
export default function DocumentList({ documents }: DocumentListProps) {
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  const ordered = [...documents].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  async function openDocument(document: DocumentRecord) {
    if (!document.fileId) {
      setError("This file's data is missing and can't be opened.");
      return;
    }

    setError("");
    setOpeningId(document.id);

    const blob = await getFile(document.fileId);

    setOpeningId("");

    if (!blob) {
      setError("Couldn't open this file — it may have been cleared from this device.");
      return;
    }

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // Give the new tab a moment to grab the blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function removeDocument(document: DocumentRecord) {
    if (
      !window.confirm(
        `Remove "${document.label}"? This can't be undone.`,
      )
    ) {
      return;
    }

    if (document.fileId) {
      void deleteFile(document.fileId);
    }

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      documents: currentState.documents.filter((entry) => entry.id !== document.id),
    }));
  }

  if (ordered.length === 0) {
    return (
      <EmptyState
        illustration={<FileIcon size={26} />}
        title="No documents yet"
        description="Insert a lease, permit, license, tag, regulation, or printed map with the button above and it will show up here."
      />
    );
  }

  return (
    <div style={listStyle}>
      {error ? (
        <p style={errorTextStyle} role="alert">
          {error}
        </p>
      ) : null}

      {ordered.map((document) => (
        <article key={document.id} style={rowStyle}>
          <span style={iconBadgeStyle} aria-hidden="true">
            <FileIcon size={20} />
          </span>

          <div style={infoStyle}>
            <h3 style={titleStyle}>{document.label}</h3>
            <div style={metaRowStyle}>
              {document.fileType ? (
                <Badge>{fileKindLabel(document.fileType)}</Badge>
              ) : null}
              {document.fileSize > 0 ? (
                <span style={metaTextStyle}>{formatFileSize(document.fileSize)}</span>
              ) : null}
              <span style={metaTextStyle}>{formatDate(document.createdAt)}</span>
            </div>
          </div>

          <div style={actionsStyle}>
            <Button
              type="button"
              variant="secondary"
              disabled={openingId === document.id}
              onClick={() => openDocument(document)}
            >
              {openingId === document.id ? "Opening…" : "Open"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeDocument(document)}
            >
              Remove
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function fileKindLabel(fileType: string): string {
  if (fileType === "application/pdf") return "PDF";
  if (fileType.startsWith("image/")) return "Image";
  const [, subtype] = fileType.split("/");
  return (subtype || "File").toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  padding: "0.85rem 1rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface-2)",
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.6rem",
  height: "2.6rem",
  flex: "none",
  borderRadius: "10px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const infoStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  lineHeight: 1.3,
  overflowWrap: "anywhere",
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginTop: "0.4rem",
};

const metaTextStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  flex: "none",
};
