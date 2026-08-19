"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import DeerProfileCard from "@/components/deer/DeerProfileCard";
import DeerProfileForm from "@/components/deer/DeerProfileForm";
import DashboardSection from "@/components/properties/DashboardSection";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import EmptyState from "@/components/ui/EmptyState";
import type { DeerProfileFormValues } from "@/lib/deerProfileFormValues";
import { getDeerConditionInsights } from "@/lib/deerConditionInsights";
import { getDeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import type { DeerProfileSummary } from "@/lib/deerProfiles";
import { getDeerTravelIntelligence } from "@/lib/deerTravelIntelligence";
import { photoLinksProfile } from "@/lib/photos";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
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
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    () => summaries[0]?.profile.id ?? "",
  );

  // Keep a valid buck selected as profiles are added or removed: fall back to
  // the first buck whenever the current pick disappears.
  useEffect(() => {
    if (summaries.length === 0) {
      if (selectedProfileId !== "") setSelectedProfileId("");
      return;
    }

    const stillExists = summaries.some(
      (summary) => summary.profile.id === selectedProfileId,
    );

    if (!stillExists) {
      setSelectedProfileId(summaries[0].profile.id);
    }
  }, [summaries, selectedProfileId]);

  const deerProfiles = useMemo<DeerProfile[]>(
    () => summaries.map((summary) => summary.profile),
    [summaries],
  );

  const selectedSummary =
    summaries.find((summary) => summary.profile.id === selectedProfileId) ??
    summaries[0];

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
        <CollapsibleSection
          title="Add a deer"
          description="Track a buck or deer across photos and camera sites"
        >
          <DeerProfileForm
            values={profileValues}
            onChange={onProfileValuesChange}
            onSubmit={onAddProfile}
          />
        </CollapsibleSection>
      </Card>

      {summaries.length === 0 ? (
        <EmptyState description="No deer profiles yet. Add a buck or deer you want to track across photo records and camera sites." />
      ) : (
        <div style={pickerWrapStyle}>
          <p style={pickerLabelStyle}>Select a buck</p>
          <div style={pickerRowStyle}>
            {summaries.map((summary) => {
              const isSelected =
                summary.profile.id === selectedSummary?.profile.id;

              return (
                <button
                  key={summary.profile.id}
                  type="button"
                  onClick={() => setSelectedProfileId(summary.profile.id)}
                  aria-pressed={isSelected}
                  style={{
                    ...buckChipStyle,
                    ...(isSelected ? buckChipSelectedStyle : null),
                  }}
                >
                  <span style={buckChipNameStyle}>
                    {summary.profile.nickname}
                  </span>
                  <span
                    style={{
                      ...buckChipMetaStyle,
                      ...(isSelected ? buckChipMetaSelectedStyle : null),
                    }}
                  >
                    {summary.photoCount}{" "}
                    {summary.photoCount === 1 ? "photo" : "photos"}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSummary ? (
            <SelectedBuck
              key={selectedSummary.profile.id}
              summary={selectedSummary}
              propertyName={propertyName}
              cameras={cameras}
              photoRecords={photoRecords}
              cameraChecks={cameraChecks}
              hunts={hunts}
              pins={pins}
              deerProfiles={deerProfiles}
            />
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}

function SelectedBuck({
  summary,
  propertyName,
  cameras,
  photoRecords,
  cameraChecks,
  hunts,
  pins,
  deerProfiles,
}: {
  summary: DeerProfileSummary;
  propertyName: string;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  deerProfiles: DeerProfile[];
}) {
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
  const conditions = getDeerConditionInsights({
    profile: summary.profile,
    photoRecords,
  });
  const buckPhotos = photoRecords.filter((photo) =>
    photoLinksProfile(photo, summary.profile.id),
  );

  return (
    <DeerProfileCard
      summary={summary}
      intelligence={intelligence}
      travel={travel}
      conditions={conditions}
      photos={buckPhotos}
      deerProfiles={deerProfiles}
    />
  );
}

const pickerWrapStyle: CSSProperties = {
  marginTop: "1rem",
};

const pickerLabelStyle: CSSProperties = {
  margin: "0 0 0.6rem",
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const pickerRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginBottom: "1rem",
};

const buckChipStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  minHeight: "46px",
  padding: "0.5rem 0.85rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  textAlign: "left",
  cursor: "pointer",
};

const buckChipSelectedStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent)",
  color: "white",
  boxShadow: "var(--shadow-sm)",
};

const buckChipNameStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 850,
  lineHeight: 1.2,
};

const buckChipMetaStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "var(--text-faint)",
};

const buckChipMetaSelectedStyle: CSSProperties = {
  color: "rgba(255, 255, 255, 0.85)",
};

const countBadgeStyle: CSSProperties = {
  fontSize: "0.78rem",
};
