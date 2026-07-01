import type { CSSProperties } from "react";
import DeerProfileCard from "@/components/deer/DeerProfileCard";
import DeerProfileForm from "@/components/deer/DeerProfileForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";
import type { DeerProfileSummary } from "@/lib/deerProfiles";

type DeerProfilesSectionProps = {
  profileValues: DeerProfileFormValues;
  summaries: DeerProfileSummary[];
  onProfileValuesChange: (values: DeerProfileFormValues) => void;
  onAddProfile: () => void;
};

export default function DeerProfilesSection({
  profileValues,
  summaries,
  onProfileValuesChange,
  onAddProfile,
}: DeerProfilesSectionProps) {
  return (
    <DashboardSection
      id="deer-profiles"
      eyebrow="Property Tool"
      title="Deer Profiles"
      action={
        <Badge variant="success" style={countBadgeStyle}>
          {summaries.length} {summaries.length === 1 ? "profile" : "profiles"}
        </Badge>
      }
    >
      <Card as="div" variant="subtle">
        <h3 style={subsectionTitleStyle}>Add Deer Profile</h3>
        <DeerProfileForm
          values={profileValues}
          onChange={onProfileValuesChange}
          onSubmit={onAddProfile}
        />
      </Card>

      {summaries.length === 0 ? (
        <EmptyState description="No deer profiles yet. Add a buck or deer you want to track across photo records and camera sites." />
      ) : (
        <div style={profileGridStyle}>
          {summaries.map((summary) => (
            <DeerProfileCard key={summary.profile.id} summary={summary} />
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

const profileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "1rem",
  marginTop: "1rem",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
