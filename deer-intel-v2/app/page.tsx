"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import LiveWeatherPanel from "@/components/weather/LiveWeatherPanel";
import HuntConditionAlerts from "@/components/HuntConditionAlerts";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import { fetchLiveWeather, resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { getStandWindCheck } from "@/lib/standWind";
import { getHuntPlannerSummary, plannerHuntDate } from "@/lib/huntPlanner";
import { formatHuntDate } from "@/lib/hunts";
import { useMoonPhase } from "@/lib/useMoonPhase";
import MoonPhaseIcon from "@/components/weather/MoonPhaseIcon";

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
  const weatherPoint = resolvePropertyWeatherPoint(
    activeProperty ?? null,
    propertyCameras,
    propertyPins,
  );
  const weatherKey = weatherPoint
    ? `${weatherPoint.lat},${weatherPoint.lng}`
    : "";
  const [currentWind, setCurrentWind] = useState<string>();
  const moon = useMoonPhase();

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  useEffect(() => {
    if (!weatherKey) {
      setCurrentWind(undefined);
      return;
    }

    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;

    fetchLiveWeather({ lat, lng }).then((result) => {
      if (!active) return;
      setCurrentWind(
        result.status === "ok" ? result.fields.windDirection : undefined,
      );
    });

    return () => {
      active = false;
    };
  }, [weatherKey]);

  const goodWindStands = currentWind
    ? propertyStands.filter(
        (stand) => getStandWindCheck(stand, currentWind).status === "good",
      )
    : [];
  const standsWithWindNotes = propertyStands.filter(
    (stand) => stand.bestWinds.trim() || stand.avoidWinds.trim(),
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
      <HuntConditionAlerts
        propertyName={activeProperty?.name ?? "This property"}
        point={weatherPoint}
        stands={propertyStands}
      />
      <Card as="section" variant="elevated" style={briefStyle}>
        <div style={briefHeaderStyle}>
          <div>
            <p
              style={{
                ...eyebrowStyle,
                color: "var(--accent-2-text)",
                textShadow: "0 1px 0 rgba(255, 255, 255, 0.4)",
              }}
            >
              Today
            </p>
            <h1 style={briefTitleStyle}>Today&apos;s Brief</h1>
            {state.properties.length > 1 ? (
              <label style={pickerStyle}>
                <span style={pickerLabelStyle}>Property</span>
                <select
                  style={selectStyle}
                  value={activePropertyId}
                  onChange={(event) => selectProperty(event.target.value)}
                >
                  {state.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <Badge variant={weatherPoint ? "success" : "default"}>
            {weatherPoint ? "Live Weather" : "Weather"}
          </Badge>
        </div>

        <LiveWeatherPanel
          point={weatherPoint}
          emptyHint={
            activeProperty
              ? "Add map pins or a camera location to this property to load live weather."
              : "Set up a property with map pins to load live weather."
          }
        />

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
            label="Moon"
            value={
              moon ? (
                <span style={moonValueStyle}>
                  <MoonPhaseIcon
                    illumination={moon.illumination}
                    waxing={moon.waxing}
                    phase={moon.phase}
                    size={44}
                  />
                  <span>{moon.illumination}% lit</span>
                </span>
              ) : (
                "Reading the sky…"
              )
            }
            detail={moon ? moon.movement : "Calculating tonight's moon phase."}
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

      {activeProperty && propertyStands.length > 0 ? (
        <Section eyebrow="Wind Call" title="Tonight's Sit">
          <Card as="article" variant="subtle" style={insightCardStyle}>
            <div>
              {!currentWind ? (
                <>
                  <p style={insightTitleStyle}>Today&apos;s wind isn&apos;t loaded yet</p>
                  <p style={mutedTextStyle}>
                    Give {activeProperty.name} a saved location, map pins, or a
                    camera so Deer Intel can check the wind against your stands.
                  </p>
                </>
              ) : standsWithWindNotes.length === 0 ? (
                <>
                  <p style={insightTitleStyle}>No wind notes on your stands</p>
                  <p style={mutedTextStyle}>
                    Add best and avoid winds to your stands so Deer Intel can
                    call the right sit.
                  </p>
                </>
              ) : goodWindStands.length > 0 ? (
                <>
                  <p style={insightTitleStyle}>
                    Good wind for {formatStandNames(goodWindStands)}
                  </p>
                  <p style={mutedTextStyle}>
                    Today&apos;s wind is {currentWind}.{" "}
                    {goodWindStands.length === 1 ? "This stand keeps" : "These stands keep"}{" "}
                    your scent off the deer.
                  </p>
                </>
              ) : (
                <>
                  <p style={insightTitleStyle}>
                    No stand matches the {currentWind} wind
                  </p>
                  <p style={mutedTextStyle}>
                    None of your saved stands list {currentWind} as a good wind
                    today — scout, or pick your least-exposed sit.
                  </p>
                </>
              )}
            </div>
            <Badge
              variant={
                !currentWind
                  ? "default"
                  : goodWindStands.length > 0
                    ? "success"
                    : "warning"
              }
            >
              {currentWind ? `Wind ${currentWind}` : "Wind"}
            </Badge>
          </Card>
        </Section>
      ) : null}

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
  value: ReactNode;
}) {
  return (
    <div style={briefItemStyle}>
      <p style={eyebrowStyle}>{label}</p>
      {typeof value === "string" ? (
        <p style={briefValueStyle}>{value}</p>
      ) : (
        <div style={briefValueStyle}>{value}</div>
      )}
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

function formatStandNames(stands: Array<{ name: string }>): string {
  const names = stands.map((stand) => stand.name);

  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
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
  padding: "1.5rem",
  border: "1px solid var(--border-strong)",
  color: "var(--camo-fg)",
  backgroundColor: "var(--camo-ink)",
  backgroundImage:
    "linear-gradient(rgba(233, 226, 206, 0.5), rgba(233, 226, 206, 0.62)), var(--camo)",
  backgroundSize: "cover",
  backgroundPosition: "center",
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
  color: "var(--accent-2-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const briefTitleStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  color: "var(--camo-fg)",
  fontSize: "1.75rem",
  lineHeight: 1.15,
  textShadow: "0 1px 0 rgba(255, 255, 255, 0.4)",
};

const pickerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.55rem",
};

const pickerLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  minHeight: "42px",
  minWidth: "180px",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
};

const briefGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "0.8rem",
};

const briefItemStyle: CSSProperties = {
  minHeight: "128px",
  padding: "0.9rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface-2)",
};

const briefValueStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--text)",
  fontSize: "1.08rem",
  fontWeight: 850,
  lineHeight: 1.25,
};

const moonValueStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const mutedTextStyle: CSSProperties = {
  margin: "0.45rem 0 0",
  color: "var(--text-muted)",
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
  border: "1px solid var(--accent)",
  borderRadius: "8px",
  background: "var(--accent)",
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
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
};

const miniStatValueStyle: CSSProperties = {
  color: "var(--accent-2)",
  fontSize: "1.5rem",
  fontWeight: 900,
  lineHeight: 1,
};

const miniStatLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
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
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 850,
  lineHeight: 1.3,
};
