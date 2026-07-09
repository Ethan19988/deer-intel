import type { CSSProperties, ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
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
            <Badge>{activity.dateLabel}</Badge>
          </ActivityRow>
        ))
      ) : (
        <>
          <ActivityRow>
            <div>
              <p style={activityTitleStyle}>No activity yet</p>
              <p style={activityDescriptionStyle}>
                Add camera sites, map pins, stands, or hunts to start this
                property&apos;s field history.
              </p>
            </div>
            <Badge>Waiting</Badge>
          </ActivityRow>
          <ActivityRow>
            <div>
              <p style={activityTitleStyle}>Camera history</p>
              <p style={activityDescriptionStyle}>
                Camera checks and transmissions will appear here.
              </p>
            </div>
            <Badge>Coming Soon</Badge>
          </ActivityRow>
        </>
      )}
    </div>
  );
}

function ActivityRow({ children }: { children: ReactNode }) {
  return <Card style={activityRowStyle}>{children}</Card>;
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
  background: "var(--surface)",
};

const activityTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontWeight: 800,
};

const activityDescriptionStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--text-muted)",
  fontSize: "1rem",
  lineHeight: 1.5,
};
