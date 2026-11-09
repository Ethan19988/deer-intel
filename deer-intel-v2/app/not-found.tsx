import Link from "next/link";
import type { CSSProperties } from "react";
import EmptyState from "@/components/ui/EmptyState";
import PageShell from "@/components/ui/PageShell";
import { MapPinIcon } from "@/components/ui/FieldIcons";

// Shown for any URL with no page (and for notFound() calls).
export default function NotFound() {
  return (
    <PageShell maxWidth="640px">
      <EmptyState
        illustration={<MapPinIcon size={26} />}
        title="Page not found"
        description="That page doesn't exist. It may have moved, or the link is wrong."
        action={
          <div style={actionsStyle}>
            <Link href="/" className="di-navbtn" style={primaryLinkStyle}>
              Today
            </Link>
            <Link href="/map" className="di-navbtn" style={secondaryLinkStyle}>
              Map
            </Link>
          </div>
        }
      />
    </PageShell>
  );
}

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.6rem",
};

const linkBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "46px",
  padding: "0.72rem 0.95rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.15rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1,
  textDecoration: "none",
  color: "var(--text)",
};

const primaryLinkStyle: CSSProperties = {
  ...linkBaseStyle,
  borderColor: "var(--accent-2)",
  background: "var(--accent-2)",
  color: "var(--accent-2-fg)",
};

const secondaryLinkStyle: CSSProperties = linkBaseStyle;
