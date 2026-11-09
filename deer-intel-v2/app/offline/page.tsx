import Link from "next/link";
import type { CSSProperties } from "react";
import EmptyState from "@/components/ui/EmptyState";
import PageShell from "@/components/ui/PageShell";
import { AlertIcon } from "@/components/ui/FieldIcons";

// Static notice the service worker serves (app/sw.js/route.ts) when a page that
// was never saved on this phone is opened with no signal. It is pre-cached at
// install, so it always loads offline.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <PageShell maxWidth="640px">
      <EmptyState
        illustration={<AlertIcon size={26} />}
        title="You're offline"
        description="This page hasn't been saved on this phone yet. Pages you've opened before still work."
        action={
          <div style={actionsStyle}>
            <Link href="/" className="di-navbtn" style={primaryLinkStyle}>
              Today
            </Link>
            <Link href="/map" className="di-navbtn" style={secondaryLinkStyle}>
              Map
            </Link>
            <Link href="/hunt-log" className="di-navbtn" style={secondaryLinkStyle}>
              Log sit
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
