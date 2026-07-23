import type { CSSProperties, ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

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
    <Card as="section" id="asset-overview" variant="elevated" style={cardStyle}>
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
    </Card>
  );
}

const cardStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "1.5rem",
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
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: "2.5rem",
  lineHeight: 1.05,
  fontWeight: 850,
};

const descriptionStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "0.9rem 0 0",
  color: "var(--text-muted)",
  fontSize: "1.05rem",
  lineHeight: 1.6,
};

const detailsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "1rem",
  marginTop: "1.25rem",
  paddingTop: "1.25rem",
  borderTop: "1px solid var(--border)",
};
