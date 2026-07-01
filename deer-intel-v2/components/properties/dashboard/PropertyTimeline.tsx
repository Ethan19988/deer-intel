import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type {
  PropertyTimelineEvent,
  PropertyTimelineEventIcon,
} from "@/lib/propertyTimeline";

type PropertyTimelineProps = {
  events: PropertyTimelineEvent[];
};

export default function PropertyTimeline({ events }: PropertyTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState description="No timeline events yet. Add camera sites, stands, camera checks, photo records, or hunts to start this property's history." />
    );
  }

  return (
    <div style={timelineStyle}>
      {events.map((event) => (
        <Card key={event.id} as="article" variant="subtle" style={eventStyle}>
          <div style={iconWrapStyle}>
            <TimelineIcon icon={event.icon} />
          </div>
          <div style={contentStyle}>
            <div style={headerStyle}>
              <h3 style={titleStyle}>{event.title}</h3>
              <Badge>{event.dateLabel}</Badge>
            </div>
            <p style={descriptionStyle}>{event.description}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TimelineIcon({ icon }: { icon: PropertyTimelineEventIcon }) {
  if (icon === "photo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 7h3l2-2h4l2 2h3v12H5V7Z" style={iconPathStyle} />
        <path
          d="M12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
          style={iconPathStyle}
        />
      </svg>
    );
  }

  if (icon === "hunt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 4h10v16H7V4Z" style={iconPathStyle} />
        <path d="M10 8h4M10 12h4M10 16h2" style={iconPathStyle} />
      </svg>
    );
  }

  if (icon === "stand") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 20 12 4l5 16M9 13h6M8 17h8" style={iconPathStyle} />
        <path d="M10 8h4" style={iconPathStyle} />
      </svg>
    );
  }

  if (icon === "asset") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 6h14v12H5V6Z" style={iconPathStyle} />
        <path d="M8 10h8M8 14h5" style={iconPathStyle} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
      <path d="M5 8h3l2-2h4l2 2h3v10H5V8Z" style={iconPathStyle} />
      <path
        d="M12 11.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
        style={iconPathStyle}
      />
    </svg>
  );
}

const timelineStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
};

const eventStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: "0.9rem",
  alignItems: "flex-start",
};

const iconWrapStyle: CSSProperties = {
  display: "inline-flex",
  width: "44px",
  height: "44px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #315135",
  borderRadius: "8px",
  background: "#132414",
  color: "#a7d1a6",
};

const iconStyle: CSSProperties = {
  width: "1.35rem",
  height: "1.35rem",
};

const iconPathStyle: CSSProperties = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const contentStyle: CSSProperties = {
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1.05rem",
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  color: "#b8c2b6",
  fontSize: "0.98rem",
  lineHeight: 1.5,
};
