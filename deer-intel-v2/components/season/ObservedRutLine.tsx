"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  observedRutLead,
  readObservedRut,
  type ObservedRutRead,
} from "@/lib/observedRut";
import type { RutPhase } from "@/lib/seasonCalendar";
import { createStatsContext } from "@/lib/standStats";

type ObservedRutLineProps = {
  /** Property to read; defaults to the selected (else first) property. */
  propertyId?: string;
  /** Today's calendar phase, to say "ahead" / "behind". */
  calendarPhase: RutPhase;
};

// "On your ground": the rut as the hunter's own recent photos, sits and sign
// read it (lib/observedRut), tucked under the calendar ribbon. One compact
// line that expands to the evidence. Client-only (after mount) since the store
// and the clock both live in the browser.
export default function ObservedRutLine({
  propertyId,
  calendarPhase,
}: ObservedRutLineProps) {
  const state = useDeerIntelStore();
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    // Client-only clock so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const id =
    propertyId ||
    state.selectedPropertyId ||
    state.properties[0]?.id ||
    "";
  const property = state.properties.find((item) => item.id === id);
  const read: ObservedRutRead | null = useMemo(() => {
    if (!now || !id) return null;
    // Only sun times are used (for legal light), so no season prefs needed.
    const ctx = createStatsContext({
      lat: property?.latitude,
      lng: property?.longitude,
    });
    return readObservedRut({
      now,
      photos: state.photoRecords.filter((photo) => photo.propertyId === id),
      cameraChecks: state.cameraChecks.filter((check) => check.propertyId === id),
      hunts: state.hunts.filter((hunt) => hunt.propertyId === id),
      pins: state.pins.filter((pin) => pin.propertyId === id),
      sunFor: ctx.sunFor,
      calendarPhase,
    });
  }, [
    now,
    id,
    property?.latitude,
    property?.longitude,
    calendarPhase,
    state.photoRecords,
    state.cameraChecks,
    state.hunts,
    state.pins,
  ]);

  if (!read) return null;

  if (!read.enoughData) {
    return (
      <p style={{ ...wrapStyle, ...thinStyle }}>
        <span style={labelStyle}>On your ground</span>
        <span>{read.summary}</span>
      </p>
    );
  }

  const clear = read.phase !== "unclear";
  const lead = observedRutLead(read.evidence);
  const canExpand = read.evidence.length > 0;

  const line = (
    <>
      <span style={labelStyle}>On your ground</span>
      <span style={lineStyle}>
        {clear ? (
          <>
            <b style={phaseStyle}>{read.phaseLabel}</b>{" "}
            <span style={confStyle}>({read.confidence})</span>
            {lead ? ` — ${lead}` : ""}
            {read.calendarNote ? (
              <span style={calendarNoteStyle}> · {read.calendarNote}</span>
            ) : null}
          </>
        ) : (
          <>No clear pattern yet — calendar estimate shown</>
        )}
      </span>
    </>
  );

  return (
    <div style={wrapStyle}>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          style={rowButtonStyle}
        >
          {line}
          <span style={chevronStyle} aria-hidden="true">
            {open ? "▴" : "▾"}
          </span>
        </button>
      ) : (
        <div style={{ ...rowButtonStyle, cursor: "default" }}>{line}</div>
      )}

      {open && canExpand ? (
        <div id={panelId} style={panelStyle}>
          <ul style={listStyle}>
            {read.evidence.map((entry) => (
              <li key={entry} style={itemStyle}>
                {entry}
              </li>
            ))}
          </ul>
          <p style={footStyle}>
            {clear ? `Your cameras suggest ${read.phaseLabel.toLowerCase()}. ` : ""}
            From {read.sampleSize} deer photos and sightings in the last{" "}
            {read.windowDays} days, compared with the {read.windowDays} before.
            A hint from your own ground, not a rule.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  margin: 0,
  paddingTop: "0.45rem",
  borderTop: "1px dashed var(--border)",
};

const thinStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  lineHeight: 1.4,
};

const rowButtonStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  columnGap: "0.5rem",
  rowGap: "0.1rem",
  width: "100%",
  minHeight: "44px",
  padding: "0.25rem 0",
  border: 0,
  background: "transparent",
  color: "var(--text-muted)",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer",
};

const labelStyle: CSSProperties = {
  gridColumn: "1 / 2",
  display: "block",
  color: "var(--text-faint)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.66rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const lineStyle: CSSProperties = {
  gridColumn: "1 / 2",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const phaseStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 800,
};

const confStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.72rem",
  color: "var(--text-faint)",
};

const calendarNoteStyle: CSSProperties = {
  color: "var(--warning-text)",
  fontWeight: 700,
};

const chevronStyle: CSSProperties = {
  gridColumn: "2 / 3",
  gridRow: "1 / 3",
  display: "grid",
  placeItems: "center",
  width: "28px",
  height: "28px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-faint)",
  fontSize: "0.7rem",
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.6rem 0.7rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  margin: 0,
  paddingLeft: "1.1rem",
  color: "var(--text)",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const itemStyle: CSSProperties = {
  margin: 0,
};

const footStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.74rem",
  lineHeight: 1.4,
};
