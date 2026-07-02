import type { CSSProperties } from "react";
import type { PropertyIntelligenceCard } from "@/lib/propertyIntelligence";
import InfoCard from "./InfoCard";

type PropertyIntelligenceSummaryProps = {
  cards: PropertyIntelligenceCard[];
};

export default function PropertyIntelligenceSummary({
  cards,
}: PropertyIntelligenceSummaryProps) {
  return (
    <div style={gridStyle}>
      {cards.map((card) => (
        <InfoCard
          key={card.title}
          title={card.title}
          value={card.value}
          description={card.description}
        />
      ))}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};
