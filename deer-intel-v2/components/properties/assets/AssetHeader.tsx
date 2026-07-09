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
};

export default function AssetHeader({
  assetType,
  name,
  propertyName,
  description,
  status,
  children,
}: AssetHeaderProps) {
  return (
    <Card as="section" id="asset-overview" variant="elevated" style={cardStyle}>
      <div style={badgeRowStyle}>
        <Badge variant="success">{assetType}</Badge>
        <Badge>{propertyName}</Badge>
        {status ? <Badge>{status}</Badge> : null}
      </div>

      <h1 style={titleStyle}>{name}</h1>
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

const titleStyle: CSSProperties = {
  margin: "1rem 0 0",
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
