"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import DocumentInsertButton from "@/components/documents/DocumentInsertButton";
import DocumentList from "@/components/documents/DocumentList";
import { FileIcon } from "@/components/ui/FieldIcons";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import { useDeerIntelStore } from "@/lib/deerIntelStore";

export default function DocumentsPage() {
  const state = useDeerIntelStore();
  const activeProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ?? state.properties[0];
  const propertyId = activeProperty?.id ?? "";

  const propertyDocuments = state.documents.filter(
    (document) => document.propertyId === propertyId,
  );

  return (
    <PageShell maxWidth="820px">
      <PageHeader
        icon={<FileIcon size={26} />}
        eyebrow="Documents"
        title="Documents"
        description="Keep your leases, permits, licenses, tags, regulations, and printed maps on the property. Everything stays on this device."
        meta={
          activeProperty ? (
            <span>Attaching to {activeProperty.name}</span>
          ) : null
        }
      />

      {propertyId ? null : (
        <p style={noPropertyStyle}>
          <Link href="/properties" style={linkStyle}>
            Add a property
          </Link>{" "}
          first, then you can attach documents to it.
        </p>
      )}

      <Section eyebrow="Insert" title="Add a PDF or image">
        <DocumentInsertButton propertyId={propertyId} />
      </Section>

      <Section eyebrow="On this property" title="Saved documents">
        <DocumentList documents={propertyDocuments} />
      </Section>
    </PageShell>
  );
}

const noPropertyStyle: CSSProperties = {
  margin: "1.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const linkStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 800,
};
