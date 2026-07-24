import type { CSSProperties } from "react";
import DeerProfileCard from "@/components/deer/DeerProfileCard";
import DeerProfileForm from "@/components/deer/DeerProfileForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";
import { getDeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import type { DeerProfileSummary } from "@/lib/deerProfiles";
import { getDeerTravelIntelligence } from "@/lib/deerTravelIntelligence";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";

type DeerProfilesSectionProps = {
  profileValues: DeerProfileFormValues;
  summaries: DeerProfileSummary[];
  propertyName: string;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  onProfileValuesChange: (values: DeerProfileFormValues) => void;
  onAddProfile: () => void;
};

export default function DeerProfilesSection({
  profileValues,
  summaries,
  propertyName,
  cameras,
  photoRecords,
  cameraChecks,
  hunts,
  pins,
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
          {summaries.map((summary) => {
            const intelligence = getDeerProfileIntelligence({
              profile: summary.profile,
              propertyName,
              cameras,
              photoRecords,
              cameraChecks,
              hunts,
              pins,
            });
            const travel = getDeerTravelIntelligence({
              profile: summary.profile,
              cameras,
              photoRecords,
            });

            return (
              <DeerProfileCard
                key={summary.profile.id}
                summary={summary}
                intelligence={intelligence}
                travel={travel}
              />
            );
          })}
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
  gap: "1rem",
  marginTop: "1rem",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
