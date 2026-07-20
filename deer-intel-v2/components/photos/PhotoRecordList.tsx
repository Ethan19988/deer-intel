"use client";

import { useState, type CSSProperties } from "react";
import PhotoImage from "@/components/photos/PhotoImage";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatPhotoDate, sortPhotoRecordsChronologically } from "@/lib/photos";
import {
  hasWeatherSnapshot,
  weatherSnapshotDescription,
  weatherSourceLabel,
} from "@/lib/weather";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

type MoveTarget = {
  id: string;
  name: string;
};

type PhotoRecordListProps = {
  photoRecords: PhotoRecord[];
  deerProfiles?: DeerProfile[];
  emptyDescription?: string;
  // When provided, each photo gets a checkbox and a bar appears with
  // "Move to camera" / "Delete" actions for the selected photos.
  moveTargets?: MoveTarget[];
  onMovePhotos?: (photoIds: string[], targetCameraId: string) => void;
  onDeletePhotos?: (photoIds: string[]) => void;
  // When provided, buck photos get a "link to buck" control and a one-tap
  // "New buck from this photo" that records a profile from the AI's read.
  onCreateBuckFromPhoto?: (photo: PhotoRecord) => void;
  onLinkPhotoToBuck?: (photoId: string, profileId: string) => void;
};

export default function PhotoRecordList({
  photoRecords,
  deerProfiles = [],
  emptyDescription = "No photo records yet.",
  moveTargets = [],
  onMovePhotos,
  onDeletePhotos,
  onCreateBuckFromPhoto,
  onLinkPhotoToBuck,
}: PhotoRecordListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveTargetId, setMoveTargetId] = useState("");
  const chronologicalPhotos = sortPhotoRecordsChronologically(photoRecords);
  const manageable = Boolean(onMovePhotos || onDeletePhotos);
  const canMove = Boolean(onMovePhotos) && moveTargets.length > 0;
  // Drop selections that no longer exist (after a move/delete re-render).
  const activeSelectedIds = selectedIds.filter((id) =>
    chronologicalPhotos.some((photo) => photo.id === id),
  );
  const resolvedMoveTargetId =
    moveTargetId && moveTargets.some((target) => target.id === moveTargetId)
      ? moveTargetId
      : moveTargets[0]?.id ?? "";

  function toggleSelected(photoId: string, checked: boolean) {
    setSelectedIds((currentIds) =>
      checked
        ? [...currentIds.filter((id) => id !== photoId), photoId]
        : currentIds.filter((id) => id !== photoId),
    );
  }

  function handleMove() {
    if (!onMovePhotos || activeSelectedIds.length === 0 || !resolvedMoveTargetId) {
      return;
    }

    onMovePhotos(activeSelectedIds, resolvedMoveTargetId);
    setSelectedIds([]);
  }

  function handleDelete() {
    if (!onDeletePhotos || activeSelectedIds.length === 0) return;

    const count = activeSelectedIds.length;

    if (
      !window.confirm(
        `Delete ${count} ${count === 1 ? "photo" : "photos"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    onDeletePhotos(activeSelectedIds);
    setSelectedIds([]);
  }

  if (chronologicalPhotos.length === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return (
    <div style={listStyle}>
      {manageable ? (
        <div style={manageBarStyle}>
          <label style={selectAllStyle}>
            <input
              type="checkbox"
              checked={
                activeSelectedIds.length === chronologicalPhotos.length &&
                chronologicalPhotos.length > 0
              }
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked
                    ? chronologicalPhotos.map((photo) => photo.id)
                    : [],
                )
              }
            />
            <span>
              {activeSelectedIds.length > 0
                ? `${activeSelectedIds.length} selected`
                : "Select all"}
            </span>
          </label>

          {canMove ? (
            <>
              <select
                value={resolvedMoveTargetId}
                onChange={(event) => setMoveTargetId(event.target.value)}
                style={moveSelectStyle}
              >
                {moveTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                disabled={activeSelectedIds.length === 0}
                onClick={handleMove}
              >
                Move to This Camera
              </Button>
            </>
          ) : null}

          {onDeletePhotos ? (
            <Button
              type="button"
              variant="danger"
              disabled={activeSelectedIds.length === 0}
              onClick={handleDelete}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}

      {chronologicalPhotos.map((photo) => {
        const deerProfile = deerProfiles.find(
          (profile) => profile.id === photo.deerProfileId,
        );
        const weather =
          photo.weatherSnapshot && hasWeatherSnapshot(photo.weatherSnapshot)
            ? weatherSnapshotDescription(photo.weatherSnapshot)
            : "";

        return (
          <article key={photo.id} style={photoCardStyle}>
            <div style={headerStyle}>
              <div style={titleWrapStyle}>
                {manageable ? (
                  <input
                    type="checkbox"
                    checked={activeSelectedIds.includes(photo.id)}
                    onChange={(event) =>
                      toggleSelected(photo.id, event.target.checked)
                    }
                    style={photoCheckboxStyle}
                    aria-label={`Select ${photo.fileName}`}
                  />
                ) : null}
                <div>
                  <p style={eyebrowStyle}>{formatPhotoDate(photo.photoDate)}</p>
                  <h4 style={titleStyle}>{photo.fileName}</h4>
                </div>
              </div>
              <div style={badgeRowStyle}>
                {weather && photo.weatherSnapshot ? (
                  <Badge
                    variant={
                      photo.weatherSnapshot.source === "photo"
                        ? "success"
                        : "default"
                    }
                  >
                    {weatherSourceLabel(photo.weatherSnapshot.source)}
                  </Badge>
                ) : null}
                <Badge>{photo.species}</Badge>
                {photo.behavior ? <Badge>{photo.behavior}</Badge> : null}
                {photo.travelDirection ? (
                  <Badge variant="success">Headed {photo.travelDirection}</Badge>
                ) : null}
              </div>
            </div>

            {photo.imageId ? (
              <div style={imageWrapStyle}>
                <PhotoImage
                  imageId={photo.imageId}
                  alt={`${photo.species} photo — ${photo.fileName}`}
                  aspectRatio={
                    photo.imageWidth && photo.imageHeight
                      ? photo.imageWidth / photo.imageHeight
                      : 4 / 3
                  }
                />
              </div>
            ) : null}

            {deerProfile || photo.buckName || photo.notes || weather ? (
              <div style={detailsStyle}>
                {weather ? (
                  <PhotoDetail label="Weather" value={weather} />
                ) : null}
                {deerProfile ? (
                  <PhotoDetail
                    label="Deer Profile"
                    value={deerProfile.nickname}
                  />
                ) : null}
                {photo.buckName ? (
                  <PhotoDetail label="Buck Name" value={photo.buckName} />
                ) : null}
                {photo.notes ? (
                  <PhotoDetail label="Notes" value={photo.notes} />
                ) : null}
              </div>
            ) : null}

            {photo.species === "Buck" &&
            (onCreateBuckFromPhoto || onLinkPhotoToBuck) ? (
              <div style={buckActionsStyle}>
                {onLinkPhotoToBuck ? (
                  <label style={buckLinkLabelStyle}>
                    <span style={detailLabelStyle}>Link to buck</span>
                    <select
                      aria-label={`Link ${photo.fileName} to a buck`}
                      value={photo.deerProfileId || ""}
                      onChange={(event) =>
                        onLinkPhotoToBuck(photo.id, event.target.value)
                      }
                      style={buckSelectStyle}
                    >
                      <option value="">Not linked</option>
                      {deerProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.nickname}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {onCreateBuckFromPhoto && !photo.deerProfileId ? (
                  <button
                    type="button"
                    onClick={() => onCreateBuckFromPhoto(photo)}
                    style={newBuckButtonStyle}
                  >
                    + New buck from this photo
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PhotoDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={detailLabelStyle}>{label}</p>
      <p style={detailValueStyle}>{value}</p>
    </div>
  );
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const manageBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  flexWrap: "wrap",
  padding: "0.65rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const selectAllStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  minHeight: "40px",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const moveSelectStyle: CSSProperties = {
  minHeight: "40px",
  minWidth: "150px",
  padding: "0.45rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
};

const titleWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.65rem",
  minWidth: 0,
};

const photoCheckboxStyle: CSSProperties = {
  width: "1.15rem",
  height: "1.15rem",
  marginTop: "0.2rem",
  flexShrink: 0,
};

const photoCardStyle: CSSProperties = {
  padding: "0.9rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.4rem",
  flexWrap: "wrap",
};

const imageWrapStyle: CSSProperties = {
  marginTop: "0.75rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.25,
};

const detailsStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid var(--border)",
};

const buckActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "0.6rem",
  flexWrap: "wrap",
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid var(--border)",
};

const buckLinkLabelStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const buckSelectStyle: CSSProperties = {
  minHeight: "40px",
  minWidth: "150px",
  padding: "0.45rem 0.6rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
};

const newBuckButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0.45rem 0.7rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--accent)",
  fontSize: "0.85rem",
  fontWeight: 800,
  cursor: "pointer",
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const detailValueStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
