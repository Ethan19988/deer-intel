"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import {
  createDeerIntelId,
  updateDeerIntelStore,
} from "@/lib/deerIntelStore";
import { putFile } from "@/lib/fileStore";
import type { DocumentRecord } from "@/types/document";

type DocumentInsertButtonProps = {
  // The property the inserted files are attached to. When empty, the button
  // stays tappable but explains that a property is needed first.
  propertyId: string;
};

// One big, unmistakable tap target for adding a PDF, image, or any file. The
// whole tile is the button so there's no doubt where to press — it's shared by
// the Documents hub so the "insert" affordance looks identical everywhere.
export default function DocumentInsertButton({
  propertyId,
}: DocumentInsertButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function openFilePicker() {
    inputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Allow re-selecting the same file after removing it.
    event.target.value = "";

    if (files.length === 0) return;

    if (!propertyId) {
      setError("Add a property before attaching files.");
      return;
    }

    setError("");
    setIsSaving(true);
    setMessage(
      `Saving ${files.length} ${files.length === 1 ? "file" : "files"}…`,
    );

    const createdAt = new Date().toISOString();
    const newRecords: DocumentRecord[] = [];
    let failed = 0;

    for (const file of files) {
      const fileId = createDeerIntelId("file");
      const stored = await putFile(fileId, file);

      if (!stored) {
        failed += 1;
        continue;
      }

      newRecords.push({
        id: createDeerIntelId("document"),
        propertyId,
        label: file.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileId,
        notes: "",
        createdAt,
      });
    }

    if (newRecords.length > 0) {
      updateDeerIntelStore((currentState) => ({
        ...currentState,
        documents: [...currentState.documents, ...newRecords],
      }));
    }

    setIsSaving(false);
    setMessage(
      newRecords.length > 0
        ? `${newRecords.length} ${newRecords.length === 1 ? "file" : "files"} added.`
        : "",
    );
    setError(
      failed > 0
        ? `${failed} ${failed === 1 ? "file" : "files"} couldn't be saved — this browser may be blocking storage.`
        : "",
    );
  }

  return (
    <div style={wrapStyle}>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        style={hiddenInputStyle}
      />
      <button
        type="button"
        onClick={openFilePicker}
        disabled={isSaving}
        style={dropZoneStyle}
      >
        <span style={dropIconStyle} aria-hidden="true">
          +
        </span>
        <span style={dropTitleStyle}>
          {isSaving ? "Saving…" : "Tap here to insert a PDF or image"}
        </span>
        <span style={dropHintStyle}>
          Add a PDF, photo, or any file from this device.
        </span>
      </button>

      {message ? (
        <p style={messageStyle} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p style={errorTextStyle} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const dropZoneStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.5rem",
  width: "100%",
  padding: "2rem 1.4rem",
  border: "2px dashed var(--accent)",
  borderRadius: "12px",
  background: "var(--surface-2)",
  color: "var(--text)",
  textAlign: "center",
  cursor: "pointer",
};

const dropIconStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  borderRadius: "999px",
  background: "var(--accent)",
  color: "white",
  fontSize: "1.8rem",
  fontWeight: 800,
  lineHeight: 1,
};

const dropTitleStyle: CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 850,
};

const dropHintStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
  maxWidth: "34rem",
};

const messageStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--accent-text)",
  fontWeight: 800,
};

const errorTextStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};
