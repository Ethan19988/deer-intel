import type { CSSProperties, ReactNode } from "react";
import Badge from "@/components/ui/Badge";

type AssetHeaderProps = {
  assetType: string;
  name: string;
  propertyName: string;
  description: string;
  status?: string;
  children?: ReactNode;
  /** Optional line-icon shown in a tinted badge beside the name. */
  icon?: ReactNode;
};

export default function AssetHeader({
  assetType,
  name,
  propertyName,
  description,
  status,
  children,
  icon,
}: AssetHeaderProps) {
  return (
    <section
      id="asset-overview"
      className="di-section-hero"
      style={cardStyle}
    >
      <div style={badgeRowStyle}>
        <Badge variant="success">{assetType}</Badge>
        <Badge>{propertyName}</Badge>
        {status ? <Badge>{status}</Badge> : null}
      </div>

      <div style={titleRowStyle}>
        {icon ? (
          <span style={iconBadgeStyle} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h1 style={titleStyle}>{name}</h1>
      </div>
      <p style={descriptionStyle}>{description}</p>

      {children ? <div style={detailsStyle}>{children}</div> : null}
    </section>
  );
}

// Layout/spacing only — the golden-hour band comes from .di-section-hero.
const cardStyle: CSSProperties = {
  marginTop: "1rem",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  marginTop: "1rem",
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3.25rem",
  height: "3.25rem",
  flex: "none",
  borderRadius: "16px",
  background: "rgba(243, 237, 217, 0.15)",
  border: "1px solid rgba(243, 237, 217, 0.35)",
  color: "#f6efd6",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f6f0dc",
  fontSize: "2.5rem",
  lineHeight: 1.05,
  fontWeight: 850,
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.5)",
};

const descriptionStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "0.9rem 0 0",
  color: "rgba(243, 237, 217, 0.9)",
  fontSize: "1.05rem",
  lineHeight: 1.6,
};

// The facts (AssetFact) are shared with body panels and use dark tokens, so the
// details sit in a solid light panel on the band rather than directly on it.
const detailsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "1rem",
  marginTop: "1.25rem",
  padding: "1rem 1.15rem",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
};
