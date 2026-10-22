"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import DeerProfileCard from "@/components/deer/DeerProfileCard";
import Link from "next/link";
import PhotoImage from "@/components/photos/PhotoImage";
import EmptyState from "@/components/ui/EmptyState";
import { DeerIcon } from "@/components/ui/FieldIcons";
import { buildHitListSlides } from "@/lib/hitListSlides";
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
  summaries: DeerProfileSummary[];
  propertyName: string;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  /** Buck to select first, e.g. from a Today hit-list link. */
  initialProfileId?: string;
};

export default function DeerProfilesSection({
  summaries,
  propertyName,
  cameras,
  photoRecords,
  cameraChecks,
  hunts,
  pins,
  initialProfileId,
}: DeerProfilesSectionProps) {
  // The hit list opens collapsed; a link that names a buck (?buck=) opens his.
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() =>
    initialProfileId &&
    summaries.some((summary) => summary.profile.id === initialProfileId)
      ? initialProfileId
      : "",
  );

  // A buck that's been deleted can't stay open.
  useEffect(() => {
    if (
      selectedProfileId &&
      !summaries.some((summary) => summary.profile.id === selectedProfileId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProfileId("");
    }
  }, [summaries, selectedProfileId]);

  // Scroll a linked buck into view once.
  useEffect(() => {
    if (!initialProfileId) return;
    requestAnimationFrame(() =>
      document
        .getElementById(`buck-${initialProfileId}`)
        ?.scrollIntoView({ block: "start" }),
    );
  }, [initialProfileId]);

  const deerProfiles = useMemo<DeerProfile[]>(
    () => summaries.map((summary) => summary.profile),
    [summaries],
  );

  // Photo, last-seen and usual-time lines, shared with Today's hit list.
  const cards = useMemo(() => {
    const propertyId = summaries[0]?.profile.propertyId ?? "";
    const slides = buildHitListSlides({
      propertyId,
      propertyName,
      profiles: deerProfiles,
      photos: photoRecords,
      cameras,
      cameraChecks,
      hunts,
      pins,
    });
    return new Map(slides.map((slide) => [slide.key, slide]));
  }, [summaries, propertyName, deerProfiles, photoRecords, cameras, cameraChecks, hunts, pins]);

  if (summaries.length === 0) {
    return (
      <EmptyState
        illustration={<DeerIcon size={28} />}
        title="No bucks on your hit list"
        description="Tag a buck on a trail-cam photo and he shows up here, with when and where he moves."
        action={
          <Link href="/cameras" className="di-link-btn di-link-btn--primary">
            Go to cameras
          </Link>
        }
      />
    );
  }

  return (
    <section id="deer-profiles" aria-label="Hit list">
      <ul style={listStyle}>
        {summaries.map((summary) => {
          const id = summary.profile.id;
          const card = cards.get(id);
          const open = id === selectedProfileId;
          const meta = [
            card?.lastSeen
              ? `Last seen ${card.lastSeen}`
              : summary.lastSeen
                ? `Last seen ${shortDay(summary.lastSeen)}`
                : "Not seen yet",
            `${summary.photoCount} ${summary.photoCount === 1 ? "photo" : "photos"}`,
          ].join(" · ");

          return (
            <li key={id} id={`buck-${id}`} style={itemStyle}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setSelectedProfileId(open ? "" : id)}
                style={{ ...cardStyle, ...(open ? cardOpenStyle : null) }}
              >
                {card?.imageId ? (
                  <PhotoImage
                    imageId={card.imageId}
                    alt={`${summary.profile.nickname} on camera`}
                    aspectRatio={16 / 9}
                    style={photoStyle}
                  />
                ) : (
                  <span style={noPhotoStyle} aria-hidden="true">
                    <DeerIcon size={34} />
                  </span>
                )}
                <span style={captionStyle}>
                  <span style={captionTextStyle}>
                    <span style={nameStyle}>
                      {summary.profile.nickname || "Unnamed buck"}
                    </span>
                    <span style={metaStyle}>{meta}</span>
                  </span>
                  {card?.usualTime ? (
                    <span style={timeTagStyle}>{card.usualTime}</span>
                  ) : null}
                </span>
              </button>
              {open ? (
                <div style={detailStyle}>
                  <SelectedBuck
                    summary={summary}
                    propertyName={propertyName}
                    cameras={cameras}
                    photoRecords={photoRecords}
                    cameraChecks={cameraChecks}
                    hunts={hunts}
                    pins={pins}
                    deerProfiles={deerProfiles}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
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

// "2026-09-29" → "Sep 29"; anything unparseable is shown as given.
function shortDay(value: string): string {
  const time = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(time)
    ? value
    : new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const itemStyle: CSSProperties = {
  display: "grid",
  scrollMarginTop: "4.5rem",
};

const cardStyle: CSSProperties = {
  display: "grid",
  width: "100%",
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  background: "var(--surface)",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

const cardOpenStyle: CSSProperties = {
  borderColor: "var(--accent-2)",
};

const photoStyle: CSSProperties = {
  border: 0,
  borderRadius: 0,
  background: "var(--surface-2)",
};

const noPhotoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  aspectRatio: "16 / 5",
  background: "var(--surface-2)",
  color: "var(--text-muted)",
};

const captionStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.7rem 0.9rem 0.8rem",
};

const captionTextStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "2rem",
  letterSpacing: "0.03em",
  lineHeight: 0.95,
  textTransform: "uppercase",
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.7rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const timeTagStyle: CSSProperties = {
  flex: "none",
  padding: "0.35rem 0.55rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const detailStyle: CSSProperties = {
  paddingTop: "0.75rem",
};
