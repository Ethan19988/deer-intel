"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MovementForecast } from "@/lib/movementPrediction";
import {
  movementDayRead,
  PERIOD_SHORT,
  type TimelineSlot,
} from "@/lib/movementTimeline";

export type TimelineSlotView = TimelineSlot & { forecast: MovementForecast | null };

type MovementTimelineProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: TimelineSlotView[];
  /** Key of the window being shown; null = the current window. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

const PLAY_STEP_MS = 1600;

/**
 * Scrub tonight and tomorrow: a strip of time windows, each scored by the
 * movement model with that window's forecast wind. Picking one redraws the
 * Movement layer, scent cones and thermals for that time.
 */
export default function MovementTimeline({
  open,
  onOpenChange,
  slots,
  selectedKey,
  onSelect,
}: MovementTimelineProps) {
  const [playing, setPlaying] = useState(false);
  const indexRef = useRef(0);
  const activeIndex = Math.max(
    0,
    slots.findIndex((slot) => slot.key === selectedKey),
  );
  indexRef.current = activeIndex;

  useEffect(() => {
    if (!playing || slots.length === 0) return;
    const timer = setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= slots.length) {
        setPlaying(false);
        return;
      }
      onSelect(slots[next].key);
    }, PLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [playing, slots, onSelect]);

  if (slots.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="di-movement-timeline-toggle"
        style={toggleStyle}
        onClick={() => {
          onSelect(slots[0].key);
          onOpenChange(true);
        }}
      >
        <span aria-hidden="true" style={toggleIconStyle}>▶</span>
        Movement timeline
      </button>
    );
  }

  const active = slots[activeIndex];
  const forecast = active.forecast;
  const score = forecast?.score ?? 0;
  const factors = forecast?.factors.slice(0, 3) ?? [];

  return (
    <section
      className="di-movement-timeline"
      style={sheetStyle}
      aria-label="Movement timeline"
    >
      <div style={headRowStyle}>
        <span style={labelStyle}>Movement · next 36 hrs</span>
        <span style={headActionsStyle}>
          <button
            type="button"
            style={smallButtonStyle}
            onClick={() => {
              if (!playing && activeIndex >= slots.length - 1) onSelect(slots[0].key);
              setPlaying((value) => !value);
            }}
            aria-pressed={playing}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            style={smallButtonStyle}
            aria-label="Close movement timeline"
            onClick={() => {
              setPlaying(false);
              onOpenChange(false);
            }}
          >
            ✕
          </button>
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Time windows"
        style={{ ...stripStyle, gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
      >
        {slots.map((slot, index) => {
          const selected = index === activeIndex;
          const slotScore = slot.forecast?.score ?? 0;
          return (
            <button
              key={slot.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${slot.dayLabel} ${PERIOD_SHORT[slot.period]}, ${
                slot.forecast?.rating ?? "no"
              } movement, wind ${slot.windFromCompass || "unknown"}`}
              onClick={() => {
                setPlaying(false);
                onSelect(slot.key);
              }}
              style={{ ...slotStyle, ...(selected ? slotSelectedStyle : null) }}
            >
              <span style={barWellStyle}>
                <span
                  style={{
                    ...barStyle,
                    height: `${8 + Math.max(0, Math.min(5, slotScore)) * 8}px`,
                    background: selected ? "var(--accent-2)" : "var(--border-strong)",
                  }}
                />
              </span>
              <span>{slot.isNow ? "NOW" : slot.dayLabel.slice(0, 3)}</span>
              <span>{PERIOD_SHORT[slot.period]}</span>
              <span style={slotWindStyle}>{slot.windFromCompass || "—"}</span>
            </button>
          );
        })}
      </div>

      <div style={detailStyle}>
        <div style={detailHeadStyle}>
          <h2 style={ratingStyle}>
            {forecast ? `${forecast.rating} movement` : "Movement"}
          </h2>
          {forecast ? (
            <span
              style={{
                ...readStyle,
                color: score >= 3.5 ? "var(--accent-2-text)" : "var(--text-muted)",
              }}
            >
              {movementDayRead(score)}
            </span>
          ) : null}
        </div>
        <p style={metaStyle}>
          {active.isNow ? "Now" : `${active.dayLabel} ${PERIOD_SHORT[active.period].toLowerCase()}`}
          {" · "}
          {active.windFromCompass ? `${active.windFromCompass} wind` : "wind unknown"}
          {active.windMph !== null ? ` ${Math.round(active.windMph)} mph` : ""}
          {" · "}
          {active.thermal.phase === "uphill" ? "thermals rising" : "thermals falling"}
        </p>
        {factors.length > 0 ? (
          <ul style={factorListStyle}>
            {factors.map((factor) => (
              <li key={factor} style={factorStyle}>
                {factor}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

const monoStyle: CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const toggleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  minHeight: "40px",
  padding: "0 0.8rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "rgba(11, 13, 11, 0.92)",
  color: "#e8e6df",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const toggleIconStyle: CSSProperties = {
  color: "#ff6a1a",
  fontSize: "0.75rem",
};

const sheetStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.6rem 0.75rem 0.75rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius)",
  background: "rgba(11, 13, 11, 0.97)",
  color: "#e8e6df",
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const headActionsStyle: CSSProperties = {
  display: "flex",
  gap: "0.4rem",
};

const labelStyle: CSSProperties = {
  ...monoStyle,
  fontSize: "0.68rem",
  color: "#8f948a",
};

const smallButtonStyle: CSSProperties = {
  minHeight: "36px",
  minWidth: "36px",
  padding: "0 0.6rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "#e8e6df",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "0.95rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const stripStyle: CSSProperties = {
  display: "grid",
  borderTop: "1px solid #23281f",
  borderBottom: "1px solid #23281f",
};

const slotStyle: CSSProperties = {
  ...monoStyle,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2rem",
  minHeight: "44px",
  padding: "0.4rem 0 0.3rem",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: "#8f948a",
  fontSize: "0.6rem",
  letterSpacing: "0.03em",
  cursor: "pointer",
};

const slotSelectedStyle: CSSProperties = {
  color: "#e8e6df",
  background: "#121511",
  boxShadow: "inset 0 -2px 0 #ff6a1a",
};

const barWellStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  height: "48px",
};

const barStyle: CSSProperties = {
  display: "block",
  width: "16px",
};

const slotWindStyle: CSSProperties = {
  color: "#e8e6df",
};

const detailStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
};

const detailHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const ratingStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  lineHeight: 1,
  color: "#e8e6df",
};

const readStyle: CSSProperties = {
  ...monoStyle,
  fontSize: "0.68rem",
};

const metaStyle: CSSProperties = {
  ...monoStyle,
  margin: 0,
  fontSize: "0.66rem",
  color: "#8f948a",
};

const factorListStyle: CSSProperties = {
  display: "grid",
  margin: "0.2rem 0 0",
  padding: 0,
  listStyle: "none",
};

const factorStyle: CSSProperties = {
  padding: "0.35rem 0",
  borderTop: "1px solid #23281f",
  color: "#b8bcb0",
  fontSize: "0.85rem",
  lineHeight: 1.35,
};
