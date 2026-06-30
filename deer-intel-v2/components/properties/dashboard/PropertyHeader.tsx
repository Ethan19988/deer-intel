import type { CSSProperties } from "react";
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
    <header id="overview" style={heroStyle}>
      <div style={heroTextStyle}>
        <p style={eyebrowStyle}>Property Intelligence Dashboard</p>
        <h1 style={pageTitleStyle}>{property.name}</h1>
        <div style={propertyFactsStyle}>
          <span>{property.county}</span>
          <span>{property.acres} acres</span>
        </div>
        <p style={mutedTextStyle}>{property.notes}</p>
      </div>

      <div style={scoreGridStyle}>
        <ScoreCard
          title="Knowledge Score"
          value={`${knowledgeScore}%`}
          description="Measures how much useful property data has been captured."
        />
        <ScoreCard
          title="AI Confidence"
          value={aiConfidence.label}
          description={aiConfidence.description}
        />
      </div>
    </header>
  );
}

const heroStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: "1rem",
  marginTop: "1rem",
  padding: "1.5rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
};

const heroTextStyle: CSSProperties = {
  flex: "1 1 420px",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const pageTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "2.35rem",
  lineHeight: 1.1,
};

const propertyFactsStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.85rem",
  color: "#c6d5c5",
  fontWeight: 700,
};

const mutedTextStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0.85rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.6,
};

const scoreGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  flex: "1 1 280px",
};
