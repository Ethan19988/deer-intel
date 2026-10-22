import Link from "next/link";
import type { CSSProperties } from "react";
import PhotoImage from "@/components/photos/PhotoImage";

export type StripPhoto = {
  id: string;
  imageId: string;
  title: string;
  subtitle: string;
  href: string;
  isBuck: boolean;
  /** Short date ("Sep 29") for the grid caption. */
  dateLabel?: string;
};

// The newest trail-camera photos on the property, side-scrolling, so Today
// shows what's actually walking the ground and not just the forecast.
export default function CameraPhotoStrip({
  photos,
  allHref,
  layout = "row",
}: {
  photos: StripPhoto[];
  allHref?: string;
  /** "row" side-scrolls (Today); "grid" is two columns (Cameras page). */
  layout?: "row" | "grid";
}) {
  if (photos.length === 0) return null;
  const grid = layout === "grid";

  return (
    <section style={sectionStyle} aria-label="Latest on camera">
      <div style={headerStyle}>
        <h2 style={titleStyle}>Latest on camera</h2>
        {allHref ? (
          <Link href={allHref} style={allLinkStyle}>
            All photos →
          </Link>
        ) : null}
      </div>
      <ul style={grid ? gridStyle : rowStyle}>
        {photos.map((photo) => (
          <li key={photo.id} style={grid ? gridItemStyle : itemStyle}>
            <Link href={photo.href} style={cardLinkStyle}>
              <div style={frameWrapStyle}>
                <PhotoImage
                  imageId={photo.imageId}
                  alt={photo.title}
                  aspectRatio={4 / 3}
                  style={photoStyle}
                />
                {photo.isBuck ? <span style={buckTagStyle}>Buck</span> : null}
              </div>
              {grid ? (
                <span style={gridCaptionStyle}>
                  <span style={gridTitleStyle}>{photo.title}</span>
                  <span style={gridDateStyle}>{photo.dateLabel ?? ""}</span>
                </span>
              ) : (
                <>
                  <span style={photoTitleStyle}>{photo.title}</span>
                  <span style={photoSubStyle}>{photo.subtitle}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "1rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.6rem",
  fontWeight: 400,
  letterSpacing: "0.03em",
};

const allLinkStyle: CSSProperties = {
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
  color: "var(--text)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  textDecoration: "none",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 45%), 1fr))",
  gap: "0.5rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const gridItemStyle: CSSProperties = {
  minWidth: 0,
};

const gridCaptionStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
  minWidth: 0,
};

const gridTitleStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "1.2rem",
  letterSpacing: "0.03em",
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const gridDateStyle: CSSProperties = {
  flex: "none",
  color: "var(--text-muted)",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.68rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "min(62%, 220px)",
  gap: "0.7rem",
  margin: "0 -1rem",
  padding: "0 1rem 0.35rem",
  overflowX: "auto",
  scrollSnapType: "x mandatory",
  // Snap to the page gutter, not the screen edge.
  scrollPaddingInline: "1rem",
  listStyle: "none",
  WebkitOverflowScrolling: "touch",
};

const itemStyle: CSSProperties = {
  scrollSnapAlign: "start",
  minWidth: 0,
};

const cardLinkStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  color: "inherit",
  textDecoration: "none",
};

const frameWrapStyle: CSSProperties = {
  position: "relative",
};

const photoStyle: CSSProperties = {
  borderRadius: "var(--radius)",
  border: "none",
  background: "#1d2419",
};

const buckTagStyle: CSSProperties = {
  position: "absolute",
  top: "0.5rem",
  left: "0.5rem",
  padding: "0.2rem 0.55rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2)",
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 800,
};

const photoTitleStyle: CSSProperties = {
  overflow: "hidden",
  marginTop: "0.25rem",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const photoSubStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.8rem",
};
