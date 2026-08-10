import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import PhotoImage from "@/components/photos/PhotoImage";
import {
  CALENDAR_KIND_META,
  type CalendarEvent,
} from "@/lib/calendarEvents";

type CalendarDayListProps = {
  events: CalendarEvent[];
};

// The selected day's detail: every hunt, trail-cam sighting, camera check, map
// mark, and walk from that day in one list. Sightings show the actual photo, and
// rows link into the full record so a day is a jumping-off point, not a dead end.
export default function CalendarDayList({ events }: CalendarDayListProps) {
  return (
    <ul style={listStyle}>
      {events.map((event) => {
        const color = CALENDAR_KIND_META[event.kind].color;

        const inner = (
          <>
            <span style={mediaStyle}>
              {event.imageId ? (
                <PhotoImage
                  imageId={event.imageId}
                  alt={event.title}
                  aspectRatio={1}
                  style={thumbStyle}
                />
              ) : (
                <span style={{ ...dotStyle, background: color }} />
              )}
            </span>

            <span style={textStyle}>
              <span style={titleStyle}>{event.title}</span>
              {event.detail ? (
                <span style={detailStyle}>{event.detail}</span>
              ) : null}
              {event.meta ? <span style={metaStyle}>{event.meta}</span> : null}
            </span>

            <span style={rightStyle}>
              <span style={kindStyle}>
                {CALENDAR_KIND_META[event.kind].label}
              </span>
              {event.href ? <span style={chevronStyle}>›</span> : null}
            </span>
          </>
        );

        return (
          <li key={event.id}>
            <Row href={event.href} accent={color}>
              {inner}
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

function Row({
  href,
  accent,
  children,
}: {
  href?: string;
  accent: string;
  children: ReactNode;
}) {
  const style = { ...rowStyle, borderLeftColor: accent };

  if (href) {
    return (
      <Link href={href} style={{ ...style, ...rowLinkStyle }}>
        {children}
      </Link>
    );
  }

  return <div style={style}>{children}</div>;
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.4rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--border)",
  borderLeftWidth: "4px",
  borderRadius: "10px",
  background: "var(--surface)",
};

const rowLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer",
};

const mediaStyle: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
};

const thumbStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "8px",
  objectFit: "cover",
};

const dotStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "999px",
};

const textStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.1rem",
  minWidth: 0,
  flex: 1,
};

const titleStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text)",
  fontSize: "0.92rem",
  fontWeight: 750,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const detailStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  overflow: "hidden",
  color: "var(--text-faint)",
  fontSize: "0.74rem",
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rightStyle: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
};

const kindStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const chevronStyle: CSSProperties = {
  color: "var(--text-faint)",
  fontSize: "1.1rem",
  fontWeight: 800,
};
