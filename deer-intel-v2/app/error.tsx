"use client";

import Link from "next/link";
import { useEffect, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { AlertIcon } from "@/components/ui/FieldIcons";

// Route-level crash screen. Rendered without PageShell on purpose: if the
// shell itself is what crashed, wrapping this in it would crash again.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={pageStyle}>
      <div style={cardWrapStyle}>
        <EmptyState
          illustration={<AlertIcon size={26} />}
          title="Something went wrong"
          description="This screen hit an error. Your saved data is safe. Try again, or head back to Today."
          action={
            <div style={actionsStyle}>
              <Button type="button" onClick={() => reset()}>
                Retry
              </Button>
              <Link href="/" className="di-navbtn" style={linkStyle}>
                Today
              </Link>
            </div>
          }
        />
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  flex: 1,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(1rem, 4vw, 2rem)",
  background: "var(--bg)",
  color: "var(--text)",
};

const cardWrapStyle: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.6rem",
};

const linkStyle: CSSProperties = {
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
