import type { CSSProperties } from "react";
import StandCard from "@/components/stands/StandCard";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { Stand } from "@/types/stand";

// Read-only on the property page: stands are added from the Stands page (or by
// converting a stand pin), so the command center informs rather than edits.
type StandSitesSectionProps = {
  stands: Stand[];
};

export default function StandSitesSection({ stands }: StandSitesSectionProps) {
  return (
    <DashboardSection
      id="stand-sites"
      eyebrow="Property Tool"
      title="Stands"
      action={
        <Badge variant="success" style={countBadgeStyle}>
          {stands.length} {stands.length === 1 ? "stand" : "stands"}
        </Badge>
      }
    >
      {stands.length === 0 ? (
        <EmptyState description="No stands on this property yet. Add them from the Stands page." />
      ) : (
        <div style={standListStyle}>
          {stands.map((stand) => (
            <StandCard key={stand.id} stand={stand} />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

const standListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
