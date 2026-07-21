"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import {
  createDeerIntelId,
  updateDeerIntelStore,
  useDeerIntelStore,
} from "@/lib/deerIntelStore";
import { deleteFile, getFile, putFile } from "@/lib/fileStore";
import type { DocumentRecord } from "@/types/document";

export default function DocumentImportPage() {
  const state = useDeerIntelStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    activeProperty?.id ?? "",
  );
  const propertyId = selectedPropertyId || activeProperty?.id || "";
  const propertyName =
    state.properties.find((property) => property.id === propertyId)?.name ??
    "No property selected";

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const documents = useMemo(
    () =>
      state.documents
        .filter((document) => document.propertyId === propertyId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.documents, propertyId],
  );

  function handlePropertyChange(nextPropertyId: string) {
    setSelectedPropertyId(nextPropertyId);
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: nextPropertyId,
    }));
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Allow re-selecting the same file after removing it.
    event.target.value = "";

    if (files.length === 0) return;

    if (!propertyId) {
      setError("Add or choose a property before attaching files.");
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
        ? `${newRecords.length} ${newRecords.length === 1 ? "file" : "files"} saved to ${propertyName}.`
        : "",
    );
    setError(
      failed > 0
        ? `${failed} ${failed === 1 ? "file" : "files"} couldn't be saved — this browser may be blocking storage.`
        : "",
    );
  }

  function updateLabel(documentId: string, label: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      documents: currentState.documents.map((document) =>
        document.id === documentId ? { ...document, label } : document,
      ),
    }));
  }

  async function openDocument(document: DocumentRecord) {
    setError("");

    if (!document.fileId) {
      setError("That file's contents weren't saved on this device.");
      return;
    }

    const blob = await getFile(document.fileId);

    if (!blob) {
      setError(
        "That file isn't on this device. Files stay on the device they were added to.",
      );
      return;
    }

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Give the new tab time to load before releasing the object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function removeDocument(document: DocumentRecord) {
    if (document.fileId) {
      void deleteFile(document.fileId);
    }

    updateDeerIntelStore((currentState) => ({
      ...currentState,
      documents: currentState.documents.filter(
        (item) => item.id !== document.id,
      ),
    }));
    setMessage(`Removed ${document.label || document.fileName}.`);
  }

  return (
    <PageShell>
      <Link href="/settings" style={backLinkStyle}>
        Back to Settings
      </Link>

      <Card as="section" variant="elevated" style={heroCardStyle}>
        <PageHeader
          eyebrow="Documents"
          title="Add a Document or Photo"
          description="Keep your leases, permits, licenses, tags, regulations, and printed maps right on the property — attach a PDF, an image, or any other file. Everything stays on this device."
          meta={<Badge>{documents.length} saved</Badge>}
        />
      </Card>

      <Section eyebrow="Destination" title="Which Property These Belong To">
        {state.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add a property before attaching documents."
            action={
              <Link href="/properties" style={primaryLinkStyle}>
                Add Property
              </Link>
            }
          />
        ) : (
          <Card as="div" variant="subtle">
            <label style={fieldStyle}>
              <span style={labelStyle}>Property</span>
              <select
                value={propertyId}
                onChange={(event) => handlePropertyChange(event.target.value)}
                style={inputStyle}
              >
                {state.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <p style={assignmentTextStyle}>
              Attached files are saved to {propertyName}.
            </p>
          </Card>
        )}
      </Section>

      <Section eyebrow="Upload" title="Add Your Files">
        <Card as="div" variant="subtle">
          {/* The whole tile is the tap target so it's obvious where to press. */}
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
            disabled={isSaving || !propertyId}
            style={dropZoneStyle}
          >
            <span style={dropIconStyle} aria-hidden="true">
              +
            </span>
            <span style={dropTitleStyle}>
              {isSaving ? "Saving…" : "Tap here to add a PDF, photo, or file"}
            </span>
            <span style={dropHintStyle}>
              Choose one or more files from this device. PDFs, images, and any
              other file type are welcome.
            </span>
          </button>

          {message ? <p style={messageStyle}>{message}</p> : null}
          {error ? (
            <p style={errorTextStyle} role="alert">
              {error}
            </p>
          ) : null}
        </Card>
      </Section>

      <Section eyebrow="Saved" title="Files on This Property">
        {documents.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Use the button above to attach a PDF, photo, or any file to this property."
          />
        ) : (
          <div style={docListStyle}>
            {documents.map((document) => (
              <Card key={document.id} as="article" variant="subtle">
                <div style={docHeaderStyle}>
                  <span style={docIconStyle} aria-hidden="true">
                    {fileEmoji(document.fileType, document.fileName)}
                  </span>
                  <div style={docTextStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Label</span>
                      <input
                        value={document.label}
                        onChange={(event) =>
                          updateLabel(document.id, event.target.value)
                        }
                        style={inputStyle}
                      />
                    </label>
                    <span style={docMetaStyle}>
                      {document.fileName}
                      {document.fileSize
                        ? ` · ${formatBytes(document.fileSize)}`
                        : ""}
                      {document.fileType ? ` · ${document.fileType}` : ""}
                    </span>
                  </div>
                </div>

                <div style={buttonRowStyle}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openDocument(document)}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeDocument(document)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}

function fileEmoji(fileType: string, fileName: string): string {
  const lowerName = fileName.toLowerCase();

  if (fileType.startsWith("image/") || /\.(jpe?g|png|heic|gif|webp)$/.test(lowerName)) {
    return "🖼️";
  }
  if (fileType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "📄";
  }

  return "📎";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const heroCardStyle: CSSProperties = {
  padding: "1.5rem",
};

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  color: "var(--text-muted)",
  fontWeight: 800,
  textDecoration: "none",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  padding: "0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
};

const assignmentTextStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
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
  margin: "1rem 0 0",
  color: "var(--accent-text)",
  fontWeight: 800,
};

const errorTextStyle: CSSProperties = {
  margin: "0.85rem 0 0",
  color: "var(--danger-text)",
  lineHeight: 1.5,
};

const docListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const docHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.85rem",
};

const docIconStyle: CSSProperties = {
  fontSize: "1.8rem",
  lineHeight: 1.2,
};

const docTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "grid",
  gap: "0.4rem",
};

const docMetaStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.9rem",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1rem",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 0.9rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};
