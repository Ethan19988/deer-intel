import type { CSSProperties } from "react";
import StandCard from "@/components/stands/StandCard";
import StandForm from "@/components/stands/StandForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import EmptyState from "@/components/ui/EmptyState";
import type { StandFormValues } from "@/lib/standFormValues";
import type { Stand } from "@/types/stand";

type StandSitesSectionProps = {
  stands: Stand[];
  standValues: StandFormValues;
  onStandValuesChange: (values: StandFormValues) => void;
  onAddStand: () => void;
};

export default function StandSitesSection({
  stands,
  standValues,
  onStandValuesChange,
  onAddStand,
}: StandSitesSectionProps) {
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
      <Card as="div" variant="subtle">
        <CollapsibleSection
          title="Add a stand"
          description="Save a stand site with wind, access, and exit notes"
        >
          <StandForm
            values={standValues}
            onChange={onStandValuesChange}
            onSubmit={onAddStand}
          />
        </CollapsibleSection>
      </Card>

      {stands.length === 0 ? (
        <EmptyState description="No stands added for this property yet. Add a stand above to save wind, access, exit, and hunt notes." />
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
  marginTop: "1rem",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
