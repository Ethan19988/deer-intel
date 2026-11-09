"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import QuickCameraCheck from "@/components/cameras/QuickCameraCheck";
import Badge from "@/components/ui/Badge";
import { lastCheckedLabel } from "@/lib/cameraChecks";
import type { CameraHealthIssue } from "@/lib/cameraHealth";
import { isBuckRecord } from "@/lib/hourlyActivity";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import { photoDateLabel } from "@/lib/photoStrip";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

// One camera site as a tactical list row: status dot, name, and the line that
// matters ("LAST BUCK · KING · SEP 29") plus when it was last checked. The row
// opens the camera's page; Check opens the on-foot quick check under the row;
// Edit opens the inline editor.
export default function CameraSiteRow({
  camera,
  photoRecords,
  latestCheck = null,
  issues = [],
  onEdit,
}: {
  camera: Camera;
  photoRecords: PhotoRecord[];
  /** This camera's newest check, for the "Checked today" line. */
  latestCheck?: CameraCheck | null;
  /** Why this camera needs a visit (lib/cameraHealth), most urgent first. */
  issues?: CameraHealthIssue[];
  onEdit: (camera: Camera) => void;
}) {
  const [isChecking, setIsChecking] = useState(false);
  const checkFormId = `camera-check-${camera.id}`;
  const newestFirst = [...photoRecords].sort(
    (a, b) => photoRecordTime(b) - photoRecordTime(a),
  );
  const lastBuck = newestFirst.find(isBuckRecord);
  const lastPhoto = newestFirst[0];
  const active = camera.status === "Active";

  const meta = lastBuck
    ? ["Last buck", getPhotoBuckNames(lastBuck)[0] ?? "Buck", photoDateLabel(lastBuck)]
    : lastPhoto
      ? ["Last photo", lastPhoto.species || "Deer", photoDateLabel(lastPhoto)]
      : ["No photos yet"];
  if (!active) meta.unshift("Inactive");
  const topIssue = issues[0];
  const issueTitle = issues.map((issue) => issue.label).join(" · ");

  return (
    <li id={`camera-${camera.id}`} style={itemStyle}>
      <div style={rowStyle}>
        <Link href={`/properties/${camera.propertyId}/assets/${camera.id}`} style={linkStyle}>
          <span
            aria-label={active ? "Active" : "Inactive"}
            style={{ ...dotStyle, ...(active ? dotActiveStyle : null) }}
          />
          <span style={textStyle}>
            <span style={nameRowStyle}>
              <span style={nameStyle}>{camera.name}</span>
              {topIssue ? (
                <Badge
                  variant={URGENT_ISSUES.has(topIssue.kind) ? "danger" : "warning"}
                  style={chipStyle}
                  title={`Needs a visit: ${issueTitle}`}
                  aria-label={`Needs a visit: ${issueTitle}`}
                >
                  {topIssue.label}
                  {issues.length > 1 ? ` +${issues.length - 1}` : ""}
                </Badge>
              ) : null}
            </span>
            <span style={metaStyle}>{meta.filter(Boolean).join(" · ")}</span>
            <span style={metaStyle}>{lastCheckedLabel(latestCheck)}</span>
          </span>
          <span aria-hidden="true" style={chevronStyle}>
            ›
          </span>
        </Link>
        <button
          type="button"
          style={{ ...checkStyle, ...(isChecking ? checkActiveStyle : null) }}
          aria-expanded={isChecking}
          aria-controls={checkFormId}
          aria-label={`Check camera ${camera.name}`}
          onClick={() => setIsChecking((open) => !open)}
        >
          Check
        </button>
        <button type="button" style={editStyle} onClick={() => onEdit(camera)}>
          Edit
        </button>
      </div>
      {isChecking ? (
        <div id={checkFormId}>
          <QuickCameraCheck camera={camera} onDone={() => setIsChecking(false)} />
        </div>
      ) : null}
    </li>
  );
}

// The camera has stopped recording (or will on the next trigger).
const URGENT_ISSUES = new Set<CameraHealthIssue["kind"]>([
  "batteryDead",
  "sdMissing",
  "sdFull",
]);

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minWidth: 0,
};

const chipStyle: CSSProperties = {
  flex: "none",
  padding: "0.2rem 0.4rem",
  fontSize: "0.62rem",
  whiteSpace: "nowrap",
};

const itemStyle: CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.25rem",
};

const linkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  flex: "1 1 auto",
  minWidth: 0,
  minHeight: "68px",
  color: "inherit",
  textDecoration: "none",
};

const dotStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  flex: "none",
  border: "1.5px solid var(--text-muted)",
  borderRadius: "999px",
};

const dotActiveStyle: CSSProperties = {
  borderColor: "var(--accent)",
  background: "var(--accent)",
};

const textStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  minWidth: 0,
  flex: "1 1 auto",
};

const nameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "1.02rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.7rem",
  letterSpacing: "0.07em",
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const chevronStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-muted)",
  fontSize: "1.3rem",
};

const editStyle: CSSProperties = {
  flex: "none",
  minWidth: "52px",
  minHeight: "44px",
  border: 0,
  background: "transparent",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  cursor: "pointer",
};

// The row's one real action in the field, so it reads as a button, not a link.
const checkStyle: CSSProperties = {
  flex: "none",
  minWidth: "64px",
  minHeight: "44px",
  padding: "0 0.7rem",
  border: "1px solid var(--accent-2)",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--accent-2-text)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.05rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const checkActiveStyle: CSSProperties = {
  background: "var(--accent-2)",
  color: "var(--accent-2-fg)",
};
