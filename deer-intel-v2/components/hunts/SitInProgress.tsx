"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CountField } from "@/components/hunts/HuntLogForm";
import { formatSitElapsed, type SitDraft } from "@/lib/sitDraft";

type SitInProgressProps = {
  draft: SitDraft;
  /** Live count edits; the page saves them to the draft as they change. */
  onCountChange: (field: "bucks" | "does" | "fawns", value: string) => void;
  onEnd: () => void;
  onDiscard: () => void;
};

// How often "1h 12m" refreshes while the page is open.
const TICK_MS = 30_000;

/**
 * The running sit, shown at the top of Log a sit: where you are, how long
 * you've been in, live deer counters, and the one action that matters — End sit.
 */
export default function SitInProgress({
  draft,
  onCountChange,
  onEnd,
  onDiscard,
}: SitInProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const startedAt = new Date(draft.startedAt);
  const inSince = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(startedAt);
  const elapsed = formatSitElapsed(draft.startedAt, now);
  const counts: { field: "bucks" | "does" | "fawns"; label: string }[] = [
    { field: "bucks", label: "Bucks seen" },
    { field: "does", label: "Does seen" },
    { field: "fawns", label: "Fawns seen" },
  ];

  return (
    <section style={panelStyle} aria-label="Sit in progress">
      <p style={eyebrowStyle}>Sit in progress</p>
      <h2 style={standStyle}>{draft.standName || "Stand"}</h2>
      <p style={timeStyle}>
        In since {inSince}
        {elapsed ? ` · ${elapsed}` : ""}
      </p>

      <div style={countsStyle}>
        {counts.map(({ field, label }) => (
          <CountField
            key={field}
            label={label}
            value={draft.values[field]}
            onChange={(value) => onCountChange(field, value)}
          />
        ))}
      </div>

      <Button type="button" fullWidth onClick={onEnd} style={endStyle}>
        End sit
      </Button>
      <Button
        type="button"
        variant="ghost"
        fullWidth
        onClick={() => setConfirmingDiscard(true)}
        style={discardStyle}
      >
        Discard sit
      </Button>

      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this sit?"
        description={`This throws away the sit at ${
          draft.standName || "this stand"
        } that started at ${inSince}, with its counts. Nothing is saved to your hunt log.`}
        confirmLabel="Discard sit"
        confirmVariant="danger"
        onCancel={() => setConfirmingDiscard(false)}
        onConfirm={() => {
          setConfirmingDiscard(false);
          onDiscard();
        }}
      />
    </section>
  );
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  padding: "1rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--accent-2)",
  background: "var(--surface)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-2-text, var(--accent-2))",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const standStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "2rem",
  fontWeight: 400,
  lineHeight: 1,
  letterSpacing: "0.03em",
};

const timeStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.85rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const countsStyle: CSSProperties = {
  borderTop: "1px solid var(--border)",
  marginTop: "0.25rem",
};

const endStyle: CSSProperties = {
  minHeight: "56px",
  marginTop: "0.5rem",
  fontSize: "1.35rem",
};

const discardStyle: CSSProperties = {
  minHeight: "44px",
};
