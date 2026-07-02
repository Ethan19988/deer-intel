"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  getHuntPlannerSummary,
  plannerHuntDate,
  type PlannerCameraActivity,
} from "@/lib/huntPlanner";

const QUICK_ACTIONS = [
  {
    href: "/hunt-log",
    title: "Log Hunt",
    description: "Save what happened on your latest sit.",
  },
  {
    href: "/properties",
    title: "Open Properties",
    description: "Pick a property workspace and review its assets.",
  },
  {
    href: "/map",
    title: "Open Map",
    description: "Check pins, stands, cameras, sign, and access.",
  },
  {
    href: "/cameras",
    title: "Cameras",
    description: "Review camera sites, checks, and photo activity.",
  },
  {
    href: "/stands",
    title: "Stands",
    description: "Check stand sites, wind notes, and hunt history.",
  },
  {
    href: "/ai",
    title: "Intelligence",
    description: "See simple recommendations from your saved Deer Intel data.",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Review local storage and saved data counts.",
  },
];

export default function Home() {
  const state = useDeerIntelStore();
  const planner = getHuntPlannerSummary(state);
  const recommendedProperty = planner.recommendedProperty.property;
  const lastHunt = planner.lastHunt.hunt;

  return (
    <PageShell>
      <Card as="section" variant="elevated" style={heroStyle}>
        <PageHeader
          eyebrow="Hunt Planner"
          title="Today's Hunt Plan"
          description="A simple command center for checking conditions, recent activity, last hunt notes, and the next action before you head out."
          meta={
            <>
              <Badge variant="warning">Weather Placeholder</Badge>
              <Badge variant="success">Local Data</Badge>
            </>
          }
        />
      </Card>

      <Section eyebrow="Today" title="Planner Summary">
        <div style={summaryGridStyle}>
          <SummaryCard
            eyebrow="Weather"
            title="Today's Weather"
            badge="Coming Soon"
            description="Weather, wind, pressure, and daylight will show here when live conditions are added."
          />

          <SummaryCard
            eyebrow="Recommendation"
            title={recommendedProperty?.name ?? "No property yet"}
            badge={planner.recommendedProperty.scoreLabel}
            description={planner.recommendedProperty.reason}
            href={
              recommendedProperty
                ? `/properties/${recommendedProperty.id}`
                : "/properties"
            }
          />

          <SummaryCard
            eyebrow="Last Hunt"
            title={plannerHuntDate(lastHunt)}
            badge={lastHunt ? lastHunt.standName || "Hunt" : "None"}
            description={
              lastHunt
                ? `${planner.lastHunt.propertyName} / ${planner.lastHunt.detail}`
                : planner.lastHunt.detail
            }
            href="/hunt-log"
          />
        </div>
      </Section>

      <Section eyebrow="Trail Cameras" title="Recent Camera Activity">
        <RecentCameraActivity activities={planner.recentCameraActivity} />
      </Section>

      <Section eyebrow="Next Steps" title="Quick Actions">
        <div style={quickActionGridStyle}>
          {QUICK_ACTIONS.map((action) => (
            <ActionCard
              key={action.href}
              href={action.href}
              title={action.title}
              description={action.description}
              size="large"
              tone="primary"
            />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function SummaryCard({
  eyebrow,
  title,
  badge,
  description,
  href,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  description: string;
  href?: string;
}) {
  const content = (
    <>
      <div style={summaryHeaderStyle}>
        <p style={eyebrowStyle}>{eyebrow}</p>
        <Badge variant={badge === "Coming Soon" ? "warning" : "default"}>
          {badge}
        </Badge>
      </div>
      <h2 style={summaryTitleStyle}>{title}</h2>
      <p style={summaryDescriptionStyle}>{description}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={summaryLinkStyle}>
        {content}
      </Link>
    );
  }

  return (
    <Card as="article" variant="subtle" style={summaryCardStyle}>
      {content}
    </Card>
  );
}

function RecentCameraActivity({
  activities,
}: {
  activities: PlannerCameraActivity[];
}) {
  if (activities.length === 0) {
    return (
      <EmptyState description="No recent camera activity yet. Add a camera site or save a camera check to start building this feed." />
    );
  }

  return (
    <div style={activityGridStyle}>
      {activities.map((activity) => (
        <Card key={activity.id} as="article" variant="subtle">
          <div style={activityHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{activity.propertyName}</p>
              <h3 style={activityTitleStyle}>{activity.cameraName}</h3>
            </div>
            <Badge>{activity.dateLabel}</Badge>
          </div>
          <p style={activityDescriptionStyle}>{activity.description}</p>
        </Card>
      ))}
    </div>
  );
}

const heroStyle: CSSProperties = {
  padding: "1.5rem",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
};

const summaryCardStyle: CSSProperties = {
  minHeight: "190px",
};

const summaryLinkStyle: CSSProperties = {
  ...summaryCardStyle,
  display: "block",
  padding: "1.15rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0a0f0a",
  color: "white",
  textDecoration: "none",
};

const summaryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const summaryTitleStyle: CSSProperties = {
  margin: "1rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.45rem",
  lineHeight: 1.2,
};

const summaryDescriptionStyle: CSSProperties = {
  margin: "0.7rem 0 0",
  color: "#b8c2b6",
  fontSize: "1rem",
  lineHeight: 1.55,
};

const activityGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "1rem",
};

const activityHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const activityTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.15rem",
  lineHeight: 1.25,
};

const activityDescriptionStyle: CSSProperties = {
  margin: "0.7rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.5,
};

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};
