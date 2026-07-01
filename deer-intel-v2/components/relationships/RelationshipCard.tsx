import Link from "next/link";
import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import type { RelationshipCardData } from "@/lib/relationships";

type RelationshipCardProps = {
  relationship: RelationshipCardData;
};

export default function RelationshipCard({
  relationship,
}: RelationshipCardProps) {
  const content = (
    <>
      <div style={headerStyle}>
        <p style={titleStyle}>{relationship.title}</p>
        <Badge>{relationship.badge}</Badge>
      </div>
      <p style={descriptionStyle}>{relationship.description}</p>
    </>
  );

  if (relationship.href) {
    return (
      <Link href={relationship.href} style={cardStyle}>
        {content}
      </Link>
    );
  }

  return <div style={cardStyle}>{content}</div>;
}

const cardStyle: CSSProperties = {
  display: "block",
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "white",
  textDecoration: "none",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "#b8c2b6",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};
