import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type DashboardCardLinkProps = {
  href: string;
  title: string;
  description: string;
  badge?: string;
  icon?: ReactNode;
};

export default function DashboardCardLink({
  href,
  title,
  description,
  badge,
  icon,
}: DashboardCardLinkProps) {
  return (
    <Link href={href} style={cardStyle}>
      <div style={headerStyle}>
        {icon ? <span style={iconWrapStyle}>{icon}</span> : null}
        {badge ? <span style={badgeStyle}>{badge}</span> : null}
      </div>
      <h3 style={titleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
    </Link>
  );
}

const cardStyle: CSSProperties = {
  display: "block",
  minHeight: "150px",
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "white",
  textDecoration: "none",
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

const badgeStyle: CSSProperties = {
  padding: "0.3rem 0.55rem",
  border: "1px solid #2d402d",
  borderRadius: "8px",
  background: "#101a10",
  color: "#c6d5c5",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const titleStyle: CSSProperties = {
  margin: "0.9rem 0 0",
  fontSize: "1.1rem",
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  margin: "0.55rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};
