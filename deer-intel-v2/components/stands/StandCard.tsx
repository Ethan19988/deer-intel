import Link from "next/link";
import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { Stand } from "@/types/stand";

type StandCardProps = {
  stand: Stand;
};

export default function StandCard({ stand }: StandCardProps) {
  return (
    <Card style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>{stand.standType} Stand</p>
          <h3 style={titleStyle}>{stand.name}</h3>
        </div>
        <div style={actionsStyle}>
          <Badge>{stand.standType}</Badge>
          <Link
            href={`/properties/${stand.propertyId}/assets/${stand.id}`}
            style={openLinkStyle}
          >
            Open Stand
          </Link>
        </div>
      </div>

      <div style={detailsGridStyle}>
        <StandDetail label="Best Winds" value={stand.bestWinds} />
        <StandDetail label="Avoid Winds" value={stand.avoidWinds} />
      </div>

      <div style={notesGridStyle}>
        <StandDetail label="Access Route" value={stand.accessRouteNotes} />
        <StandDetail label="Exit Route" value={stand.exitRouteNotes} />
        <StandDetail label="Notes" value={stand.notes} />
      </div>
    </Card>
  );
}

function StandDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value || "Not set"}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "#0a0f0a",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const openLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const notesGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "#879486",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#c7d0c5",
  lineHeight: 1.5,
};
