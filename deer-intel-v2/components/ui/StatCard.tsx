import type { CSSProperties, ReactNode } from "react";
import Card from "./Card";

type StatTone = "blaze" | "green" | "neutral";

type StatCardProps = {
  label: string;
  value: number | string;
  detail: string;
  /** Optional line-icon shown in a tinted badge beside the label. */
  icon?: ReactNode;
  /** Accent for the number + icon badge. Defaults to blaze. */
  tone?: StatTone;
};

const TONE: Record<
  StatTone,
  { value: string; badgeBg: string; badgeBorder: string; badgeFg: string }
> = {
  blaze: {
    value: "var(--accent-2)",
    badgeBg: "var(--accent-2-tint)",
    badgeBorder: "var(--accent-2-tint-border)",
    badgeFg: "var(--accent-2-text)",
  },
  green: {
    value: "var(--accent)",
    badgeBg: "var(--accent-tint)",
    badgeBorder: "var(--accent-tint-border)",
    badgeFg: "var(--accent-text)",
  },
  neutral: {
    value: "var(--text)",
    badgeBg: "var(--surface-2)",
    badgeBorder: "var(--border)",
    badgeFg: "var(--text-muted)",
  },
};

export default function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "blaze",
}: StatCardProps) {
  const palette = TONE[tone];

  return (
    <Card>
      <div style={labelRowStyle}>
        {icon ? (
          <span
            style={{
              ...badgeStyle,
              background: palette.badgeBg,
              border: `1px solid ${palette.badgeBorder}`,
              color: palette.badgeFg,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <p style={labelStyle}>{label}</p>
      </div>
      <p style={{ ...valueStyle, color: palette.value }}>{value}</p>
      <p style={detailStyle}>{detail}</p>
    </Card>
  );
}

const labelRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.85rem",
  height: "1.85rem",
  borderRadius: "9px",
  flex: "none",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const valueStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "2.3rem",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
};

const detailStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};
