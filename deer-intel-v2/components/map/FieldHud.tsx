import type { CSSProperties } from "react";
import type { GuideReading } from "@/lib/fieldGuide";

type FieldHudProps = {
  /** "Hunt area edge · 40 yd" / "Outside your hunt area", or null. */
  edgeLabel: string | null;
  edgeOutside: boolean;
  /**
   * Set while "Guide me" runs; reading is null until the first GPS fix.
   * `gpsLost` when the last fix is more than 30 s old.
   */
  guide: { label: string; reading: GuideReading | null; gpsLost?: boolean } | null;
  onStopGuide: () => void;
  /** A short one-off line ("You're at Truck.", "Saved to the Hunt Log…"). */
  message: string;
  onDismissMessage: () => void;
  /** A standing problem (location refused) — stays until dismissed. */
  notice?: string | null;
  onDismissNotice?: () => void;
  /** "Resume blood trail from last night?" after a reload or a night away. */
  resumePrompt?: { text: string; onResume: () => void; onDiscard: () => void } | null;
};

// Heads-up field readouts over the map: the hunt-area edge warning, the
// "Guide me" arrow, and short confirmations. Map controls on imagery stay dark
// and square in every theme.
export default function FieldHud({
  edgeLabel,
  edgeOutside,
  guide,
  onStopGuide,
  message,
  onDismissMessage,
  notice = null,
  onDismissNotice,
  resumePrompt = null,
}: FieldHudProps) {
  if (!edgeLabel && !guide && !message && !notice && !resumePrompt) return null;

  const reading = guide?.reading ?? null;
  const gpsLost = Boolean(guide?.gpsLost);
  // Closer than the fix's accuracy, the bearing is noise: say so instead of
  // spinning the arrow.
  const showArrow =
    reading !== null && reading.arrowRotation !== null && !reading.withinAccuracy && !gpsLost;

  return (
    <div
      className="di-field-hud"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {edgeLabel ? (
        <p
          role="alert"
          className="di-field-hud-edge"
          style={{ ...edgeStyle, ...(edgeOutside ? edgeOutsideStyle : null) }}
        >
          {edgeLabel}
        </p>
      ) : null}

      {guide ? (
        <section className="di-field-hud-guide" style={guideStyle} aria-label={`Guiding to ${guide.label}`}>
          <p style={guideEyebrowStyle}>Guide · {guide.label}</p>
          {reading ? (
            <>
              {showArrow ? (
                <span
                  aria-hidden="true"
                  style={{
                    ...arrowStyle,
                    transform: `rotate(${reading.arrowRotation}deg)`,
                  }}
                >
                  ▲
                </span>
              ) : null}
              <p style={distanceStyle}>{reading.distanceLabel}</p>
              <p style={headStyle} aria-live="polite">
                {gpsLost
                  ? "GPS lost — move to open sky"
                  : reading.withinAccuracy
                    ? "Within GPS accuracy — look around"
                    : reading.headText}
              </p>
            </>
          ) : (
            <p style={headStyle}>{gpsLost ? "GPS lost — move to open sky" : "Waiting for a GPS fix…"}</p>
          )}
          <button type="button" style={stopStyle} onClick={onStopGuide}>
            Stop
          </button>
        </section>
      ) : null}

      {resumePrompt ? (
        <section style={guideStyle} aria-label="Unfinished blood trail">
          <p style={{ ...headStyle, color: "#e8e6df" }}>{resumePrompt.text}</p>
          <div style={promptRowStyle}>
            <button type="button" style={stopStyle} onClick={resumePrompt.onResume}>
              Resume
            </button>
            <button type="button" style={stopStyle} onClick={resumePrompt.onDiscard}>
              Discard
            </button>
          </div>
        </section>
      ) : null}

      {notice ? (
        <button type="button" role="alert" style={messageStyle} onClick={onDismissNotice}>
          {notice}
        </button>
      ) : null}

      {message ? (
        <button type="button" style={messageStyle} onClick={onDismissMessage}>
          {message}
        </button>
      ) : null}
    </div>
  );
}

const monoStyle: CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const panelBase: CSSProperties = {
  margin: 0,
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "rgba(11, 13, 11, 0.94)",
  color: "#e8e6df",
};

const edgeStyle: CSSProperties = {
  ...panelBase,
  ...monoStyle,
  padding: "0.55rem 0.7rem",
  borderColor: "#ff6a1a",
  color: "#ffb27f",
  fontSize: "0.78rem",
  fontWeight: 700,
  lineHeight: 1.25,
};

const edgeOutsideStyle: CSSProperties = {
  background: "rgba(122, 32, 12, 0.95)",
  color: "#fff1e8",
};

const guideStyle: CSSProperties = {
  ...panelBase,
  display: "grid",
  justifyItems: "center",
  gap: "0.2rem",
  padding: "0.55rem 0.6rem 0.6rem",
};

const guideEyebrowStyle: CSSProperties = {
  ...monoStyle,
  margin: 0,
  maxWidth: "100%",
  overflow: "hidden",
  color: "#a9ad9f",
  fontSize: "0.68rem",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const arrowStyle: CSSProperties = {
  display: "block",
  color: "#ff6a1a",
  fontSize: "3.4rem",
  lineHeight: 1,
  // Heading updates arrive ~4 times a second; ease across the gap.
  transition: "transform 240ms linear",
};

const distanceStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.9rem",
  letterSpacing: "0.04em",
  lineHeight: 1,
};

const headStyle: CSSProperties = {
  ...monoStyle,
  margin: 0,
  color: "#d6d3c8",
  fontSize: "0.74rem",
  textAlign: "center",
};

const stopStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  marginTop: "0.25rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255, 255, 255, 0.06)",
  color: "#e8e6df",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const promptRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.4rem",
  width: "100%",
};

const messageStyle: CSSProperties = {
  ...panelBase,
  minHeight: "44px",
  padding: "0.5rem 0.7rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  lineHeight: 1.3,
  textAlign: "left",
  cursor: "pointer",
};
