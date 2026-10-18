"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import ActionCard from "@/components/ui/ActionCard";
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
import ColdFrontBanner from "@/components/ColdFrontBanner";
import StandWindGrid from "@/components/StandWindGrid";
import DeerHoursChart from "@/components/DeerHoursChart";
import { buildHourlyActivity, isBuckRecord } from "@/lib/hourlyActivity";
import StandCheckPanel from "@/components/StandCheckPanel";
import TodayVerdictHero, { type HeroPhoto } from "@/components/TodayVerdictHero";
import ConditionsStrip from "@/components/ConditionsStrip";
import CameraPhotoStrip, { type StripPhoto } from "@/components/CameraPhotoStrip";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useMoonPhase } from "@/lib/useMoonPhase";
import { rememberSunTimes } from "@/lib/theme";
import { buildTodayVerdict } from "@/lib/todayVerdict";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import type { PhotoRecord } from "@/types/photo";
import BackupReminderBanner from "@/components/BackupReminderBanner";
import { countRecords } from "@/lib/backupReminder";
import { updateDeerIntelStore, useDeerIntelStore } from "@/lib/deerIntelStore";
import {
  fetchLiveForecast,
  resolvePropertyWeatherPoint,
  type LiveForecast,
} from "@/lib/liveWeather";
import { useUnitPreferences } from "@/lib/units";
import { useSeasonCalendar, getSeasonContext } from "@/lib/seasonCalendar";
import { getHuntPlannerSummary, plannerHuntDate } from "@/lib/huntPlanner";
import {
  ClipboardIcon,
  MapIcon,
  MapPinIcon,
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

// Fixed pre-mount clock (see verdict below); any constant works.
const HYDRATION_SAFE_NOW = new Date(2000, 0, 1, 12, 0);

export default function Home() {
  const state = useDeerIntelStore();
  const planner = getHuntPlannerSummary(state);
  const recommendedProperty = planner.recommendedProperty.property;
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
  const propertyPhotoRecords = state.photoRecords.filter(
    (photo) => photo.propertyId === activePropertyId,
  );
  const patternReport = buildPropertyPatternReport(
    propertyHunts,
    propertyCameraChecks,
    propertyCameras,
    propertyPhotoRecords,
  );
  const hasPatternSignal =
    patternReport.conditionInsights.length > 0 || Boolean(patternReport.hottestCamera);
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
    // Intentional client-only seed: `now` starts null so server and first
    // client render match (no hydration mismatch), then the real clock is set
    // once on mount and ticked each minute. This one-time post-mount set is by
    // design, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function selectProperty(propertyId: string) {
    updateDeerIntelStore((currentState) => ({
      ...currentState,
      selectedPropertyId: propertyId,
    }));
  }

  const tempUnit = units.temperature;
  const windUnit = units.wind;

  useEffect(() => {
    if (!weatherKey) {
      // Clear a stale forecast when the active property has no weather point.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForecast(null);
      return;
    }

    const [lat, lng] = weatherKey.split(",").map(Number);
    let active = true;

    fetchLiveForecast(
      { lat, lng },
      { temperature: tempUnit, wind: windUnit },
    ).then((result) => {
      if (!active) return;
      setForecast(result.status === "ok" ? result.forecast : null);
      // Lets the "Follow daylight" theme track this property's real day length.
      if (result.status === "ok") {
        rememberSunTimes(result.forecast.sunriseIso, result.forecast.sunsetIso);
      }
    });

    return () => {
      active = false;
    };
  }, [weatherKey, tempUnit, windUnit]);

  const currentWind = forecast?.current.windDirection;
  const seasonCtx = getSeasonContext(now ?? new Date(), seasonPrefs, activeProperty?.latitude);
  const moon = useMoonPhase();
  // Before mount `now` is null; a fixed stand-in keeps the server render and
  // the first client render identical, then the real clock takes over.
  const verdict = buildTodayVerdict({
    now: now ?? HYDRATION_SAFE_NOW,
    forecast,
    stands: propertyStands,
    hunts: propertyHunts,
    pins: propertyPins,
    rutLabel: seasonCtx.phaseLabel,
    rutActive: ["seeking", "chasing", "peak"].includes(seasonCtx.phase),
  });

  // The forecast column for the next sit, highlighted in the wind grid.
  const forecastDays = forecast?.days ?? [];
  const activeSitKey =
    verdict.period === "tomorrow"
      ? forecastDays[1] && `${forecastDays[1].date}-AM`
      : forecastDays[0] &&
        `${forecastDays[0].date}-${verdict.period === "morning" ? "AM" : "PM"}`;
  const hourlyActivity = buildHourlyActivity(
    propertyPhotoRecords,
    now ?? HYDRATION_SAFE_NOW,
  );

  const cameraName = (cameraId: string) =>
    propertyCameras.find((camera) => camera.id === cameraId)?.name ?? "Camera";
  const recentPhotos = propertyPhotoRecords
    .filter((photo) => Boolean(photo.imageId))
    .sort((a, b) => photoRecordTime(b) - photoRecordTime(a));
  const isBuckPhoto = isBuckRecord;
  const photoDateLabel = (photo: PhotoRecord) => {
    const time = photoRecordTime(photo);
    return time
      ? new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
  };
  const heroSource = recentPhotos.find(isBuckPhoto) ?? recentPhotos[0];
  const heroPhoto: HeroPhoto | null = heroSource?.imageId
    ? {
        imageId: heroSource.imageId,
        caption: `${getPhotoBuckNames(heroSource)[0] ?? heroSource.species ?? "Deer"} on ${cameraName(heroSource.cameraSiteId)}`,
        dateLabel: photoDateLabel(heroSource),
      }
    : null;
  const stripPhotos: StripPhoto[] = recentPhotos.slice(0, 8).map((photo) => ({
    id: photo.id,
    imageId: photo.imageId!,
    title: getPhotoBuckNames(photo)[0] ?? (photo.species || "Deer"),
    subtitle: [cameraName(photo.cameraSiteId), photoDateLabel(photo)]
      .filter(Boolean)
      .join(", "),
    href: `/properties/${photo.propertyId}/assets/${photo.cameraSiteId}#photos`,
    isBuck: isBuckPhoto(photo),
  }));

  return (
    <PageShell maxWidth="980px">
      <HuntConditionAlerts
        propertyName={activeProperty?.name ?? "This property"}
        point={weatherPoint}
        stands={propertyStands}
      />
      <BackupReminderBanner
        currentRecordCount={countRecords(state)}
        nowMs={now ? now.getTime() : null}
      />
      <ColdFrontBanner
        propertyName={activeProperty?.name ?? "this property"}
        pressure={forecast?.pressure}
      />
      <TodayVerdictHero
        verdict={verdict}
        propertyName={activeProperty?.name ?? "Your ground"}
        photo={heroPhoto}
      />

      <div style={todayStackStyle}>
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

        <ConditionsStrip
          windDirection={forecast?.current.windDirection}
          windSpeed={forecast?.current.windSpeed}
          temperature={forecast?.current.temperature}
          conditions={forecast?.current.weather}
          moon={moon}
          pressure={forecast?.pressure}
        />

        <RutRibbon
          phase={seasonCtx.phase}
          phaseLabel={seasonCtx.phaseLabel}
          daysToPeak={seasonCtx.daysToPeak}
        />

        <StandCheckPanel
          check={verdict.check}
          wind={verdict.wind}
          whenLabel={verdict.periodLabel}
        />
        <StandWindGrid
          days={forecast?.days ?? []}
          stands={propertyStands}
          activeKey={activeSitKey}
        />

        <DeerHoursChart
          activity={hourlyActivity}
          sunriseHour={isoHour(forecast?.sunriseIso)}
          sunsetHour={isoHour(forecast?.sunsetIso)}
          nowHour={now ? now.getHours() + now.getMinutes() / 60 : undefined}
        />

        <CameraPhotoStrip
          photos={stripPhotos}
          allHref={activeProperty ? "/cameras" : "/properties"}
        />

        <Card as="section" variant="subtle" style={conditionsCardStyle}>
          <CollapsibleSection
            title="All conditions"
            description="Forecast, wind compass, moon, barometer, and movement score"
            variant="bare"
          >
            <LiveWeatherPanel
              point={weatherPoint}
              emptyHint={
                activeProperty
                  ? "Add map pins or a camera location to this property to load live weather."
                  : "Set up a property with map pins to load live weather."
              }
            />
            <div style={instrumentsRowStyle}>
              <WindCompass
                wind={currentWind}
                windSpeed={forecast?.current.windSpeed}
                stands={propertyStands}
              />
              <MoonPhaseCard />
              <Barometer pressure={forecast?.pressure} />
            </div>
            <MovementScorePanel point={weatherPoint} />
          </CollapsibleSection>
        </Card>
      </div>

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
              className="di-navbtn"
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={miniStatStyle}>
      <span style={miniStatValueStyle}>{value}</span>
      <span style={miniStatLabelStyle}>{label}</span>
    </div>
  );
}

/** Fractional local hour from an Open-Meteo "YYYY-MM-DDTHH:MM" time. */
function isoHour(iso: string | undefined): number | undefined {
  const [h, m] = (iso?.split("T")[1] ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : undefined;
}

function propertySubtitle(county?: string, acres?: string) {
  return [county, acres ? `${acres} acres` : ""]
    .filter(Boolean)
    .join(" / ") || "Property workspace";
}

const pickerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const pickerLabelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  flex: 1,
  minHeight: "44px",
  padding: "0.55rem 0.75rem",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "1rem",
  fontWeight: 700,
};

const todayStackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  margin: "1rem 0 2rem",
};

const conditionsCardStyle: CSSProperties = {
  padding: "0.25rem 1rem",
};

const instrumentsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: "0.8rem",
  margin: "1rem 0",
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

