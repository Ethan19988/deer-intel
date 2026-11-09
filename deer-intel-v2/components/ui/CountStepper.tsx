"use client";

import { useId, type CSSProperties } from "react";

type CountStepperProps = {
  label: string;
  /** The count as form text; blank reads as 0. */
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  /** "lg" for the field quick-check (bigger numbers); "md" inside dense forms. */
  size?: "md" | "lg";
};

function toCount(value: string) {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

// A whole-number count with big − / + buttons, for tallying deer one-handed on
// a phone. The middle stays a real number input so a big count can be typed.
export default function CountStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  size = "md",
}: CountStepperProps) {
  const inputId = useId();
  const count = toCount(value);
  const buttonSize = size === "lg" ? "52px" : "44px";

  function step(delta: number) {
    const next = Math.min(max, Math.max(min, count + delta));
    // 0 is stored as blank, matching an untouched count field.
    onChange(next === 0 ? "" : String(next));
  }

  return (
    <div style={wrapStyle}>
      <label htmlFor={inputId} style={labelStyle}>
        {label}
      </label>
      <div style={rowStyle}>
        <button
          type="button"
          aria-label={`Remove one from ${label}`}
          aria-controls={inputId}
          disabled={count <= min}
          onClick={() => step(-1)}
          style={{
            ...buttonStyle,
            width: buttonSize,
            height: buttonSize,
            ...(count <= min ? disabledStyle : null),
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          style={{
            ...inputStyle,
            height: buttonSize,
            fontSize: size === "lg" ? "1.6rem" : "1.25rem",
          }}
        />
        <button
          type="button"
          aria-label={`Add one to ${label}`}
          aria-controls={inputId}
          disabled={count >= max}
          onClick={() => step(1)}
          style={{
            ...buttonStyle,
            width: buttonSize,
            height: buttonSize,
            ...(count >= max ? disabledStyle : null),
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: "0.35rem",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  padding: 0,
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1.6rem",
  lineHeight: 1,
  cursor: "pointer",
  userSelect: "none",
};

const disabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const inputStyle: CSSProperties = {
  flex: "1 1 auto",
  width: "100%",
  minWidth: "2.5rem",
  padding: "0 0.25rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  textAlign: "center",
  MozAppearance: "textfield",
};
