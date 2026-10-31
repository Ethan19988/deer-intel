"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import DeerProfileMultiSelect from "@/components/photos/DeerProfileMultiSelect";
import PhotoImage from "@/components/photos/PhotoImage";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import {
  dateInputTime,
  formatPhotoDateTime,
  getPhotoBuckNames,
  getPhotoDeerProfileIds,
  sortPhotoRecordsChronologically,
} from "@/lib/photos";
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
  // When provided, buck photos get a multi-select to tag every buck in the
  // frame and a one-tap "New buck from this photo" that records a profile from
  // the AI's read. onSetPhotoBucks replaces the photo's whole link set with the
  // selected profile ids plus loose names (names without a saved profile).
  onCreateBuckFromPhoto?: (photo: PhotoRecord) => void;
  onSetPhotoBucks?: (
    photoId: string,
    deerProfileIds: string[],
    buckNames: string[],
  ) => void;
  /**
   * "grid" shows thumbnails that open a photo's full card; selecting, moving,
   * and deleting (plus any `manageTools`) sit behind a "Manage photos" button.
   * "list" (default) is the full card for every photo.
   */
  layout?: "list" | "grid";
  /** Extra bulk tools shown in the grid's Manage panel (e.g. AI re-read). */
  manageTools?: ReactNode;
};

export default function PhotoRecordList({
  photoRecords,
  deerProfiles = [],
  emptyDescription = "No photo records yet.",
  moveTargets = [],
  onMovePhotos,
  onDeletePhotos,
  onCreateBuckFromPhoto,
  onSetPhotoBucks,
  layout = "list",
  manageTools,
}: PhotoRecordListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [managing, setManaging] = useState(false);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
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

  const cardProps = {
    deerProfiles,
    manageable,
    activeSelectedIds,
    toggleSelected,
    onCreateBuckFromPhoto,
    onSetPhotoBucks,
  };

  if (layout === "grid") {
    // Newest first: the latest pull from the camera is what you open it for.
    const gridPhotos = [...chronologicalPhotos].reverse();
    const openIndex = gridPhotos.findIndex((photo) => photo.id === openPhotoId);
    const openPhoto = openIndex >= 0 ? gridPhotos[openIndex] : null;

    return (
      <div style={listStyle}>
        {manageable || manageTools ? (
          <div style={gridToolbarStyle}>
            <span style={gridCountStyle}>
              {chronologicalPhotos.length} photo{chronologicalPhotos.length === 1 ? "" : "s"}
              {managing && activeSelectedIds.length > 0
                ? ` · ${activeSelectedIds.length} selected`
                : ""}
            </span>
            <Button
              type="button"
              variant={managing ? "primary" : "secondary"}
              onClick={() => {
                setManaging((current) => !current);
                setSelectedIds([]);
              }}
            >
              {managing ? "Done" : "Manage photos"}
            </Button>
          </div>
        ) : null}

        {managing ? (
          <>
            {manageTools}
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
            <p style={gridHintStyle}>Tap photos to select them.</p>
          </>
        ) : null}

        <div style={gridStyle}>
          {gridPhotos.map((photo) => {
            const selected = activeSelectedIds.includes(photo.id);
            const names = getPhotoBuckNames(photo);
            return (
              <button
                key={photo.id}
                type="button"
                style={{ ...thumbStyle, ...(managing && selected ? thumbSelectedStyle : null) }}
                aria-pressed={managing ? selected : undefined}
                aria-label={`${photo.species} ${formatPhotoDateTime(photo.photoDate)}${
                  names.length ? ` — ${names.join(", ")}` : ""
                }`}
                onClick={() =>
                  managing ? toggleSelected(photo.id, !selected) : setOpenPhotoId(photo.id)
                }
              >
                {photo.imageId ? (
                  <PhotoImage
                    imageId={photo.imageId}
                    alt=""
                    aspectRatio={1}
                    style={thumbImageStyle}
                  />
                ) : (
                  <span style={thumbMissingStyle}>No image</span>
                )}
                <span style={thumbLabelStyle}>
                  {names[0] ?? photo.species}
                  <span style={thumbDateStyle}>{shortDate(photo.photoDate)}</span>
                </span>
                {managing ? (
                  <span style={{ ...thumbCheckStyle, ...(selected ? thumbCheckOnStyle : null) }}>
                    {selected ? "✓" : ""}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {openPhoto ? (
          <PhotoViewer
            index={openIndex}
            total={gridPhotos.length}
            onClose={() => setOpenPhotoId(null)}
            onStep={(delta) => {
              const next = gridPhotos[openIndex + delta];
              if (next) setOpenPhotoId(next.id);
            }}
          >
            <PhotoCard photo={openPhoto} {...cardProps} manageable={false} />
          </PhotoViewer>
        ) : null}
      </div>
    );
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

      {chronologicalPhotos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} {...cardProps} />
      ))}
    </div>
  );
}

type PhotoCardProps = {
  photo: PhotoRecord;
  deerProfiles: DeerProfile[];
  manageable: boolean;
  activeSelectedIds: string[];
  toggleSelected: (photoId: string, checked: boolean) => void;
  onCreateBuckFromPhoto?: (photo: PhotoRecord) => void;
  onSetPhotoBucks?: PhotoRecordListProps["onSetPhotoBucks"];
};

// One photo with everything known about it: date, badges, the image, weather,
// notes, and the buck tagging tools.
function PhotoCard({
  photo,
  deerProfiles,
  manageable,
  activeSelectedIds,
  toggleSelected,
  onCreateBuckFromPhoto,
  onSetPhotoBucks,
}: PhotoCardProps) {
  const linkedProfileIds = getPhotoDeerProfileIds(photo);
  const linkedProfileNames = linkedProfileIds
    .map((id) => deerProfiles.find((profile) => profile.id === id)?.nickname)
    .filter((nickname): nickname is string => Boolean(nickname));
  const buckNames = getPhotoBuckNames(photo);
  // Names not covered by a linked profile — what the editor treats as
  // "loose" so toggling a profile off doesn't drop its structured link.
  const linkedNicknameKeys = new Set(
    linkedProfileNames.map((nickname) => nickname.toLowerCase()),
  );
  const looseBuckNames = buckNames.filter(
    (name) => !linkedNicknameKeys.has(name.toLowerCase()),
  );
  const weather =
    photo.weatherSnapshot && hasWeatherSnapshot(photo.weatherSnapshot)
      ? weatherSnapshotDescription(photo.weatherSnapshot)
      : "";

  return (
    <article style={photoCardStyle}>
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
            <p style={eyebrowStyle}>
              {formatPhotoDateTime(photo.photoDate)}
            </p>
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

      {linkedProfileNames.length > 0 ||
      buckNames.length > 0 ||
      photo.notes ||
      weather ? (
        <div style={detailsStyle}>
          {weather ? (
            <PhotoDetail label="Weather" value={weather} />
          ) : null}
          {linkedProfileNames.length > 0 ? (
            <PhotoDetail
              label={
                linkedProfileNames.length === 1
                  ? "Deer Profile"
                  : "Deer Profiles"
              }
              value={linkedProfileNames.join(", ")}
            />
          ) : null}
          {buckNames.length > 0 ? (
            <PhotoDetail
              label={buckNames.length === 1 ? "Buck Name" : "Buck Names"}
              value={buckNames.join(", ")}
            />
          ) : null}
          {photo.notes ? (
            <PhotoDetail label="Notes" value={photo.notes} />
          ) : null}
        </div>
      ) : null}

      {photo.species === "Buck" &&
      (onCreateBuckFromPhoto || onSetPhotoBucks) ? (
        <div style={buckActionsStyle}>
          {onSetPhotoBucks ? (
            <div style={buckLinkLabelStyle}>
              <span style={detailLabelStyle}>Bucks in this photo</span>
              <DeerProfileMultiSelect
                deerProfiles={deerProfiles}
                selectedProfileIds={linkedProfileIds}
                buckNames={looseBuckNames}
                idPrefix={`photo-${photo.id}`}
                onChange={(deerProfileIds, names) =>
                  onSetPhotoBucks(photo.id, deerProfileIds, names)
                }
              />
            </div>
          ) : null}
          {onCreateBuckFromPhoto && linkedProfileIds.length === 0 ? (
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
}

// Full-screen look at one photo from the grid, with previous / next.
function PhotoViewer({
  index,
  total,
  onClose,
  onStep,
  children,
}: {
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onStep(-1);
      if (event.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onStep]);

  return (
    <div style={viewerBackdropStyle} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${total}`}
        style={viewerSheetStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={viewerBarStyle}>
          <button
            type="button"
            style={{ ...viewerStepStyle, ...(index <= 0 ? viewerStepDisabledStyle : null) }}
            disabled={index <= 0}
            onClick={() => onStep(-1)}
          >
            ‹ Newer
          </button>
          <span style={{ ...gridCountStyle, whiteSpace: "nowrap" }}>
            {index + 1} of {total}
          </span>
          <button
            type="button"
            style={{ ...viewerStepStyle, ...(index >= total - 1 ? viewerStepDisabledStyle : null) }}
            disabled={index >= total - 1}
            onClick={() => onStep(1)}
          >
            Older ›
          </button>
          <button type="button" style={viewerCloseStyle} aria-label="Close photo" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={viewerBodyStyle}>{children}</div>
      </div>
    </div>
  );
}

function shortDate(value: string | undefined): string {
  // dateInputTime reads a bare "YYYY-MM-DD" as local midnight, not UTC.
  const time = dateInputTime(value);
  if (Number.isNaN(time)) return "";
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
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
  borderRadius: "var(--radius-sm)",
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
  display: "grid",
  gap: "0.75rem",
  marginTop: "0.85rem",
  paddingTop: "0.85rem",
  borderTop: "1px solid var(--border)",
};

const buckLinkLabelStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const newBuckButtonStyle: CSSProperties = {
  justifySelf: "start",
  minHeight: "40px",
  padding: "0.45rem 0.7rem",
  border: "1px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
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

const gridToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const gridCountStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const gridHintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
  gap: "0.45rem",
};

const thumbStyle: CSSProperties = {
  position: "relative",
  display: "block",
  padding: 0,
  border: "2px solid transparent",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-3)",
  overflow: "hidden",
  cursor: "pointer",
  aspectRatio: "1 / 1",
};

const thumbSelectedStyle: CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 2px var(--accent-tint)",
};

const thumbImageStyle: CSSProperties = {
  height: "100%",
  border: "none",
  borderRadius: 0,
};

const thumbMissingStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  height: "100%",
  color: "var(--text-faint)",
  fontSize: "0.75rem",
};

const thumbLabelStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  gap: "0.25rem",
  padding: "1rem 0.4rem 0.3rem",
  background: "linear-gradient(transparent, rgba(0, 0, 0, 0.72))",
  color: "#fff",
  fontSize: "0.72rem",
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const thumbDateStyle: CSSProperties = {
  flex: "none",
  fontWeight: 600,
  opacity: 0.85,
};

const thumbCheckStyle: CSSProperties = {
  position: "absolute",
  top: "0.35rem",
  right: "0.35rem",
  display: "grid",
  placeItems: "center",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "999px",
  border: "2px solid #fff",
  background: "rgba(0, 0, 0, 0.35)",
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 900,
};

const thumbCheckOnStyle: CSSProperties = {
  background: "var(--accent)",
};

const viewerBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 3100,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.6)",
};

const viewerSheetStyle: CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "94svh",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  borderRadius: "16px 16px 0 0",
  background: "var(--surface)",
  boxShadow: "0 -12px 30px rgba(0, 0, 0, 0.35)",
  overflow: "hidden",
};

const viewerBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid var(--border)",
};

const viewerStepStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.88rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const viewerStepDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: "default",
};

const viewerCloseStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 800,
  cursor: "pointer",
};

const viewerBodyStyle: CSSProperties = {
  overflowY: "auto",
  padding: "0.75rem",
  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
};
