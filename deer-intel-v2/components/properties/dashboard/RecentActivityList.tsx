import type { CSSProperties, ReactNode } from "react";
import type { ActivityItem } from "@/lib/propertyDashboard";

type RecentActivityListProps = {
  activities: ActivityItem[];
};

export default function RecentActivityList({
  activities,
}: RecentActivityListProps) {
  return (
    <div style={activityListStyle}>
      {activities.length > 0 ? (
        activities.map((activity) => (
          <ActivityRow key={`${activity.title}-${activity.description}`}>
            <div>
              <p style={activityTitleStyle}>{activity.title}</p>
              <p style={activityDescriptionStyle}>{activity.description}</p>
            </div>
            <span style={activityDateStyle}>{activity.dateLabel}</span>
          </ActivityRow>
        ))
      ) : (
        <>
          <ActivityRow>
            <div>
              <p style={activityTitleStyle}>No activity yet</p>
              <p style={activityDescriptionStyle}>
                Add camera sites, map pins, stands, or hunts to build this
                property&apos;s intelligence timeline.
              </p>
            </div>
            <span style={activityDateStyle}>Waiting</span>
          </ActivityRow>
          <ActivityRow>
            <div>
              <p style={activityTitleStyle}>Camera history</p>
              <p style={activityDescriptionStyle}>
                Camera checks and transmissions will appear here.
              </p>
            </div>
            <span style={activityDateStyle}>Coming Soon</span>
          </ActivityRow>
        </>
      )}
    </div>
  );
}

function ActivityRow({ children }: { children: ReactNode }) {
  return <article style={activityRowStyle}>{children}</article>;
}

const activityListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const activityRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "1rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const activityTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontWeight: 800,
};

const activityDescriptionStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const activityDateStyle: CSSProperties = {
  flexShrink: 0,
  color: "#85a984",
  fontSize: "0.85rem",
  fontWeight: 700,
};
