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
};

// The newest trail-camera photos on the property, side-scrolling, so Today
// shows what's actually walking the ground and not just the forecast.
export default function CameraPhotoStrip({
  photos,
  allHref,
}: {
  photos: StripPhoto[];
  allHref: string;
}) {
  if (photos.length === 0) return null;

  return (
    <section style={sectionStyle} aria-label="Latest on camera">
      <div style={headerStyle}>
        <h2 style={titleStyle}>Latest on camera</h2>
        <Link href={allHref} style={allLinkStyle}>
          All photos
        </Link>
      </div>
      <ul style={rowStyle}>
        {photos.map((photo) => (
          <li key={photo.id} style={itemStyle}>
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
              <span style={photoTitleStyle}>{photo.title}</span>
              <span style={photoSubStyle}>{photo.subtitle}</span>
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
  fontSize: "1.35rem",
  fontWeight: 800,
};

const allLinkStyle: CSSProperties = {
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
  color: "var(--accent-text)",
  fontWeight: 700,
  textDecoration: "none",
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
  borderRadius: "14px",
  border: "none",
  background: "#1d2419",
};

const buckTagStyle: CSSProperties = {
  position: "absolute",
  top: "0.5rem",
  left: "0.5rem",
  padding: "0.2rem 0.55rem",
  borderRadius: "999px",
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
