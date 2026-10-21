import type { CSSProperties } from "react";
import type { AiConfidence } from "@/lib/propertyDashboard";
import type { Property } from "@/types/property";

type PropertyHeaderProps = {
  property: Property;
  knowledgeScore: number;
  aiConfidence: AiConfidence;
};

// Compact property hero: where it is, its name, your notes, and one data line
// for how well the app knows the ground. Tonight's call sits right under it.
export default function PropertyHeader({
  property,
  knowledgeScore,
  aiConfidence,
}: PropertyHeaderProps) {
  const location = [property.county, property.acres ? `${property.acres} acres` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="overview" className="di-section-hero" style={heroStyle}>
      {location ? <p style={eyebrowStyle}>{location}</p> : null}
      <h1 style={titleStyle}>{property.name}</h1>
      {property.notes ? <p style={notesStyle}>{property.notes}</p> : null}
      <p style={dataLineStyle} title={aiConfidence.description}>
        <span>
          Knowledge <strong style={dataValueStyle}>{knowledgeScore}%</strong>
        </span>
        <span>
          Scout confidence <strong style={dataValueStyle}>{aiConfidence.label}</strong>
        </span>
      </p>
    </section>
  );
}

// Layout only — the band (bg, border, padding, cream text) comes from the
// shared .di-section-hero class.
const heroStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  marginTop: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "rgba(243, 237, 217, 0.75)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f6f0dc",
  fontSize: "3.4rem",
  lineHeight: 0.95,
  fontWeight: 400,
};

const notesStyle: CSSProperties = {
  maxWidth: "760px",
  margin: 0,
  color: "rgba(243, 237, 217, 0.88)",
  fontSize: "1rem",
  lineHeight: 1.55,
};

const dataLineStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "1.25rem",
  margin: "0.35rem 0 0",
  paddingTop: "0.6rem",
  borderTop: "1px solid rgba(243, 237, 217, 0.18)",
  color: "rgba(243, 237, 217, 0.75)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const dataValueStyle: CSSProperties = {
  color: "#f6f0dc",
  fontWeight: 500,
};
