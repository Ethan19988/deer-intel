"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { getHuntPlannerSummary, plannerHuntDate } from "@/lib/huntPlanner";
import { formatHuntDate } from "@/lib/hunts";

const HOME_ACTIONS = [
  {
    href: "/map",
    title: "Start Scouting",
    description: "Open the map, check your position, and add field pins.",
  },
  {
    href: "/hunt-log",
    title: "Start Hunt",
    description: "Review the last sit or log what happens tonight.",
  },
  {
    href: "/map",
    title: "Open Map",
    description: "Go straight to layers, GPS, pins, and property overlays.",
  },
];

export default function Home() {
  const state = useDeerIntelStore();
  const planner = getHuntPlannerSummary(state);
  const recommendedProperty = planner.recommendedProperty.property;
  const lastHunt = planner.lastHunt.hunt;
  const activeProperty =
    state.properties.find(
      (property) => property.id === state.selectedPropertyId,
    ) ??
    recommendedProperty ??
    state.properties[0];
  const activePropertyId = activeProperty?.id ?? "";
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === activePropertyId,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === activePropertyId,
  );
  const propertyPins = state.pins.filter(
    (pin) => pin.propertyId === activePropertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === activePropertyId,
  );
  const propertyCameraChecks = state.cameraChecks.filter(
    (check) => check.propertyId === activePropertyId,
  );
  const propertyDeerProfiles = state.deerProfiles.filter(
    (profile) => profile.propertyId === activePropertyId,
  );
  const keyInsights = getHomeInsights({
    activePropertyName: activeProperty?.name,
    cameraCheckCount: propertyCameraChecks.length,
    cameraCount: propertyCameras.length,
    deerProfileCount: propertyDeerProfiles.length,
    huntCount: propertyHunts.length,
    lastHuntDate: lastHunt ? formatHuntDate(lastHunt.date) : null,
    pinCount: propertyPins.length,
    standCount: propertyStands.length,
  });

  return (
    <PageShell maxWidth="980px">
      <Card as="section" variant="elevated" style={briefStyle}>
        <div style={briefHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Today</p>
            <h1 style={briefTitleStyle}>Today&apos;s Brief</h1>
          </div>
          <Badge variant="warning">Weather Coming Soon</Badge>
        </div>

        <div style={briefGridStyle}>
          <BriefItem
            label="Focus"
            value={
              activeProperty
                ? `Scout ${activeProperty.name}`
                : "Set up a property"
            }
            detail="Keep the plan simple before you head out."
          />
          <BriefItem
            label="Last Hunt"
            value={plannerHuntDate(lastHunt)}
            detail={lastHunt ? planner.lastHunt.detail : "No hunt logged yet."}
          />
          <BriefItem
            label="Next Step"
            value={activeProperty ? "Open the map" : "Add property"}
            detail={
              activeProperty
                ? "Check access, pins, and current scouting notes."
                : "Start with one hunting area, then add assets."
            }
          />
        </div>
      </Card>

      <Section eyebrow="Property" title="Active Property">
        <Card as="article" variant="subtle" style={activePropertyStyle}>
          <div style={activePropertyHeaderStyle}>
            <div>
              <h2 style={activePropertyTitleStyle}>
                {activeProperty?.name ?? "No property selected"}
              </h2>
              <p style={mutedTextStyle}>
                {activeProperty
                  ? propertySubtitle(activeProperty.county, activeProperty.acres)
                  : "Create a property to unlock map pins, stands, cameras, and deer profiles."}
              </p>
            </div>
            <Link
              href={activeProperty ? `/properties/${activeProperty.id}` : "/properties"}
              style={propertyLinkStyle}
            >
              Open Property
            </Link>
          </div>

          <div style={propertyStatsStyle}>
            <MiniStat label="Cameras" value={propertyCameras.length} />
            <MiniStat label="Stands" value={propertyStands.length} />
            <MiniStat label="Pins" value={propertyPins.length} />
          </div>
        </Card>
      </Section>

      <section style={actionGridStyle} aria-label="Primary actions">
        {HOME_ACTIONS.map((action) => (
          <ActionCard
            key={`${action.href}-${action.title}`}
            href={action.href}
            title={action.title}
            description={action.description}
            size="large"
            tone="primary"
          />
        ))}
      </section>

      <Section eyebrow="Brief" title="Key Insights">
        <div style={insightListStyle}>
          {keyInsights.map((insight) => (
            <Card key={insight.title} as="article" variant="subtle" style={insightCardStyle}>
              <div>
                <p style={insightTitleStyle}>{insight.title}</p>
                <p style={mutedTextStyle}>{insight.detail}</p>
              </div>
              <Badge>{insight.badge}</Badge>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function BriefItem({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div style={briefItemStyle}>
      <p style={eyebrowStyle}>{label}</p>
      <p style={briefValueStyle}>{value}</p>
      <p style={mutedTextStyle}>{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={miniStatStyle}>
      <span style={miniStatValueStyle}>{value}</span>
      <span style={miniStatLabelStyle}>{label}</span>
    </div>
  );
}

function propertySubtitle(county?: string, acres?: string) {
  return [county, acres ? `${acres} acres` : ""]
    .filter(Boolean)
    .join(" / ") || "Property workspace";
}

function getHomeInsights({
  activePropertyName,
  cameraCheckCount,
  cameraCount,
  deerProfileCount,
  huntCount,
  lastHuntDate,
  pinCount,
  standCount,
}: {
  activePropertyName?: string;
  cameraCheckCount: number;
  cameraCount: number;
  deerProfileCount: number;
  huntCount: number;
  lastHuntDate: string | null;
  pinCount: number;
  standCount: number;
}) {
  const insights = [
    activePropertyName
      ? {
          title: "Active property is set",
          detail: `${activePropertyName} is ready for map work, assets, and hunt notes.`,
          badge: "Property",
        }
      : {
          title: "Add your first property",
          detail: "Start with one hunting area so Deer Intel can keep tools organized.",
          badge: "Start",
        },
    {
      title: `${pinCount} mapped ${pinCount === 1 ? "location" : "locations"}`,
      detail:
        pinCount > 0
          ? "Map pins are saved. Use the Map section for layers and placement."
          : "Open Map when you are ready to mark sign, trails, access, or gates.",
      badge: "Map",
    },
    {
      title: `${cameraCount} ${cameraCount === 1 ? "camera" : "cameras"}`,
      detail:
        cameraCheckCount > 0
          ? `${cameraCheckCount} camera checks are saved under Cameras.`
          : "Camera intelligence will live under Cameras once checks are added.",
      badge: "Cameras",
    },
    {
      title: `${standCount} ${standCount === 1 ? "stand" : "stands"}`,
      detail:
        huntCount > 0
          ? `${huntCount} hunts are logged for this property.`
          : "Stand wind, access, and history stay under Stands and Hunts.",
      badge: "Stands",
    },
    {
      title: lastHuntDate ? `Last hunt: ${lastHuntDate}` : "No hunts logged yet",
      detail:
        deerProfileCount > 0
          ? `${deerProfileCount} deer profiles are saved under the property workspace.`
          : "Use Hunts and Deer Profiles when field history starts building.",
      badge: "Hunts",
    },
  ];

  return insights.slice(0, 5);
}

const briefStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.2rem",
};

const briefHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const briefTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.65rem",
  lineHeight: 1.15,
};

const briefGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "0.8rem",
};

const briefItemStyle: CSSProperties = {
  minHeight: "128px",
  padding: "0.9rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#070a07",
};

const briefValueStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "#f1f5ef",
  fontSize: "1.08rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const mutedTextStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "#b8c2b6",
  lineHeight: 1.45,
};

const activePropertyStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const activePropertyHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const activePropertyTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.35rem",
  lineHeight: 1.2,
};

const propertyLinkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "46px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.65rem 0.85rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 850,
  textDecoration: "none",
};

const propertyStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.65rem",
};

const miniStatStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  minHeight: "68px",
  alignContent: "center",
  padding: "0.65rem",
  border: "1px solid #243224",
  borderRadius: "8px",
  background: "#0d120d",
};

const miniStatValueStyle: CSSProperties = {
  color: "#f1f5ef",
  fontSize: "1.25rem",
  fontWeight: 900,
  lineHeight: 1,
};

const miniStatLabelStyle: CSSProperties = {
  color: "#b8c2b6",
  fontSize: "0.86rem",
  fontWeight: 800,
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "1rem",
  marginTop: "1.75rem",
};

const insightListStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const insightCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const insightTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "1rem",
  fontWeight: 850,
  lineHeight: 1.3,
};
