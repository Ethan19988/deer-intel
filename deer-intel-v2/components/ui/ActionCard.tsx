import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import Badge from "./Badge";

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
  badge?: string;
  icon?: ReactNode;
  size?: "default" | "large";
  tone?: "default" | "primary";
};

export default function ActionCard({
  href,
  title,
  description,
  badge,
  icon,
  size = "default",
  tone = "default",
}: ActionCardProps) {
  const hasHeader = icon || badge;

  return (
    <Link
      href={href}
      className="di-action-card"
      style={{
        ...cardStyle,
        ...sizeStyles[size],
        ...toneStyles[tone],
      }}
    >
      {hasHeader ? (
        <div style={headerStyle}>
          {icon ? <span style={iconWrapStyle}>{icon}</span> : null}
          {badge ? (
            <Badge variant={badge === "Available" ? "success" : "default"}>
              {badge}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <h3 style={hasHeader ? titleStyle : firstTitleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
    </Link>
  );
}

const cardStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  padding: "1.15rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "var(--shadow-sm)",
  textDecoration: "none",
};

const sizeStyles: Record<NonNullable<ActionCardProps["size"]>, CSSProperties> = {
  default: {
    minHeight: "148px",
  },
  large: {
    minHeight: "166px",
    padding: "1.25rem",
  },
};

const toneStyles: Record<NonNullable<ActionCardProps["tone"]>, CSSProperties> = {
  default: {},
  primary: {
    border: "1px solid var(--accent-2-tint-border)",
    background: "var(--accent-2-tint)",
    boxShadow: "inset 0 3px 0 var(--accent-2), var(--shadow-sm)",
  },
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const iconWrapStyle: CSSProperties = {
  display: "inline-flex",
  width: "2.35rem",
  height: "2.35rem",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--accent-tint-border)",
  borderRadius: "8px",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const titleStyle: CSSProperties = {
  margin: "0.9rem 0 0",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const firstTitleStyle: CSSProperties = {
  ...titleStyle,
  margin: 0,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};
