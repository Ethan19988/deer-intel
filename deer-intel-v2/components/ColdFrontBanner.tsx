"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { coldFrontStatus, type PressureReading } from "@/lib/liveWeather";

type ColdFrontBannerProps = {
  propertyName: string;
  pressure?: PressureReading;
};

// A prominent, dismissible dashboard callout when a real cold front is moving in
// — the biggest deer-movement trigger there is. Shows regardless of whether the
// hunter granted notifications (that path lives in HuntConditionAlerts), so the
// signal never depends on a permission prompt. Detection is shared with the
// notification via coldFrontStatus, so the two never disagree.
export default function ColdFrontBanner({
  propertyName,
  pressure,
}: ColdFrontBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const front = coldFrontStatus(pressure);

  if (!front.isFront || dismissed) return null;

  const dropText =
    front.dropInHg !== null ? ` — down ${front.dropInHg.toFixed(2)} inHg` : "";

  return (
    <div role="status" style={bannerStyle}>
      <span style={iconStyle} aria-hidden="true">
        ❄️
      </span>
      <p style={textStyle}>
        <strong>Cold front moving in{dropText}.</strong> The barometer is
        falling on {propertyName} — prime movement. Get a sit picked.
      </p>
      <Link href="/map" className="di-navbtn" style={linkStyle}>
        Plan a sit
      </Link>
      <button
        type="button"
        aria-label="Dismiss cold front alert"
        style={dismissStyle}
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}

const bannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.8rem 1rem",
  border: "1px solid var(--accent-2-tint-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2-tint)",
  color: "var(--accent-2-text)",
};

const iconStyle: CSSProperties = {
  flex: "none",
  fontSize: "1.25rem",
  lineHeight: 1,
};

const textStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  fontSize: "0.9rem",
  lineHeight: 1.4,
  color: "var(--accent-2-text)",
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "40px",
  padding: "0.4rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid var(--accent-2-text)",
  background: "transparent",
  color: "var(--accent-2-text)",
  fontSize: "0.85rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const dismissStyle: CSSProperties = {
  flex: "none",
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "var(--accent-2-text)",
  fontSize: "1.2rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};
