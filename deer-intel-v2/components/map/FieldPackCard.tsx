"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  fieldPackAge,
  fieldPackItemLabel,
  fieldPackReady,
  type FieldPackItem,
  type FieldPackRecord,
  type FieldPackStep,
} from "@/lib/fieldPack";
import { formatOfflineSize } from "@/lib/offlineMaps";

// "Get ready for the field" — the one-tap offline prep in the map's Offline
// panel: a big button, step-by-step progress while it runs, and the checklist
// of what was saved with how old it is (stale after a day).

export type FieldPackStatus =
  | { phase: "idle" }
  | { phase: "running"; step: FieldPackStep }
  | { phase: "error"; message: string };

type FieldPackCardProps = {
  status: FieldPackStatus;
  record: FieldPackRecord | null;
  /** Why the button is off (no property / another download running), or "". */
  blockedReason: string;
  /** What area the pack will save, e.g. "hunt area" or "this view". */
  targetLabel: string;
  onRun: () => void;
  onCancel: () => void;
};

const STEP_LABEL: Record<FieldPackStep["step"], string> = {
  forecast: "Saving the forecast…",
  pages: "Saving app pages…",
  map: "Saving map tiles…",
  parcels: "Checking parcel lines…",
};

export default function FieldPackCard({
  status,
  record,
  blockedReason,
  targetLabel,
  onRun,
  onCancel,
}: FieldPackCardProps) {
  // Ticks so "saved 2 h ago" and the stale warning stay true while open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const running = status.phase === "running";
  const disabled = running || Boolean(blockedReason);
  const age = record ? fieldPackAge(record.savedAt, now) : null;

  return (
    <section style={cardStyle} aria-label="Field pack">
      <div style={headerRowStyle}>
        <p style={titleStyle}>Field pack</p>
        {age ? (
          <span style={age.stale ? staleBadgeStyle : freshBadgeStyle}>
            {age.stale ? `Stale · ${age.label}` : age.label}
          </span>
        ) : null}
      </div>

      <p style={bodyStyle}>
        One tap before you lose signal: saves the {targetLabel} map (satellite +
        topo + property lines), the 3-day forecast with legal light, and the
        app pages you&apos;ll open in the stand.
      </p>

      {status.phase === "running" ? (
        <FieldPackProgress step={status.step} onCancel={onCancel} />
      ) : (
        <button
          type="button"
          style={{ ...runButtonStyle, ...(disabled ? disabledStyle : null) }}
          disabled={disabled}
          onClick={onRun}
        >
          Get ready for the field
        </button>
      )}

      {blockedReason && !running ? <p style={hintStyle}>{blockedReason}</p> : null}
      {status.phase === "error" ? <p style={errorStyle}>{status.message}</p> : null}

      {record && !running ? (
        <FieldPackChecklist record={record} stale={Boolean(age?.stale)} />
      ) : null}
    </section>
  );
}

function FieldPackProgress({
  step,
  onCancel,
}: {
  step: FieldPackStep;
  onCancel: () => void;
}) {
  const progress = step.step === "map" ? step.progress : null;
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
  return (
    <div style={progressWrapStyle} aria-live="polite">
      <p style={stepStyle}>{STEP_LABEL[step.step]}</p>
      {progress ? (
        <>
          <div
            style={trackStyle}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.completed}
          >
            <div style={{ ...fillStyle, width: `${percent}%` }} />
          </div>
          <p style={metaStyle}>
            {progress.completed.toLocaleString()} / {progress.total.toLocaleString()} tiles ·{" "}
            {formatOfflineSize(progress.bytes)}
            {progress.failed > 0 ? ` · ${progress.failed} skipped` : ""}
          </p>
        </>
      ) : null}
      <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
        Stop
      </button>
    </div>
  );
}

function FieldPackChecklist({ record, stale }: { record: FieldPackRecord; stale: boolean }) {
  const ready = fieldPackReady(record.items);
  return (
    <div style={checklistStyle}>
      <p style={ready ? readyStyle : notReadyStyle}>
        {ready ? "Ready for the field" : "Not ready for the field"}
        <span style={propertyStyle}> · {record.propertyName}</span>
      </p>
      <ul style={listStyle}>
        {record.items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>
      {record.legalLight.length > 0 ? (
        <div style={legalWrapStyle}>
          <p style={legalHeadStyle}>Legal light (saved)</p>
          {record.legalLight.map((line) => (
            <p key={line} style={legalLineStyle}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {stale ? (
        <p style={staleNoteStyle}>
          Over a day old — run it again on signal so the forecast and map are
          current.
        </p>
      ) : null}
    </div>
  );
}

function ChecklistRow({ item }: { item: FieldPackItem }) {
  return (
    <li style={rowStyle}>
      <span aria-hidden="true" style={item.ok ? okMarkStyle : failMarkStyle}>
        {item.ok ? "✓" : "✗"}
      </span>
      <span style={rowLabelStyle}>
        {fieldPackItemLabel(item.id)}
        <span className="di-visually-hidden">{item.ok ? " saved" : " not saved"}</span>
      </span>
      {item.detail ? <span style={rowDetailStyle}>{item.detail}</span> : null}
    </li>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  padding: "0.7rem",
  border: "1px solid var(--accent-2-tint-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2-tint)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display)",
  fontSize: "1.15rem",
  letterSpacing: "0.03em",
};

const badgeBase: CSSProperties = {
  padding: "0.15rem 0.45rem",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const freshBadgeStyle: CSSProperties = {
  ...badgeBase,
  border: "1px solid var(--success-border)",
  background: "var(--success-bg)",
  color: "var(--success-text)",
};

const staleBadgeStyle: CSSProperties = {
  ...badgeBase,
  border: "1px solid var(--warning-border)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};

const runButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "48px",
  padding: "0.55rem 0.8rem",
  border: "1px solid var(--accent-2)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2)",
  color: "var(--accent-2-fg)",
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  fontSize: "1.1rem",
  letterSpacing: "0.04em",
};

const disabledStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const secondaryButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "44px",
  padding: "0.5rem 0.9rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  letterSpacing: "0.04em",
};

const progressWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const stepStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "0.88rem",
};

const trackStyle: CSSProperties = {
  width: "100%",
  height: "8px",
  overflow: "hidden",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-3)",
};

const fillStyle: CSSProperties = {
  height: "100%",
  background: "var(--accent)",
  transition: "width 140ms ease",
};

const metaStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.74rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "var(--danger-text)",
  fontSize: "0.84rem",
};

const checklistStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.55rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
};

const readyStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontFamily: "var(--font-display)",
  fontSize: "1.05rem",
  letterSpacing: "0.03em",
};

const notReadyStyle: CSSProperties = {
  ...readyStyle,
  color: "var(--warning-text)",
};

const propertyStyle: CSSProperties = {
  color: "var(--text-muted)",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.45rem",
  fontSize: "0.86rem",
};

const okMarkStyle: CSSProperties = {
  width: "1rem",
  color: "var(--accent-text)",
  fontWeight: 700,
};

const failMarkStyle: CSSProperties = {
  ...okMarkStyle,
  color: "var(--danger-text)",
};

const rowLabelStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.76rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const rowDetailStyle: CSSProperties = {
  marginLeft: "auto",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  textAlign: "right",
};

const legalWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
  paddingTop: "0.35rem",
  borderTop: "1px solid var(--border)",
};

const legalHeadStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const legalLineStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.78rem",
};

const staleNoteStyle: CSSProperties = {
  margin: 0,
  color: "var(--warning-text)",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};
