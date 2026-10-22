"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { isBuckRecord } from "@/lib/hourlyActivity";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import { photoDateLabel } from "@/lib/photoStrip";
import type { Camera } from "@/types/camera";
import type { PhotoRecord } from "@/types/photo";

// One camera site as a tactical list row: status dot, name, and the line that
// matters ("LAST BUCK · KING · SEP 29"). The row opens the camera's page;
// Edit opens the inline editor.
export default function CameraSiteRow({
  camera,
  photoRecords,
  onEdit,
}: {
  camera: Camera;
  photoRecords: PhotoRecord[];
  onEdit: (camera: Camera) => void;
}) {
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

  return (
    <li id={`camera-${camera.id}`} style={rowStyle}>
      <Link href={`/properties/${camera.propertyId}/assets/${camera.id}`} style={linkStyle}>
        <span
          aria-label={active ? "Active" : "Inactive"}
          style={{ ...dotStyle, ...(active ? dotActiveStyle : null) }}
        />
        <span style={textStyle}>
          <span style={nameStyle}>{camera.name}</span>
          <span style={metaStyle}>{meta.filter(Boolean).join(" · ")}</span>
        </span>
        <span aria-hidden="true" style={chevronStyle}>
          ›
        </span>
      </Link>
      <button type="button" style={editStyle} onClick={() => onEdit(camera)}>
        Edit
      </button>
    </li>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.25rem",
  borderBottom: "1px solid var(--border)",
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
