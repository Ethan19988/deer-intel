"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import LiveWeatherPanel from "@/components/weather/LiveWeatherPanel";
import MovementScorePanel from "@/components/weather/MovementScorePanel";
import HuntConditionAlerts from "@/components/HuntConditionAlerts";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import { fetchLiveWeather, resolvePropertyWeatherPoint } from "@/lib/liveWeather";
import { getStandWindCheck } from "@/lib/standWind";
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
  const weatherPoint = resolvePropertyWeatherPoint(
    activeProperty ?? null,
    propertyCameras,
    propertyPins,
  );
  const weatherKey = weatherPoint
    ? `${weatherPoint.lat},${weatherPoint.lng}`
    : "";
  const [currentWind, setCurrentWind] = useState<string>();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const greeting = now
    ? getGreeting(now.getHours())
    : { label: "Welcome back", emoji: "👋" };
  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

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

  const heroTagline = getHeroTagline({
    hasProperty: Boolean(activeProperty),
    goodWindStandCount: goodWindStands.length,
    currentWind,
    lastHuntLabel: lastHunt ? formatHuntDate(lastHunt.date) : null,
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
          <div style={heroHeadingWrapStyle}>
            <p style={heroEyebrowStyle}>
              <span style={heroEmojiStyle} aria-hidden="true">
                {greeting.emoji}
              </span>
              <span>{greeting.label}</span>
              {dateLabel ? (
                <>
                  <span style={heroDotStyle} aria-hidden="true" />
                  <span style={heroDateStyle}>{dateLabel}</span>
                </>
              ) : null}
            </p>
            <h1 style={briefTitleStyle}>
              Today&apos;s Brief
              <span style={heroSparkStyle} aria-hidden="true">
                🍂
              </span>
            </h1>
            {activeProperty ? (
              <p style={heroPropertyLineStyle}>
                for <span style={heroPropertyStyle}>{activeProperty.name}</span>
              </p>
            ) : null}
            <p style={heroTaglineStyle}>{heroTagline}</p>
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

        <MovementScorePanel point={weatherPoint} />

        <div style={briefGridStyle}>
          <BriefItem
            icon="🎯"
            label="Focus"
            value={
              activeProperty
                ? `Scout ${activeProperty.name}`
                : "Set up a property"
            }
            detail="Keep the plan simple before you head out."
          />
          <BriefItem
            icon="🦌"
            label="Last Hunt"
            value={plannerHuntDate(lastHunt)}
            detail={lastHunt ? planner.lastHunt.detail : "No hunt logged yet."}
          />
          <BriefItem
            icon="🧭"
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
    </PageShell>
  );
}

function BriefItem({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div style={briefItemStyle}>
      <p style={briefItemLabelRowStyle}>
        <span style={briefItemIconStyle} aria-hidden="true">
          {icon}
        </span>
        <span style={eyebrowStyle}>{label}</span>
      </p>
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

function getGreeting(hour: number): { label: string; emoji: string } {
  if (hour < 5) return { label: "Late night", emoji: "🌙" };
  if (hour < 12) return { label: "Good morning", emoji: "🌄" };
  if (hour < 17) return { label: "Good afternoon", emoji: "🌤️" };
  if (hour < 20) return { label: "Golden hour", emoji: "🌆" };
  return { label: "Good evening", emoji: "🌙" };
}

function getHeroTagline({
  hasProperty,
  goodWindStandCount,
  currentWind,
  lastHuntLabel,
}: {
  hasProperty: boolean;
  goodWindStandCount: number;
  currentWind?: string;
  lastHuntLabel: string | null;
}): string {
  if (!hasProperty) {
    return "Set up your first property to start building season-long intelligence.";
  }
  if (currentWind && goodWindStandCount > 0) {
    return `${currentWind} wind today — ${goodWindStandCount} ${
      goodWindStandCount === 1 ? "stand is" : "stands are"
    } playing right. Here's your read on the day.`;
  }
  if (currentWind) {
    return `${currentWind} wind today. Check your sit below before you head out.`;
  }
  if (lastHuntLabel) {
    return `Last sit was ${lastHuntLabel}. Here's where the day stands.`;
  }
  return "Here's your read on the day before you head to the woods.";
}

const briefStyle: CSSProperties = {
  display: "grid",
  gap: "1.1rem",
  padding: "1.75rem",
  border: "1px solid var(--border-strong)",
  borderTop: "5px solid var(--accent-2)",
  color: "var(--camo-fg)",
  backgroundColor: "var(--camo-ink)",
  backgroundImage:
    "radial-gradient(120% 85% at 100% 0%, rgba(224, 100, 42, 0.22), transparent 55%), " +
    "radial-gradient(95% 75% at 0% 100%, rgba(47, 125, 67, 0.18), transparent 55%), " +
    "linear-gradient(rgba(233, 226, 206, 0.5), rgba(233, 226, 206, 0.62)), var(--camo)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 18px 40px -24px rgba(36, 29, 16, 0.55)",
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

const heroHeadingWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.1rem",
};

const heroEyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  margin: 0,
  padding: "0.32rem 0.7rem 0.32rem 0.55rem",
  width: "fit-content",
  borderRadius: "999px",
  border: "1px solid rgba(191, 80, 25, 0.28)",
  background: "rgba(255, 255, 255, 0.55)",
  color: "var(--accent-2-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const heroEmojiStyle: CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1,
};

const heroDotStyle: CSSProperties = {
  width: "5px",
  height: "5px",
  borderRadius: "50%",
  background: "var(--accent-2)",
};

const heroDateStyle: CSSProperties = {
  color: "var(--camo-fg-muted)",
};

const briefTitleStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
  margin: "0.55rem 0 0",
  color: "var(--camo-fg)",
  fontSize: "2.6rem",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  lineHeight: 1.02,
  textShadow: "0 1px 0 rgba(255, 255, 255, 0.45)",
};

const heroSparkStyle: CSSProperties = {
  fontSize: "1.7rem",
  transform: "rotate(8deg)",
};

const heroPropertyLineStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "var(--camo-fg-muted)",
  fontSize: "1.05rem",
  fontWeight: 600,
};

const heroPropertyStyle: CSSProperties = {
  color: "var(--accent-text)",
  fontWeight: 850,
};

const heroTaglineStyle: CSSProperties = {
  maxWidth: "48ch",
  margin: "0.7rem 0 0",
  color: "var(--camo-fg-muted)",
  fontSize: "1.02rem",
  fontWeight: 600,
  lineHeight: 1.5,
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
  padding: "0.95rem",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  background: "var(--surface)",
  boxShadow: "0 6px 16px -12px rgba(36, 29, 16, 0.5)",
};

const briefItemLabelRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  margin: 0,
};

const briefItemIconStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.85rem",
  height: "1.85rem",
  borderRadius: "9px",
  background: "var(--accent-2-tint)",
  border: "1px solid var(--accent-2-tint-border)",
  fontSize: "1rem",
};

const briefValueStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--text)",
  fontSize: "1.08rem",
  fontWeight: 850,
  lineHeight: 1.25,
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
