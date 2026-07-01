import type { CSSProperties } from "react";
import StandCard from "@/components/stands/StandCard";
import StandForm from "@/components/stands/StandForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
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
        <h3 style={subsectionTitleStyle}>Add Stand</h3>
        <StandForm
          values={standValues}
          onChange={onStandValuesChange}
          onSubmit={onAddStand}
        />
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

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.05rem",
  lineHeight: 1.25,
};

const standListStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1rem",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
