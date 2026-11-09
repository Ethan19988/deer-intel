import Link from "next/link";
import type { CSSProperties } from "react";
import { cameraAttentionLine } from "@/lib/cameraHealth";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";

// One line on Today when a camera on this property needs a trip ("2 cameras
// need a visit · Creek Cam battery low ›"), linking to the camera list where
// each row carries its own chip. Hidden when every camera is fine, and until
// the client clock is known (the overdue count depends on today's date).
export default function CameraAttentionLine({
  cameras,
  checks,
  now,
}: {
  cameras: Camera[];
  checks: CameraCheck[];
  now: Date | null;
}) {
  if (!now) return null;

  const line = cameraAttentionLine(cameras, checks, { now });
  if (!line) return null;

  return (
    <Link href="/cameras" style={lineStyle}>
      <span aria-hidden="true" style={dotStyle} />
      <span style={textStyle}>{line}</span>
      <span aria-hidden="true" style={chevronStyle}>
        ›
      </span>
    </Link>
  );
}

const lineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  minHeight: "44px",
  padding: "0.4rem 0.85rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--warning-bg)",
  color: "var(--warning-text)",
  textDecoration: "none",
};

const dotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  flex: "none",
  borderRadius: "999px",
  background: "var(--warning-text)",
};

const textStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.74rem",
  letterSpacing: "0.06em",
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const chevronStyle: CSSProperties = {
  flex: "none",
  fontSize: "1.2rem",
  lineHeight: 1,
};
