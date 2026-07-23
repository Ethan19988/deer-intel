"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ActionCard from "@/components/ui/ActionCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Section from "@/components/ui/Section";
import LiveWeatherPanel from "@/components/weather/LiveWeatherPanel";
import PropertyPatternReport from "@/components/properties/PropertyPatternReport";
import { buildPropertyPatternReport } from "@/lib/propertyPatterns";
import MovementScorePanel from "@/components/weather/MovementScorePanel";
import WindCompass from "@/components/weather/WindCompass";
import MoonPhaseCard from "@/components/weather/MoonPhaseCard";
import Barometer from "@/components/weather/Barometer";
import RutRibbon from "@/components/season/RutRibbon";
import HuntConditionAlerts from "@/components/HuntConditionAlerts";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
  type LiveForecast,
} from "@/lib/liveWeather";
import { useUnitPreferences } from "@/lib/units";
import { useSeasonCalendar, getSeasonContext } from "@/lib/seasonCalendar";
import { buildTodaysPlay } from "@/lib/todaysPlay";
import TodaysPlayCard from "@/components/TodaysPlayCard";
import { getStandWindCheck } from "@/lib/standWind";
import { getHuntPlannerSummary, plannerHuntDate } from "@/lib/huntPlanner";
import { formatHuntDate } from "@/lib/hunts";
import HeroScene from "@/components/ui/HeroScene";
import {
  ClipboardIcon,
  CompassIcon,
  DeerIcon,
  MapIcon,
  MapPinIcon,
  TargetIcon,
} from "@/components/ui/FieldIcons";

const HOME_ACTIONS = [
  {
    href: "/map",
    title: "Start Scouting",
    description: "Open the map, check your position, and add field pins.",
    icon: <MapPinIcon size={22} />,
  },
  {
    href: "/hunt-log",
    title: "Start Hunt",
    description: "Review the last sit or log what happens tonight.",
    icon: <ClipboardIcon size={22} />,
  },
  {
    href: "/map",
    title: "Open Map",
    description: "Go straight to layers, GPS, pins, and property overlays.",
    icon: <MapIcon size={22} />,
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
  const patternReport = buildPropertyPatternReport(
    propertyHunts,
    propertyCameraChecks,
    propertyCameras,
  );
  const hasPatternSignal =
    patternReport.conditionInsights.length > 0 || Boolean(patternReport.hottestCamera);
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
  const [forecast, setForecast] = useState<LiveForecast | null>(null);
  const units = useUnitPreferences();
  const seasonPrefs = useSeasonCalendar();
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
      setForecast(null);
      return;
    }

    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;

    fetchLiveForecast({ lat, lng }, units).then((result) => {
      if (!active) return;
      setForecast(result.status === "ok" ? result.forecast : null);
    });

    return () => {
      active = false;
    };
  }, [weatherKey, units.temperature, units.wind]);

  const currentWind = forecast?.current.windDirection;
  const seasonCtx = getSeasonContext(now ?? new Date(), seasonPrefs, activeProperty?.latitude);
  const todaysPlay = buildTodaysPlay({
    forecast,
    stands: propertyStands,
    patternReport,
    rutLabel: seasonCtx.phaseLabel,
    rutActive: ["seeking", "chasing", "peak"].includes(seasonCtx.phase),
  });

  const goodWindStands = currentWind
    ? propertyStands.filter(
        (stand) => getStandWindCheck(stand, currentWind).status === "good",
      )
    : [];

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
        <HeroScene />
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
          essentialsOnly
          emptyHint={
            activeProperty
              ? "Add map pins or a camera location to this property to load live weather."
              : "Set up a property with map pins to load live weather."
          }
        />

        <MovementScorePanel point={weatherPoint} />

        <div style={instrumentsRowStyle}>
          <WindCompass
            wind={currentWind}
            windSpeed={forecast?.current.windSpeed}
            stands={propertyStands}
          />
          <MoonPhaseCard />
          <Barometer pressure={forecast?.pressure} />
        </div>

        <RutRibbon
          phase={seasonCtx.phase}
          phaseLabel={seasonCtx.phaseLabel}
          daysToPeak={seasonCtx.daysToPeak}
        />

        <div style={briefGridStyle}>
          <BriefItem
            icon={<TargetIcon size={18} />}
            label="Focus"
            value={
              activeProperty
                ? `Scout ${activeProperty.name}`
                : "Set up a property"
            }
            detail="Keep the plan simple before you head out."
          />
          <BriefItem
            icon={<DeerIcon size={18} />}
            label="Last Hunt"
            value={plannerHuntDate(lastHunt)}
            detail={lastHunt ? planner.lastHunt.detail : "No hunt logged yet."}
          />
          <BriefItem
            icon={<CompassIcon size={18} />}
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

      {activeProperty && hasPatternSignal ? (
        <Section eyebrow="Patterns" title="What's Been Working">
          <PropertyPatternReport report={patternReport} limit={2} />
        </Section>
      ) : null}

      {activeProperty && propertyStands.length > 0 ? (
        <Section eyebrow="Today's Play" title="The Call">
          {todaysPlay ? (
            <TodaysPlayCard play={todaysPlay} />
          ) : (
            <Card as="article" variant="subtle" style={insightCardStyle}>
              <div>
                <p style={insightTitleStyle}>
                  Today&apos;s conditions aren&apos;t loaded yet
                </p>
                <p style={mutedTextStyle}>
                  Give {activeProperty.name} a saved location, map pins, or a camera
                  so Deer Intel can read the wind and barometer and call today&apos;s
                  play.
                </p>
              </div>
            </Card>
          )}
        </Section>
      ) : null}

      <section style={actionGridStyle} aria-label="Primary actions">
        {HOME_ACTIONS.map((action) => (
          <ActionCard
            key={`${action.href}-${action.title}`}
            href={action.href}
            title={action.title}
            description={action.description}
            icon={action.icon}
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
  icon: ReactNode;
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
  position: "relative",
  overflow: "hidden",
  isolation: "isolate",
  display: "grid",
  gap: "1.1rem",
  padding: "1.75rem",
  border: "1px solid var(--border-strong)",
  borderTop: "5px solid var(--accent)",
  color: "#f3edd9",
  backgroundColor: "var(--camo-ink)",
  // Bold, vivid golden-hour hero: a big bright low sun top-right and a green
  // rise bottom-left over a warm green-to-amber scrim on the camo. The top-left
  // (where the heading sits) stays dark enough for cream text, while the mid and
  // bottom stay light so the color pops instead of going muddy. Overlay colors
  // are fixed & photo-safe (same rule as the login hero and map/photo overlays).
  backgroundImage:
    "radial-gradient(330px 310px at 97% -8%, rgba(255, 178, 92, 0.95), rgba(230, 110, 45, 0.4) 46%, transparent 74%), " +
    "radial-gradient(95% 80% at -12% 116%, rgba(58, 138, 74, 0.5), transparent 60%), " +
    "linear-gradient(158deg, rgba(16, 26, 12, 0.88) 0%, rgba(34, 58, 28, 0.5) 48%, rgba(150, 82, 26, 0.42) 100%), " +
    "var(--camo)",
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 24px 50px -28px rgba(12, 18, 8, 0.6)",
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
  border: "1px solid rgba(243, 237, 217, 0.3)",
  background: "rgba(243, 237, 217, 0.14)",
  color: "#f6efd6",
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
  color: "rgba(243, 237, 217, 0.72)",
};

const briefTitleStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
  margin: "0.55rem 0 0",
  color: "#f6f0dc",
  fontSize: "2.6rem",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  lineHeight: 1.02,
  textShadow: "0 2px 18px rgba(12, 18, 8, 0.5)",
};

const heroSparkStyle: CSSProperties = {
  fontSize: "1.7rem",
  transform: "rotate(8deg)",
};

const heroPropertyLineStyle: CSSProperties = {
  margin: "0.3rem 0 0",
  color: "rgba(243, 237, 217, 0.82)",
  fontSize: "1.05rem",
  fontWeight: 600,
};

const heroPropertyStyle: CSSProperties = {
  color: "#ffce80",
  fontWeight: 900,
  textShadow: "0 0 18px rgba(240, 165, 75, 0.55)",
};

const heroTaglineStyle: CSSProperties = {
  maxWidth: "48ch",
  margin: "0.7rem 0 0",
  color: "rgba(243, 237, 217, 0.88)",
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
  color: "rgba(243, 237, 217, 0.82)",
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

const instrumentsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.8rem",
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
  color: "var(--accent-2-text)",
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
