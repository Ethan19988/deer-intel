import type { CSSProperties } from "react";
import Link from "next/link";
import PhotoImage from "@/components/photos/PhotoImage";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CameraIcon } from "@/components/ui/FieldIcons";
import {
  getPhotoSummary,
  photoRecordTime,
  sortPhotoRecordsChronologically,
} from "@/lib/photos";
import type { Camera } from "@/types/camera";
import type { PhotoRecord } from "@/types/photo";

// An active camera with photos, but none this recent, likely needs a visit
// (dead battery, full card, knocked askew).
const QUIET_CAMERA_DAYS = 12;

// Behavior words the photo reader leads notes with; shown on the cover chip.
const BEHAVIOR_PATTERN =
  /^(Traveling|Feeding|Chasing|At scrape or rub|Bedded|Alert)\b/i;

type CameraCardProps = {
  camera: Camera;
  onEdit: (camera: Camera) => void;
  // This camera's saved photos; when provided the card leads with the latest
  // photo as its cover. Optional so older usages keep the plain text card.
  photoRecords?: PhotoRecord[];
};

export default function CameraCard({
  camera,
  onEdit,
  photoRecords,
}: CameraCardProps) {
  const hasCoordinates =
    camera.latitude !== undefined && camera.longitude !== undefined;
  const photos = photoRecords
    ? sortPhotoRecordsChronologically(photoRecords)
    : null;
  const latestPhoto = photos?.at(-1);
  const photoSummary = photos ? getPhotoSummary(photos) : null;
  const quietDays = latestPhoto
    ? Math.floor((Date.now() - photoRecordTime(latestPhoto)) / 86_400_000)
    : null;
  const isQuiet =
    camera.status === "Active" &&
    quietDays !== null &&
    quietDays >= QUIET_CAMERA_DAYS;
  const coverChip = latestPhoto ? buildCoverChip(latestPhoto) : "";
  const stampParts = latestPhoto ? buildStampParts(latestPhoto) : [];

  return (
    <Card style={cardStyle}>
      {photos ? (
        <div style={coverWrapStyle}>
          {latestPhoto?.imageId ? (
            <PhotoImage
              imageId={latestPhoto.imageId}
              alt={`Latest photo from ${camera.name}`}
              style={coverImageStyle}
            />
          ) : (
            <div style={coverPlaceholderStyle}>
              <span style={coverPlaceholderTextStyle}>
                {photos.length > 0
                  ? "Latest photo has no image"
                  : "No photos yet — import some to see them here"}
              </span>
            </div>
          )}

          {coverChip ? <span style={coverChipStyle}>{coverChip}</span> : null}

          <span
            style={{
              ...statusDotStyle,
              background:
                camera.status === "Active" ? "#67a842" : "#a8a493",
            }}
            aria-label={camera.status}
            title={camera.status}
          />

          {stampParts.length > 0 ? (
            <div style={stampBarStyle}>
              {stampParts.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={bodyStyle}>
        <div style={cardHeaderStyle}>
          <div style={leadStyle}>
            <span style={iconBadgeStyle} aria-hidden="true">
              <CameraIcon size={20} />
            </span>
            <div>
              <p style={eyebrowStyle}>{camera.cameraType} Camera Site</p>
              <h3 style={titleStyle}>{camera.name}</h3>
              <p style={subTextStyle}>
                {[camera.manufacturer, camera.model]
                  .filter(Boolean)
                  .join(" ") || "Manufacturer and model not set"}
              </p>
            </div>
          </div>

          <div style={headerActionsStyle}>
            <Badge variant={camera.status === "Active" ? "success" : "warning"}>
              {camera.status}
            </Badge>
            <Link
              href={`/properties/${camera.propertyId}/assets/${camera.id}`}
              style={openSiteLinkStyle}
              className="di-navbtn"
            >
              Open Site
            </Link>
            {photoSummary && photoSummary.totalPhotoRecords > 0 ? (
              <Link
                href={`/properties/${camera.propertyId}/assets/${camera.id}#photos`}
                style={photosLinkStyle}
                className="di-navbtn"
              >
                Photos ({photoSummary.totalPhotoRecords})
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onEdit(camera)}
              style={secondaryButtonStyle}
            >
              Edit
            </Button>
          </div>
        </div>

        {photos && photoSummary ? (
          <p style={statsLineStyle}>
            {photoSummary.totalPhotoRecords}{" "}
            {photoSummary.totalPhotoRecords === 1 ? "photo" : "photos"}
            {photoSummary.buckPhotoRecords > 0
              ? ` · ${photoSummary.buckPhotoRecords} buck`
              : ""}
            {latestPhoto ? ` · last: ${photoSummary.mostRecentPhotoDate}` : ""}
            {!hasCoordinates ? " · GPS not set" : ""}
          </p>
        ) : (
          <p style={statsLineStyle}>
            GPS:{" "}
            {hasCoordinates
              ? `${camera.latitude}, ${camera.longitude}`
              : "Not set"}
          </p>
        )}

        {isQuiet ? (
          <p style={quietLineStyle}>
            Check this camera — no photos in {quietDays} days.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function buildCoverChip(photo: PhotoRecord) {
  if (!photo.species) return "";

  const behaviorMatch = BEHAVIOR_PATTERN.exec(photo.notes.trim());
  const behavior = behaviorMatch ? behaviorMatch[1] : "";

  return behavior ? `${photo.species} — ${behavior}` : photo.species;
}

function buildStampParts(photo: PhotoRecord) {
  const parts: string[] = [];

  if (photo.photoDate.includes("T")) {
    const parsed = new Date(photo.photoDate);

    if (!Number.isNaN(parsed.getTime())) {
      parts.push(
        parsed.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }
  }

  const weather = photo.weatherSnapshot;

  if (weather?.temperature) parts.push(`${weather.temperature}°`);
  if (weather?.windDirection) {
    parts.push(
      [weather.windDirection, weather.windSpeed].filter(Boolean).join(" "),
    );
  }
  if (weather?.moonPhase) parts.push(`${weather.moonPhase} moon`);

  return parts;
}

const cardStyle: CSSProperties = {
  padding: 0,
  overflow: "hidden",
  background: "var(--surface-2)",
};

const coverWrapStyle: CSSProperties = {
  position: "relative",
  height: "180px",
  background: "var(--surface-3)",
};

const coverImageStyle: CSSProperties = {
  height: "100%",
  border: "none",
  borderRadius: 0,
};

const coverPlaceholderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  background: "var(--camo, var(--surface-3))",
  padding: "1rem",
};

const coverPlaceholderTextStyle: CSSProperties = {
  padding: "0.5rem 0.85rem",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 700,
  textAlign: "center",
};

// Overlays sit on the photo itself, so they use fixed photo-safe colors (same
// rule as the dark map controls) rather than theme tokens.
const coverChipStyle: CSSProperties = {
  position: "absolute",
  top: "10px",
  left: "10px",
  padding: "0.25rem 0.55rem",
  borderRadius: "7px",
  background: "rgba(232, 240, 222, 0.94)",
  color: "#2f4d28",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const statusDotStyle: CSSProperties = {
  position: "absolute",
  top: "12px",
  right: "12px",
  width: "11px",
  height: "11px",
  borderRadius: "50%",
  border: "2px solid rgba(255, 255, 255, 0.85)",
};

const stampBarStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  padding: "0.3rem 0.65rem",
  background: "rgba(24, 24, 18, 0.72)",
  color: "#efe9d6",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const bodyStyle: CSSProperties = {
  padding: "1rem",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const leadStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.7rem",
  minWidth: 0,
};

const iconBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.5rem",
  height: "2.5rem",
  flex: "none",
  borderRadius: "12px",
  background: "var(--accent-tint)",
  border: "1px solid var(--accent-tint-border)",
  color: "var(--accent-text)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.25,
};

const subTextStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--text-faint)",
  lineHeight: 1.4,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "36px",
  padding: "0.5rem 0.65rem",
  fontSize: "0.85rem",
};

const openSiteLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "white",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const photosLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "36px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
};

const statsLineStyle: CSSProperties = {
  margin: "0.85rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.5,
};

const quietLineStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--accent-2-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};
