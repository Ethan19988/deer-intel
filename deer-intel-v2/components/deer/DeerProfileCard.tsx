import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { DeerProfileSummary } from "@/lib/deerProfiles";

type DeerProfileCardProps = {
  summary: DeerProfileSummary;
};

export default function DeerProfileCard({ summary }: DeerProfileCardProps) {
  return (
    <Card as="article" variant="subtle" style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Deer Profile</p>
          <h3 style={titleStyle}>{summary.profile.nickname}</h3>
        </div>
        <Badge>{summary.profile.estimatedAge || "Age unknown"}</Badge>
      </div>

      <div style={detailsGridStyle}>
        <ProfileDetail label="First Seen" value={summary.firstSeen} />
        <ProfileDetail label="Last Seen" value={summary.lastSeen} />
        <ProfileDetail label="Photos" value={String(summary.photoCount)} />
        <ProfileDetail label="Sightings" value={String(summary.sightingCount)} />
      </div>

      {summary.profile.notes ? (
        <div style={notesStyle}>
          <ProfileDetail label="Notes" value={summary.profile.notes} />
        </div>
      ) : null}
    </Card>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
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

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
  paddingTop: "1rem",
  borderTop: "1px solid #1e2a1e",
};

const notesStyle: CSSProperties = {
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
