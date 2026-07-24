import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import type { AiConfidence } from "@/lib/propertyDashboard";
import type { Property } from "@/types/property";
import ScoreCard from "./ScoreCard";

type PropertyHeaderProps = {
  property: Property;
  knowledgeScore: number;
  aiConfidence: AiConfidence;
};

export default function PropertyHeader({
  property,
  knowledgeScore,
  aiConfidence,
}: PropertyHeaderProps) {
  return (
    <section id="overview" className="di-section-hero" style={heroStyle}>
      <div style={headerTextStyle}>
        <div style={badgeRowStyle}>
          <Badge variant="success">Property Home</Badge>
          <Badge>{property.county}</Badge>
          <Badge>{property.acres} acres</Badge>
        </div>
        <h1 style={titleStyle}>{property.name}</h1>
        <p style={notesStyle}>{property.notes}</p>
      </div>

      <div style={scoreGridStyle}>
        <ScoreCard
          title="Property Knowledge"
          value={`${knowledgeScore}%`}
          description="How much useful field information has been saved."
        />
        <ScoreCard
          title="Scout Confidence"
          value={aiConfidence.label}
          description={aiConfidence.description}
        />
      </div>
    </section>
  );
}

// Layout only — the golden-hour band (bg, border, padding, cream text) comes
// from the shared .di-section-hero class.
const heroStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: "1.25rem",
  marginTop: "1rem",
};

const headerTextStyle: CSSProperties = {
  flex: "1 1 440px",
  minWidth: 0,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const titleStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "#f6f0dc",
  fontSize: "3rem",
  lineHeight: 1,
  fontWeight: 850,
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.5)",
};

const notesStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "1rem 0 0",
  color: "rgba(243, 237, 217, 0.9)",
  fontSize: "1.08rem",
  lineHeight: 1.65,
};

const scoreGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "1rem",
  flex: "1 1 360px",
};
