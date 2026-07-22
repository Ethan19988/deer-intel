import type { CSSProperties } from "react";

// A circular gauge for a small integer rating (e.g. the 1–5 movement score).
// The arc fills value/max of the ring and takes the caller's accent colour, so
// it always agrees with the tone the rest of the panel uses. Purely presentational.

type ScoreGaugeProps = {
  value: number;
  max: number;
  /** CSS colour (usually a token like var(--accent)) for the filled arc. */
  color: string;
  /** Small caption under the number, e.g. "Movement". */
  caption?: string;
  ariaLabel?: string;
  size?: number;
};

const R = 46;
const CENTER = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function ScoreGauge({
  value,
  max,
  color,
  caption,
  ariaLabel,
  size = 108,
}: ScoreGaugeProps) {
  const fraction = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div
      style={{ ...wrapStyle, width: size, height: size }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 108 108" width={size} height={size} aria-hidden="true">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={9}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </svg>
      <div style={labelWrapStyle}>
        <span style={{ ...valueStyle, color }}>{value}</span>
        <span style={outOfStyle}>/{max}</span>
        {caption ? <span style={captionStyle}>{caption}</span> : null}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "relative",
  flexShrink: 0,
};

const labelWrapStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  textAlign: "center",
  lineHeight: 1,
};

const valueStyle: CSSProperties = {
  fontSize: "2.1rem",
  fontWeight: 900,
  lineHeight: 0.9,
  fontVariantNumeric: "tabular-nums",
};

const outOfStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "0.85rem",
  fontWeight: 800,
  marginTop: "0.1rem",
};

const captionStyle: CSSProperties = {
  marginTop: "0.25rem",
  color: "var(--text-muted)",
  fontSize: "0.6rem",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};
