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
  display: "block",
  padding: "1.15rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "white",
  textDecoration: "none",
};

const sizeStyles: Record<NonNullable<ActionCardProps["size"]>, CSSProperties> = {
  default: {
    minHeight: "160px",
  },
  large: {
    minHeight: "184px",
    padding: "1.25rem",
  },
};

const toneStyles: Record<NonNullable<ActionCardProps["tone"]>, CSSProperties> = {
  default: {},
  primary: {
    border: "1px solid #3b6843",
    background: "#102112",
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
  border: "1px solid #315135",
  borderRadius: "8px",
  background: "#132414",
  color: "#a7d1a6",
};

const titleStyle: CSSProperties = {
  margin: "0.9rem 0 0",
  fontSize: "1.22rem",
  lineHeight: 1.25,
};

const firstTitleStyle: CSSProperties = {
  ...titleStyle,
  margin: 0,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  fontSize: "0.98rem",
  lineHeight: 1.55,
};
