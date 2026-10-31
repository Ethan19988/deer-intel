"use client";

import { useState, type CSSProperties } from "react";
import type { LandTagKind } from "@/lib/landTags";

// The parcel owner card: who owns the land you tapped, how big it is, the
// county record (parcel ID, address) when the county publishes one, and what
// you can do with it — mark it as land you can hunt, keep an eye on it as a
// neighbor, see how far it is from your property, or copy the owner's details.
// Line-driven so both owner sources share it (the tile pick and the county
// ArcGIS lookup).
type ParcelOwnerInfoCardProps = {
  ownerName: string;
  /** One-line summary above the name, e.g. "Private · 84.2 acres". */
  summary: string;
  lines: { label: string; value: string }[];
  onClose: () => void;
  /** Current tag on this owner's land, if any. */
  tag?: LandTagKind | null;
  /** Set or clear a tag; omit to hide the tag buttons. */
  onTag?: (kind: LandTagKind | null) => void;
  /** e.g. "0.6 mi from Moore Hill Area"; omit when there's no property point. */
  distanceLabel?: string | null;
  /** "SMITH JOHN (changed Nov 2026)" when the land changed hands recently. */
  previousOwner?: string | null;
};

export default function ParcelOwnerInfoCard({
  ownerName,
  summary,
  lines,
  onClose,
  tag = null,
  onTag,
  distanceLabel,
  previousOwner,
}: ParcelOwnerInfoCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDistance, setShowDistance] = useState(false);

  function copyOwner() {
    const text = [
      ownerName,
      summary,
      ...(previousOwner ? [`Previously: ${previousOwner}`] : []),
      ...lines
        .filter((line) => line.value && line.value !== "Not listed")
        .map((line) => `${line.label}: ${line.value}`),
    ].join("\n");
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  return (
    <aside
      className="di-map-card di-owner-card"
      style={cardStyle}
      aria-label={`Parcel owner: ${ownerName}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div style={headerStyle}>
        <div style={titleWrapStyle}>
          <p style={eyebrowStyle}>{summary}</p>
          <h3 style={titleStyle}>{ownerName}</h3>
          {tag ? (
            <p style={{ ...tagLineStyle, color: tag === "permission" ? "#a9b88a" : "#c9ccc2" }}>
              {tag === "permission" ? "■ Permission to hunt" : "■ Neighbor you noted"}
            </p>
          ) : null}
          {previousOwner ? (
            <p style={previousOwnerStyle}>
              <span style={previousLabelStyle}>Previously:</span> {previousOwner}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close parcel owner card"
          className="di-map-close-button"
          style={closeButtonStyle}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div style={detailsStyle}>
        {lines.map((line) => (
          <div key={line.label} style={lineStyle}>
            <span style={lineLabelStyle}>{line.label}</span>
            <span style={lineValueStyle}>{line.value}</span>
          </div>
        ))}
        {showDistance && distanceLabel ? (
          <div style={lineStyle}>
            <span style={lineLabelStyle}>Distance</span>
            <span style={lineValueStyle}>{distanceLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="di-owner-card-actions" style={actionsStyle}>
        {onTag ? (
          <>
            <button
              type="button"
              aria-pressed={tag === "permission"}
              style={tag === "permission" ? primaryButtonStyle : callToActionStyle}
              onClick={() => onTag(tag === "permission" ? null : "permission")}
            >
              {tag === "permission" ? "✓ Permission" : "Mark permission"}
            </button>
            <button
              type="button"
              aria-pressed={tag === "neighbor"}
              style={tag === "neighbor" ? activeButtonStyle : buttonStyle}
              onClick={() => onTag(tag === "neighbor" ? null : "neighbor")}
            >
              {tag === "neighbor" ? "✓ Neighbor" : "Add as neighbor"}
            </button>
          </>
        ) : null}
        {distanceLabel ? (
          <button
            type="button"
            aria-pressed={showDistance}
            style={buttonStyle}
            onClick={() => setShowDistance((value) => !value)}
          >
            Measure to here
          </button>
        ) : null}
        <button type="button" style={buttonStyle} onClick={copyOwner}>
          {copied ? "Copied" : "Copy owner"}
        </button>
      </div>
    </aside>
  );
}

const cardStyle: CSSProperties = {
  position: "absolute",
  right: "1rem",
  bottom: "7.4rem",
  zIndex: 1100,
  display: "grid",
  gap: "0.6rem",
  width: "min(400px, calc(100% - 2rem))",
  padding: "0.85rem 1rem 1rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius)",
  background: "rgba(11, 13, 11, 0.97)",
  color: "#e8e6df",
  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.7rem",
  // As a grid item this would otherwise refuse to shrink below its content
  // (min-width:auto), letting a long owner name push the close button out.
  minWidth: 0,
};

const titleWrapStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

const monoStyle: CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const eyebrowStyle: CSSProperties = {
  ...monoStyle,
  margin: 0,
  color: "#8f948a",
  fontSize: "0.68rem",
};

// Long owner names wrap (never ellipsized away — the name is the point of the
// card) while the close button stays pinned top-right.
const titleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "#e8e6df",
  fontSize: "1.9rem",
  lineHeight: 1,
  overflowWrap: "anywhere",
};

const tagLineStyle: CSSProperties = {
  ...monoStyle,
  margin: "0.3rem 0 0",
  fontSize: "0.68rem",
};

// Matches the map's violet "changed" parcel outline (ParcelTilesLayer).
const previousOwnerStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--map-parcel-changed, #d2bfff)",
  fontSize: "0.85rem",
  lineHeight: 1.3,
  overflowWrap: "anywhere",
};

const previousLabelStyle: CSSProperties = {
  ...monoStyle,
  fontSize: "0.66rem",
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  minHeight: "40px",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "#e8e6df",
  fontSize: "0.95rem",
  cursor: "pointer",
};

const detailsStyle: CSSProperties = {
  display: "grid",
};

const lineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "1rem",
  padding: "0.45rem 0",
  borderBottom: "1px solid #23281f",
};

const lineLabelStyle: CSSProperties = {
  ...monoStyle,
  flex: "none",
  color: "#8f948a",
  fontSize: "0.66rem",
};

const lineValueStyle: CSSProperties = {
  minWidth: 0,
  color: "#e8e6df",
  fontSize: "0.9rem",
  textAlign: "right",
  overflowWrap: "anywhere",
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.5rem",
  paddingTop: "0.2rem",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.5rem",
  border: "1px solid #3a4134",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "#e8e6df",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.05rem",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const callToActionStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#ff6a1a",
  background: "#ff6a1a",
  color: "#0b0d0b",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#a9b88a",
  background: "#3a4630",
};

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#c9ccc2",
  background: "#23281f",
};
